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

/**
 * Prepare traceability graph structure (registry + bootstrap + validate).
 * Semantic knowledge extraction runs in Cursor via the analyze skill + Graphify MCP.
 */
export async function runAnalyzePrep(
  root?: string,
  opts: AnalyzePrepOptions = {},
): Promise<void> {
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
    console.log(formatIssues(issues));
    throw new Error("Graph validation failed after analyze prep");
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
  console.log(`Graph ready: ${registry.documents.length} documents, ${total} sections`);
  console.log(`  registry → ${paths.registry}`);
  console.log(`  graph    → ${paths.graph}`);
  console.log("");
  const knowledgePath = join(
    projectRoot,
    ".ai-spector/.docflow/analysis/knowledge.json",
  );
  const patchPath = join(projectRoot, ".ai-spector/.docflow/extract/patch.json");

  if (opts.merge) {
    if ((await pathExists(knowledgePath)) || (await pathExists(patchPath))) {
      await runGraphMerge({ root: projectRoot });
      console.log("");
      console.log("Merged domain knowledge into graph.");
    } else {
      console.log("");
      console.log("Skip merge: no knowledge.json or extract/patch.json yet.");
    }
  }

  console.log("");
  console.log("Structure ready. In Cursor ask: analyze the data source");
  console.log("(The agent runs merge, validate, and Graphify — not you.)");
}
