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
import { validateGraph } from "./validate.js";
import type { ValidationIssue } from "../../types.js";

export interface GraphMergeOptions {
  root?: string;
  inputPath?: string;
  fromKnowledge?: boolean;
  /** Merge agent semantic-links.patch.json (edges only; no structure nodes). */
  semantic?: boolean;
  /** Merge knowledge.json into graph before applying the patch (ensures domain nodes exist). */
  withKnowledge?: boolean;
  graphPath?: string;
  writePatch?: string;
  validate?: boolean;
  dryRun?: boolean;
}

export interface GraphMergeResult {
  graphPath: string;
  stats: { nodesCreated: number; nodesUpdated: number; edgesAdded: number; nodesSkipped: number };
  dryRun: boolean;
  patchWritten?: string;
  knowledgePreMerged?: boolean;
  knowledgeMissingWarning?: boolean;
  validationOk?: boolean;
  validationIssues?: ValidationIssue[];
  validationWarnCount?: number;
}

export async function runGraphMerge(opts: GraphMergeOptions): Promise<GraphMergeResult> {
  const paths = await resolveProjectPaths(opts.root);
  const graphPath = opts.graphPath ?? paths.graph;
  const knowledgePath = join(paths.root, ".ai-spector/.docflow/analysis/knowledge.json");
  const defaultPatchPath = join(paths.root, ".ai-spector/.docflow/extract/patch.json");
  const semanticPatchPath = join(paths.root, ".ai-spector/.docflow/extract/semantic-links.patch.json");

  let inputPath = opts.inputPath;
  if (opts.semantic) {
    inputPath = opts.inputPath ?? semanticPatchPath;
    if (!(await pathExists(inputPath))) {
      throw new Error(
        `No semantic patch at ${inputPath}. Run /link-graph in Cursor (agent writes semantic-links.patch.json), then merge.`,
      );
    }
  } else if (opts.fromKnowledge) {
    inputPath = knowledgePath;
  } else if (!inputPath) {
    inputPath = (await pathExists(defaultPatchPath)) ? defaultPatchPath : knowledgePath;
  }

  const raw = await readJson<unknown>(inputPath);
  const patch = await resolvePatch(raw, inputPath);

  const result: GraphMergeResult = {
    graphPath,
    stats: { nodesCreated: 0, nodesUpdated: 0, edgesAdded: 0, nodesSkipped: 0 },
    dryRun: opts.dryRun === true,
  };

  if (opts.writePatch) {
    await writeJson(opts.writePatch, patch);
    result.patchWritten = opts.writePatch;
  }

  const graph = await loadInMemoryGraph(graphPath);

  if (opts.withKnowledge && !opts.fromKnowledge && !opts.semantic) {
    if (await pathExists(knowledgePath)) {
      const rawKnowledge = await readJson<unknown>(knowledgePath);
      const knowledgePatch = await resolvePatch(rawKnowledge, knowledgePath);
      mergePatch(graph, knowledgePatch);
      result.knowledgePreMerged = true;
    } else {
      result.knowledgeMissingWarning = true;
    }
  }

  const { stats } = mergePatch(graph, patch, {
    semanticOnly: opts.semantic === true,
    patchSourcePath: inputPath,
  });
  result.stats = stats;

  if (opts.dryRun) {
    return result;
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
    const warns = issues.filter((i) => i.severity === "warn");
    result.validationIssues = issues;
    result.validationOk = errors.length === 0;
    result.validationWarnCount = warns.length;
    if (errors.length > 0) {
      throw new Error("Graph validation failed after merge");
    }
  }

  return result;
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
