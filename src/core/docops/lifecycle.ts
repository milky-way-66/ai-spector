import { readdir } from "node:fs/promises";
import { join } from "node:path";
import { ENGINE_CONFIG_REL } from "../engine/paths.js";
import { pathExists, readJson, writeJson } from "../util/fs.js";
import { assessDocopsProject } from "./assess.js";
import { readDocopsConfig } from "./config.js";
import {
  LEGACY_DOCFLOW_CONFIG_REL,
  segmentRepoPrefixMap,
} from "./paths.js";

export const LIFECYCLE_PATH = ".docops/lifecycle.json";

export type LifecycleIntent = "greenfield" | "migrate";
export type StepStatus = "pending" | "in_progress" | "done" | "skipped" | "blocked";

export const GREENFIELD_STEPS = [
  "project-created",
  "git-connected",
  "docops-init",
  "local-adapter-ready",
  "data-source-added",
  "first-docs-generated",
  "first-push-synced",
] as const;

export const MIGRATE_STEPS = [
  "project-created",
  "git-connected",
  "docops-init",
  "legacy-aligned",
  "local-adapter-ready",
  "first-docs-generated",
  "first-push-synced",
] as const;

export type LifecycleStepId = (typeof GREENFIELD_STEPS)[number] | "legacy-aligned";

export const DEFAULT_HELP: Partial<Record<LifecycleStepId, string>> = {
  "docops-init": "guide/modules/generate.md",
  "local-adapter-ready": "course/en/02-get-started/01-setup-via-chat",
  "legacy-aligned": "guide/MIGRATION.md",
  "data-source-added": "course/en/03-chat-basics/01-how-chat-works",
};

export interface LifecycleStep {
  id: LifecycleStepId;
  status: StepStatus;
  completedAt?: string;
  helpRef?: string;
  blockedReason?: string;
}

export interface LifecycleDocument {
  version: number;
  intent: LifecycleIntent;
  adapter: string;
  updatedAt: string;
  updatedBy: string;
  steps: LifecycleStep[];
}

export interface LifecycleProbes {
  git_connected?: boolean;
  has_docops_config?: boolean;
  has_data_source_files?: boolean;
  has_generated_docs?: boolean;
  layout?: string;
  has_ai_spector_engine?: boolean;
  adapter_ready?: boolean;
  writer_synced?: boolean;
}

export interface LifecycleSummary {
  present: boolean;
  intent: LifecycleIntent | undefined;
  adapter: string | undefined;
  steps: LifecycleStep[];
  percentComplete: number;
  nextStepId: LifecycleStepId | null;
}

export function nowIso(): string {
  return new Date().toISOString().replace(/\.\d{3}Z$/, "Z");
}

const DATA_SOURCE_PROBE_PATH = "docs/data-source";

function listingHasMeaningfulFiles(paths: string[]): boolean {
  for (const path of paths) {
    const name = path.replace(/\/$/, "").split("/").pop();
    if (name && name !== ".gitkeep") {
      return true;
    }
  }
  return false;
}

async function listFilesUnder(projectRoot: string, folder: string): Promise<string[]> {
  const absDir = join(projectRoot, folder);
  if (!(await pathExists(absDir))) {
    return [];
  }

  const results: string[] = [];

  async function walk(current: string, prefix: string): Promise<void> {
    let entries;
    try {
      entries = await readdir(current, { withFileTypes: true });
    } catch {
      return;
    }

    for (const entry of entries) {
      if (entry.name.startsWith(".")) {
        continue;
      }
      const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
      const full = join(current, entry.name);
      if (entry.isDirectory()) {
        await walk(full, rel);
        continue;
      }
      if (entry.isFile()) {
        results.push(rel.replace(/\\/g, "/"));
      }
    }
  }

  await walk(absDir, "");
  return results;
}

async function folderHasMdFiles(projectRoot: string, folder: string): Promise<boolean> {
  const files = await listFilesUnder(projectRoot, folder);
  return files.some((path) => path.endsWith(".md"));
}

/** Filesystem probes for lifecycle reconcile (parity with Writer git assessment). */
export async function probeLifecycleSignals(projectRoot: string): Promise<LifecycleProbes> {
  const assessment = await assessDocopsProject(projectRoot);
  const config = await readDocopsConfig(projectRoot);
  const hasDocopsConfig = config != null;

  const dataSourceListed = await listFilesUnder(projectRoot, DATA_SOURCE_PROBE_PATH);
  const hasDataSourceFiles = listingHasMeaningfulFiles(dataSourceListed);

  let hasGeneratedDocs = false;
  if (config) {
    for (const folder of Object.values(segmentRepoPrefixMap(config))) {
      if (folder && (await folderHasMdFiles(projectRoot, folder))) {
        hasGeneratedDocs = true;
        break;
      }
    }
  }

  const hasAiSpectorEngine =
    (await pathExists(join(projectRoot, ENGINE_CONFIG_REL))) ||
    (await pathExists(join(projectRoot, LEGACY_DOCFLOW_CONFIG_REL)));

  const gitConnected = await pathExists(join(projectRoot, ".git"));

  return {
    git_connected: gitConnected,
    has_docops_config: hasDocopsConfig,
    has_data_source_files: hasDataSourceFiles,
    has_generated_docs: hasGeneratedDocs,
    layout: assessment.layout,
    has_ai_spector_engine: hasAiSpectorEngine,
    writer_synced: false,
  };
}

function step(id: LifecycleStepId, status: StepStatus = "pending"): LifecycleStep {
  const s: LifecycleStep = { id, status };
  const ref = DEFAULT_HELP[id];
  if (ref) {
    s.helpRef = ref;
  }
  return s;
}

export function buildInitialLifecycle(opts: {
  intent: LifecycleIntent;
  adapter?: string;
  updatedBy: string;
}): LifecycleDocument {
  const { intent, adapter = "ai-spector", updatedBy } = opts;
  const order = intent === "migrate" ? MIGRATE_STEPS : GREENFIELD_STEPS;
  const steps = order.map((sid) => step(sid, "pending"));
  steps[0]!.status = "done";
  steps[0]!.completedAt = nowIso();
  return {
    version: 1,
    intent,
    adapter,
    updatedAt: nowIso(),
    updatedBy,
    steps,
  };
}

export function synthesizeLifecycleFromProbes(opts: {
  probes: LifecycleProbes;
  updatedBy?: string;
}): LifecycleDocument {
  const { probes, updatedBy = "ai-spector" } = opts;
  const intent: LifecycleIntent =
    probes.layout === "legacy" || probes.layout === "mixed" ? "migrate" : "greenfield";
  const lc = buildInitialLifecycle({ intent, updatedBy });
  return reconcileLifecycle({ lifecycle: lc, probes });
}

export function reconcileLifecycle(opts: {
  lifecycle: LifecycleDocument | null | undefined;
  probes: LifecycleProbes;
}): LifecycleDocument {
  const { lifecycle, probes } = opts;
  const base = lifecycle
    ? structuredClone(lifecycle)
    : synthesizeLifecycleFromProbes({ probes });
  const steps = Object.fromEntries(base.steps.map((s) => [s.id, s])) as Record<
    string,
    LifecycleStep
  >;

  function maybeDone(stepId: LifecycleStepId, cond: boolean): void {
    const s = steps[stepId];
    if (!s || s.status === "blocked" || s.status === "skipped") {
      return;
    }
    if (cond) {
      s.status = "done";
      s.completedAt ??= nowIso();
    }
  }

  maybeDone("git-connected", Boolean(probes.git_connected));
  maybeDone("docops-init", Boolean(probes.has_docops_config));
  maybeDone(
    "legacy-aligned",
    probes.layout === "docops" && base.intent === "migrate",
  );
  maybeDone(
    "local-adapter-ready",
    Boolean(probes.has_ai_spector_engine) || Boolean(probes.adapter_ready),
  );
  maybeDone("data-source-added", Boolean(probes.has_data_source_files));
  maybeDone("first-docs-generated", Boolean(probes.has_generated_docs));
  maybeDone("first-push-synced", Boolean(probes.writer_synced));

  const order = base.intent === "migrate" ? MIGRATE_STEPS : GREENFIELD_STEPS;
  base.steps = order.filter((sid) => sid in steps).map((sid) => steps[sid]!);
  return base;
}

export function lifecycleSummary(
  lifecycle: LifecycleDocument,
  opts: { present?: boolean } = {},
): LifecycleSummary {
  const { present = true } = opts;
  const steps = lifecycle.steps ?? [];
  const done = steps.filter((s) => s.status === "done").length;
  const total = steps.length || 1;
  const nextId =
    steps.find(
      (s) => s.status === "pending" || s.status === "in_progress" || s.status === "blocked",
    )?.id ?? null;
  return {
    present,
    intent: lifecycle.intent,
    adapter: lifecycle.adapter,
    steps,
    percentComplete: Math.round((100 * done) / total),
    nextStepId: nextId,
  };
}

export function lifecycleAbs(projectRoot: string): string {
  return join(projectRoot, LIFECYCLE_PATH);
}

export async function readLifecycle(projectRoot: string): Promise<LifecycleDocument | null> {
  const path = lifecycleAbs(projectRoot);
  if (!(await pathExists(path))) {
    return null;
  }
  const raw = await readJson<LifecycleDocument>(path);
  return raw && typeof raw === "object" ? raw : null;
}

export async function writeLifecycle(
  projectRoot: string,
  lifecycle: LifecycleDocument,
): Promise<string> {
  const path = lifecycleAbs(projectRoot);
  await writeJson(path, lifecycle);
  return path;
}

export const WRITER_LIFECYCLE_HANDOFF =
  "Next on Writer: git push, then open Project → Overview to see updated checklist.";

/** Mark a single lifecycle step done and persist (creates lifecycle from probes when missing). */
export async function markLifecycleStepDone(
  projectRoot: string,
  stepId: LifecycleStepId,
  opts: { updatedBy?: string } = {},
): Promise<LifecycleDocument> {
  const { updatedBy = "ai-spector" } = opts;
  const probes = await probeLifecycleSignals(projectRoot);
  let lifecycle = await readLifecycle(projectRoot);
  if (!lifecycle) {
    lifecycle = synthesizeLifecycleFromProbes({ probes, updatedBy });
  }
  const step = lifecycle.steps.find((s) => s.id === stepId);
  if (step && step.status !== "blocked" && step.status !== "skipped") {
    step.status = "done";
    step.completedAt ??= nowIso();
  }
  const updated: LifecycleDocument = {
    ...lifecycle,
    updatedAt: nowIso(),
    updatedBy,
  };
  await writeLifecycle(projectRoot, updated);
  return updated;
}
