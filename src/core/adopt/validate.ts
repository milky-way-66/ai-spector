import { mkdir } from "node:fs/promises";
import { loadDocflowConfig } from "../config/load.js";
import { runCheck, type CheckFinding } from "../operations/check.js";
import { validateGraph } from "../operations/validate.js";
import { pathExists, readJson, writeJson } from "../util/fs.js";
import { resolveProjectPaths } from "../util/paths.js";
import { adoptArtifactPaths } from "./paths.js";
import { loadAdoptSetup } from "./setup.js";
import type { AdoptPlan } from "./types.js";

export interface AdoptValidationGap {
  id: string;
  severity: "blocking" | "warning";
  message: string;
  fix?: string;
}

export interface AdoptValidationResult {
  ready: boolean;
  blockingCount: number;
  gaps: AdoptValidationGap[];
  questionsForUser: string[];
}

function isStructOrCfgError(finding: CheckFinding): boolean {
  return (
    finding.severity === "error" &&
    (finding.ruleId.startsWith("STRUCT-") || finding.ruleId.startsWith("CFG-"))
  );
}

function checkFindingToGap(
  finding: CheckFinding,
  severity: "blocking" | "warning",
): AdoptValidationGap {
  return {
    id: finding.ruleId,
    severity,
    message: finding.message,
    ...(finding.fix ? { fix: finding.fix } : {}),
  };
}

async function syncSetupFromPlan(root: string, plan: AdoptPlan): Promise<void> {
  const { setup, dir } = adoptArtifactPaths(root);
  await mkdir(dir, { recursive: true });
  const state = await loadAdoptSetup(root);
  const now = new Date().toISOString();
  let changed = false;

  if (
    (plan.status === "approved" || plan.status === "applied") &&
    !state.items["plan.approved"]?.done
  ) {
    state.items["plan.approved"] = { done: true, at: now };
    changed = true;
  }
  if (plan.status === "applied" && !state.items["apply.done"]?.done) {
    state.items["apply.done"] = { done: true, at: now };
    changed = true;
  }

  if (changed) {
    await writeJson(setup, state);
  }
}

export async function validateAdopt(
  opts: { root?: string; sync?: boolean } = {},
): Promise<AdoptValidationResult> {
  const { root } = await loadDocflowConfig(opts.root);
  const gaps: AdoptValidationGap[] = [];
  const questionsForUser: string[] = [];
  const adoptPaths = adoptArtifactPaths(root);

  if (!(await pathExists(adoptPaths.plan))) {
    gaps.push({
      id: "plan.missing",
      severity: "blocking",
      message: "No adopt plan found.",
      fix: "npx ai-spector adopt plan",
    });
  } else {
    const plan = await readJson<AdoptPlan>(adoptPaths.plan);
    if (plan.status !== "applied") {
      gaps.push({
        id: "plan.not-applied",
        severity: "blocking",
        message: `Migration plan is not applied (status: ${plan.status}).`,
        fix: "npx ai-spector adopt apply",
      });
    }
    if (opts.sync) {
      await syncSetupFromPlan(root, plan);
    }
  }

  const checkResult = await runCheck({ root });
  for (const finding of checkResult.findings) {
    if (isStructOrCfgError(finding)) {
      gaps.push(checkFindingToGap(finding, "blocking"));
    } else if (finding.severity === "warning") {
      gaps.push(checkFindingToGap(finding, "warning"));
    }
  }

  const projectPaths = await resolveProjectPaths(root);
  if (await pathExists(projectPaths.graph)) {
    const issues = await validateGraph({
      graphPath: projectPaths.graph,
      schemaPath: projectPaths.schema,
      registryPath: projectPaths.registry,
      rulesPath: projectPaths.rulesTraceability,
    });
    for (const issue of issues) {
      if (issue.severity === "error") {
        gaps.push({
          id: `graph.${issue.ruleId}`,
          severity: "blocking",
          message: issue.message,
          fix: "npx ai-spector graph validate",
        });
      } else if (issue.severity === "warn") {
        gaps.push({
          id: `graph.${issue.ruleId}`,
          severity: "warning",
          message: issue.message,
        });
      }
    }
  }

  const blockingCount = gaps.filter((g) => g.severity === "blocking").length;
  return {
    ready: blockingCount === 0,
    blockingCount,
    gaps,
    questionsForUser,
  };
}
