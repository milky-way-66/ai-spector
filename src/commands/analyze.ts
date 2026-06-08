import { join } from "node:path";
import { buildSectionRegistry } from "../registry/build.js";
import { bootstrapFromRegistry } from "./bootstrap.js";
import { validateGraph, formatIssues } from "./validate.js";
import { loadDocflowConfig } from "../config/load.js";
import { resolveProjectPaths } from "../util/paths.js";
import { pathExists, readJson, writeJson } from "../util/fs.js";
import { runGraphMerge } from "./graph-merge.js";

export interface AnalyzePrepOptions {
  merge?: boolean;
}

export interface AnalyzePrepResult {
  documentCount: number;
  sectionCount: number;
  registryPath: string;
  graphPath: string;
  merged: boolean;
}

export async function runAnalyzePrep(
  root?: string,
  opts: AnalyzePrepOptions = {},
): Promise<AnalyzePrepResult> {
  const paths = await resolveProjectPaths(root);
  const { root: projectRoot } = await loadDocflowConfig(root);

  const registry = await buildSectionRegistry(projectRoot);
  await writeJson(paths.registry, registry);

  const graph = bootstrapFromRegistry(registry);
  await writeJson(paths.graph, graph.toTraceabilityGraph());

  const issues = await validateGraph({
    graphPath: paths.graph,
    schemaPath: paths.schema,
    registryPath: paths.registry,
    rulesPath: paths.rulesTraceability,
  });
  const errors = issues.filter((i) => i.severity === "error");
  if (errors.length > 0) {
    throw new Error(`Graph validation failed after analyze prep:\n${formatIssues(issues)}`);
  }

  const statePath = join(projectRoot, ".ai-spector/.docflow/state.json");
  const state = await readJson<Record<string, unknown>>(statePath).catch(() => ({
    version: 1,
    analysis: {},
  }));
  const analysis = (state.analysis as Record<string, unknown>) ?? {};
  analysis.graphPreparedAt = new Date().toISOString();
  state.analysis = analysis;
  await writeJson(statePath, state);

  const total = registry.documents.reduce((n, d) => n + d.sections.length, 0);

  let merged = false;
  if (opts.merge) {
    const knowledgePath = join(projectRoot, ".ai-spector/.docflow/analysis/knowledge.json");
    const patchPath = join(projectRoot, ".ai-spector/.docflow/extract/patch.json");
    if ((await pathExists(knowledgePath)) || (await pathExists(patchPath))) {
      await runGraphMerge({ root: projectRoot });
      merged = true;
    }
  }

  return {
    documentCount: registry.documents.length,
    sectionCount: total,
    registryPath: paths.registry,
    graphPath: paths.graph,
    merged,
  };
}
