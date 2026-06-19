import { join } from "node:path";
import { loadDocflowConfig } from "../config/load.js";
import type { TaskState } from "../operations/task.js";
import { assertAdoptBootstrapAllowed } from "../operations/adopt-gates.js";
import { runIndex } from "../operations/index.js";
import {
  buildPrototypeManifest,
  writePrototypeManifestFiles,
} from "../prototype/build-manifest.js";
import {
  loadPrototypeConfig,
  readPrototypeThemeName,
} from "../prototype/config.js";
import { runReviewDiscovery } from "../reviews/register.js";
import { pathExists, readJson, writeJson } from "../util/fs.js";
import { adoptArtifactPaths } from "./paths.js";
import { markAdoptSetupItem } from "./setup.js";
import { createAdoptCompletedTasks } from "./tasks.js";
import type { AdoptPlan } from "./types.js";

const CONFIG_RELATIVE = ".ai-spector/docflow.config.json";

export type BootstrapStepStatus = "ok" | "skipped" | "failed";

export type BootstrapStep = {
  id: string;
  status: BootstrapStepStatus;
  detail?: string;
};

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function deepMerge(
  target: Record<string, unknown>,
  source: Record<string, unknown>,
): Record<string, unknown> {
  const result = { ...target };
  for (const [key, value] of Object.entries(source)) {
    const existing = result[key];
    if (isPlainObject(value) && isPlainObject(existing)) {
      result[key] = deepMerge(existing, value);
    } else {
      result[key] = value;
    }
  }
  return result;
}

function isDocflowConfigPatch(patchPath: string): boolean {
  const norm = patchPath.replace(/\\/g, "/");
  return norm === CONFIG_RELATIVE || norm.endsWith("/docflow.config.json");
}

async function applyConfigPatches(
  root: string,
  patches: AdoptPlan["configPatches"],
): Promise<{ applied: number }> {
  const relevant = patches.filter((patch) => isDocflowConfigPatch(patch.path));
  if (relevant.length === 0) {
    return { applied: 0 };
  }

  const configPath = join(root, ".ai-spector", "docflow.config.json");
  const current = (await pathExists(configPath))
    ? await readJson<Record<string, unknown>>(configPath)
    : {};

  let merged = current;
  for (const patch of relevant) {
    merged = deepMerge(merged, patch.set);
  }

  await writeJson(configPath, merged);
  return { applied: relevant.length };
}

export async function runAdoptBootstrap(
  opts: {
    root?: string;
    skipAnalyze?: boolean;
    legacy?: boolean;
    activeTask?: TaskState | null;
  } = {},
): Promise<{ steps: BootstrapStep[] }> {
  const { root } = await loadDocflowConfig(opts.root);
  assertAdoptBootstrapAllowed(opts.activeTask ?? null, { legacy: opts.legacy });
  const paths = adoptArtifactPaths(root);
  const steps: BootstrapStep[] = [];

  if (!(await pathExists(paths.plan))) {
    throw new Error("No adopt plan — run: npx ai-spector adopt plan");
  }

  const plan = await readJson<AdoptPlan>(paths.plan);
  if (plan.status !== "applied") {
    throw new Error(`Plan must be applied before bootstrap — current status: ${plan.status}`);
  }

  try {
    const { applied } = await applyConfigPatches(root, plan.configPatches);
    steps.push({
      id: "config-patches",
      status: "ok",
      detail: applied > 0 ? `${applied} patch(es) applied` : "no patches",
    });
  } catch (error) {
    steps.push({
      id: "config-patches",
      status: "failed",
      detail: error instanceof Error ? error.message : String(error),
    });
  }

  try {
    const report = await runIndex({ root });
    if (report.failed) {
      const first = report.steps.find((s) => s.status === "failed");
      steps.push({
        id: "index",
        status: "failed",
        detail: first?.detail ?? "index refresh failed",
      });
    } else {
      steps.push({ id: "index", status: "ok" });
    }
  } catch (error) {
    steps.push({
      id: "index",
      status: "failed",
      detail: error instanceof Error ? error.message : String(error),
    });
  }

  steps.push({
    id: "analyze",
    status: "skipped",
    detail: "Run /analyze manually for data-source supplement",
  });

  const shouldEmitManifest = plan.prototypeActions.some(
    (action) => action.action === "emit-manifest",
  );
  if (shouldEmitManifest) {
    try {
      const { projectRoot, config } = await loadPrototypeConfig(root);
      const themeName =
        (await readPrototypeThemeName(projectRoot, config)) ?? config.defaultTheme;
      const built = await buildPrototypeManifest({
        projectRoot,
        config,
        themeName,
      });
      const written = await writePrototypeManifestFiles(projectRoot, config, built);
      steps.push({
        id: "prototype-manifest",
        status: "ok",
        detail: `${built.screenCount} screen(s) → ${written.manifestPath}`,
      });
    } catch (error) {
      steps.push({
        id: "prototype-manifest",
        status: "failed",
        detail: error instanceof Error ? error.message : String(error),
      });
    }
  } else {
    steps.push({ id: "prototype-manifest", status: "skipped" });
  }

  try {
    const result = await runReviewDiscovery(root);
    steps.push({
      id: "review-discovery",
      status: "ok",
      detail: `discovered ${result.discovered}, queued ${result.queued}`,
    });
  } catch (error) {
    steps.push({
      id: "review-discovery",
      status: "failed",
      detail: error instanceof Error ? error.message : String(error),
    });
  }

  try {
    const ids = await createAdoptCompletedTasks({ root });
    const created = [ids.srs, ids.basicDesign].filter(Boolean);
    steps.push({
      id: "adopt-tasks",
      status: "ok",
      detail: created.length > 0 ? `${created.length} task(s) created` : "no migrated docs",
    });
  } catch (error) {
    steps.push({
      id: "adopt-tasks",
      status: "failed",
      detail: error instanceof Error ? error.message : String(error),
    });
  }

  await markAdoptSetupItem(root, "bootstrap.done");

  return { steps };
}
