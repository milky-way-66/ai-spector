import { resolve } from "node:path";
import { findProjectRoot } from "../config/load.js";
import {
  lifecycleSummary,
  nowIso,
  probeLifecycleSignals,
  readLifecycle,
  reconcileLifecycle,
  writeLifecycle,
  WRITER_LIFECYCLE_HANDOFF,
  type LifecycleSummary,
} from "../docops/lifecycle.js";
import { probeGenerateGatePending } from "../docops/generate-gate-probe.js";

function resolveRoot(root?: string): string {
  return resolve(root ?? findProjectRoot());
}

export interface LifecycleSyncResult {
  ok: true;
  lifecycle: LifecycleSummary;
  dryRun: boolean;
}

function printHumanSummary(summary: LifecycleSummary, dryRun: boolean): void {
  const intent = summary.intent ?? "unknown";
  const next = summary.nextStepId ?? "none";
  const mode = dryRun ? " (dry run — not written)" : "";
  console.log(`Lifecycle sync${mode}`);
  console.log(`  Intent: ${intent} — ${summary.percentComplete}% complete`);
  console.log(`  Next step: ${next}`);
  for (const step of summary.steps) {
    const mark =
      step.status === "done"
        ? "✓"
        : step.status === "blocked"
          ? "!"
          : step.status === "skipped"
            ? "-"
            : "○";
    console.log(`  ${mark} ${step.id} (${step.status})`);
  }
  console.log("");
  console.log(WRITER_LIFECYCLE_HANDOFF);
}

export async function runLifecycleSync(opts: {
  root?: string;
  json?: boolean;
  dryRun?: boolean;
} = {}): Promise<number> {
  const root = resolveRoot(opts.root);
  const existing = await readLifecycle(root);
  const probes = await probeLifecycleSignals(root);
  const reconciled = reconcileLifecycle({ lifecycle: existing, probes });
  const toWrite = { ...reconciled, updatedAt: nowIso(), updatedBy: "ai-spector" };
  if (!opts.dryRun) {
    await writeLifecycle(root, toWrite);
  }
  const generateGatePending = await probeGenerateGatePending(root);
  const summary = lifecycleSummary(toWrite, {
    present: existing != null,
    generateGatePending,
  });
  if (opts.json) {
    console.log(JSON.stringify({ ok: true, lifecycle: summary, dryRun: Boolean(opts.dryRun) }, null, 2));
  } else {
    printHumanSummary(summary, Boolean(opts.dryRun));
  }
  return 0;
}

export async function lifecycleSyncResult(opts: {
  root?: string;
  dryRun?: boolean;
} = {}): Promise<LifecycleSyncResult> {
  const root = resolveRoot(opts.root);
  const existing = await readLifecycle(root);
  const probes = await probeLifecycleSignals(root);
  const reconciled = reconcileLifecycle({ lifecycle: existing, probes });
  const toWrite = { ...reconciled, updatedAt: nowIso(), updatedBy: "ai-spector" };
  if (!opts.dryRun) {
    await writeLifecycle(root, toWrite);
  }
  const generateGatePending = await probeGenerateGatePending(root);
  const summary = lifecycleSummary(toWrite, {
    present: existing != null,
    generateGatePending,
  });
  return { ok: true, lifecycle: summary, dryRun: Boolean(opts.dryRun) };
}
