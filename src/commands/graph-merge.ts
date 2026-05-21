import { join } from "node:path";
import { loadInMemoryGraph } from "../graph/loadGraph.js";
import {
  isKnowledgePayload,
  knowledgeHasDomainEntries,
  knowledgeToPatch,
  type AnalysisKnowledge,
  type ExtractPatch,
} from "../graph/knowledge.js";
import { mergePatch, normalizePatch } from "../graph/merge.js";
import { resolveProjectPaths } from "../util/paths.js";
import { pathExists, readJson, writeJson } from "../util/fs.js";
import { validateGraph, formatIssues } from "./validate.js";

export interface GraphMergeOptions {
  root?: string;
  inputPath?: string;
  fromKnowledge?: boolean;
  graphPath?: string;
  writePatch?: string;
  validate?: boolean;
  dryRun?: boolean;
}

export async function runGraphMerge(opts: GraphMergeOptions): Promise<void> {
  const paths = await resolveProjectPaths(opts.root);
  const graphPath = opts.graphPath ?? paths.graph;
  const knowledgePath = join(
    paths.root,
    ".ai-spector/.docflow/analysis/knowledge.json",
  );
  const defaultPatchPath = join(paths.root, ".ai-spector/.docflow/extract/patch.json");

  let inputPath = opts.inputPath;
  if (opts.fromKnowledge) {
    inputPath = knowledgePath;
  } else if (!inputPath) {
    if (await pathExists(defaultPatchPath)) {
      inputPath = defaultPatchPath;
    } else {
      inputPath = knowledgePath;
    }
  }

  const raw = await readJson<unknown>(inputPath);
  const patch = await resolvePatch(raw, inputPath);

  if (opts.writePatch) {
    await writeJson(opts.writePatch, patch);
    console.log(`Wrote patch → ${opts.writePatch}`);
  }

  const graph = await loadInMemoryGraph(graphPath);
  const { stats } = mergePatch(graph, patch);

  console.log(
    `Merge: +${stats.nodesCreated} nodes, ~${stats.nodesUpdated} updated, +${stats.edgesAdded} edges` +
      (stats.nodesSkipped ? `, ${stats.nodesSkipped} structure nodes skipped` : ""),
  );

  if (opts.dryRun) {
    console.log("(dry-run: graph not saved)");
    return;
  }

  await writeJson(graphPath, graph.toTraceabilityGraph());

  const statePath = join(paths.root, ".ai-spector/.docflow/state.json");
  const state = await readJson<Record<string, unknown>>(statePath).catch(() => ({
    version: 1,
    analysis: {},
  }));
  const analysis = (state.analysis as Record<string, unknown>) ?? {};
  analysis.graphMergedAt = new Date().toISOString();
  analysis.lastMergeSource = inputPath;
  state.analysis = analysis;
  await writeJson(statePath, state);

  if (opts.validate !== false) {
    const issues = await validateGraph({
      graphPath,
      schemaPath: paths.schema,
      registryPath: paths.registry,
      rulesPath: paths.rulesTraceability,
    });
    const errors = issues.filter((i) => i.severity === "error");
    if (errors.length > 0) {
      console.log(formatIssues(issues));
      throw new Error("Graph validation failed after merge");
    }
    const warns = issues.filter((i) => i.severity === "warn");
    if (warns.length > 0) {
      console.log(formatIssues(warns));
    }
    console.log("Graph validate: OK");
  }

  console.log(`Wrote ${graphPath}`);
}

async function resolvePatch(raw: unknown, sourcePath: string): Promise<ExtractPatch> {
  if (isKnowledgePayload(raw)) {
    const knowledge = raw as AnalysisKnowledge;
    if (!knowledgeHasDomainEntries(knowledge)) {
      throw new Error(
        `No domain entries in ${sourcePath} (useCases, features, actors, …). Run /analyze in Cursor first.`,
      );
    }
    return knowledgeToPatch(knowledge);
  }

  const patch = normalizePatch(raw as ExtractPatch);
  if (patch.nodes.length === 0 && patch.edges.length === 0) {
    throw new Error(`Empty patch in ${sourcePath}`);
  }
  return patch;
}
