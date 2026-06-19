import { join } from "node:path";
import { workspaceWorkflowDependenciesPath } from "../config/docflow-paths.js";
import { scaffoldBundleRoot } from "../config/load.js";
import { loadInMemoryGraph } from "../graph/loadGraph.js";
import { countNodesByType } from "../readiness/probes.js";
import { discoverMarkdownFiles } from "../index/docs-build.js";
import { loadDocflowConfig } from "../config/load.js";
import { pathExists, readJson } from "../util/fs.js";
import type { SourceMode } from "../operations/derive.js";

type CheckType = "hasFilesAny" | "graphNodeCount" | "pathExists" | "hasFiles";

interface WorkflowCheck {
  id: string;
  type: CheckType | string;
  path?: string;
  paths?: string[];
  glob?: string;
  min?: number;
  types?: string[];
  fail: string;
}

interface WorkflowStepConfig {
  command?: string;
  requires?: string[];
  checks?: WorkflowCheck[];
  modes?: Record<string, { requires?: string[]; checks?: WorkflowCheck[] }>;
}

interface WorkflowDependenciesFile {
  version: number;
  steps: Record<string, WorkflowStepConfig>;
}

export interface EvaluateWorkflowStepOptions {
  stepId: string;
  sourceMode?: SourceMode;
}

export interface WorkflowStepEvaluation {
  ok: boolean;
  stepId: string;
  sourceMode: SourceMode;
  failures: Array<{ id: string; message: string }>;
}

async function bundledWorkflowDependenciesPath(): Promise<string> {
  return join(
    scaffoldBundleRoot(),
    ".ai-spector/.docflow/config/workspace/workflow.dependencies.json",
  );
}

export async function loadWorkflowDependencies(
  root: string,
): Promise<WorkflowDependenciesFile> {
  const projectPath = workspaceWorkflowDependenciesPath(root);
  if (await pathExists(projectPath)) {
    return readJson<WorkflowDependenciesFile>(projectPath);
  }
  return readJson<WorkflowDependenciesFile>(await bundledWorkflowDependenciesPath());
}

async function countMarkdownUnder(root: string, relPath: string): Promise<number> {
  const abs = join(root, relPath);
  if (!(await pathExists(abs))) return 0;
  const files = await discoverMarkdownFiles(root, relPath);
  return files.length;
}

async function evaluateCheck(
  root: string,
  check: WorkflowCheck,
): Promise<{ ok: boolean; message?: string }> {
  switch (check.type) {
    case "hasFilesAny": {
      const paths = check.paths ?? [];
      const min = check.min ?? 1;
      let total = 0;
      for (const p of paths) {
        total += await countMarkdownUnder(root, p);
      }
      if (total >= min) return { ok: true };
      return { ok: false, message: check.fail };
    }
    case "graphNodeCount": {
      const { config } = await loadDocflowConfig(root);
      const graphPath = join(root, config.paths.graph);
      if (!(await pathExists(graphPath))) {
        return { ok: false, message: check.fail };
      }
      const graph = await loadInMemoryGraph(graphPath);
      const counts = countNodesByType(graph);
      const types = check.types ?? [];
      const total = types.reduce((n, t) => n + (counts[t] ?? 0), 0);
      const min = check.min ?? 1;
      if (total >= min) return { ok: true };
      return { ok: false, message: check.fail };
    }
    case "pathExists": {
      if (!check.path) return { ok: true };
      const exists = await pathExists(join(root, check.path));
      return exists ? { ok: true } : { ok: false, message: check.fail };
    }
    case "hasFiles": {
      if (!check.path) return { ok: true };
      const count = await countMarkdownUnder(root, check.path);
      const min = check.min ?? 1;
      if (count >= min) return { ok: true };
      return { ok: false, message: check.fail };
    }
    default:
      return { ok: true };
  }
}

function resolveStepChecks(
  step: WorkflowStepConfig | undefined,
  sourceMode: SourceMode,
): WorkflowCheck[] {
  if (!step) return [];
  if (sourceMode === "derive-downstream" && step.modes?.["derive-downstream"]?.checks) {
    return step.modes["derive-downstream"].checks;
  }
  return step.checks ?? [];
}

export async function evaluateWorkflowStep(
  root: string,
  opts: EvaluateWorkflowStepOptions,
): Promise<WorkflowStepEvaluation> {
  const sourceMode = opts.sourceMode ?? "forward";
  const deps = await loadWorkflowDependencies(root);
  const step = deps.steps[opts.stepId];
  const checks = resolveStepChecks(step, sourceMode);
  const failures: Array<{ id: string; message: string }> = [];

  for (const check of checks) {
    const result = await evaluateCheck(root, check);
    if (!result.ok) {
      failures.push({ id: check.id, message: result.message ?? check.fail });
    }
  }

  return {
    ok: failures.length === 0,
    stepId: opts.stepId,
    sourceMode,
    failures,
  };
}
