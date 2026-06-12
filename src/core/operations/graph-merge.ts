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
import type { InMemoryGraph } from "../graph/InMemoryGraph.js";
import type { GraphEdge } from "@/types.js";
import type { ValidationIssue } from "@/types.js";

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

export interface SectionWarning {
  nodeId: string;
  attemptedSectionId: string;
  suggestion?: string;
  message: string;
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
  sectionWarnings?: SectionWarning[];
}

const SECTION_EDGE_TYPES = new Set<GraphEdge["type"]>(["listedIn", "describedIn", "definedIn"]);

function closestSectionId(attempted: string, graph: InMemoryGraph): string | undefined {
  const sectionIds: string[] = [];
  for (const node of graph.nodesById.values()) {
    if (node.type === "section" || node.type === "document") sectionIds.push(node.id);
  }
  if (sectionIds.length === 0) return undefined;

  // Score by shared dot-separated segments from the start
  const parts = attempted.split(".");
  let best = { id: "", score: -1 };
  for (const id of sectionIds) {
    const idParts = id.split(".");
    let shared = 0;
    for (let i = 0; i < Math.min(parts.length, idParts.length); i++) {
      if (parts[i] === idParts[i]) shared++;
      else break;
    }
    // Boost for partial last-segment match (handles typos like l3.2 vs l3.3)
    const score = shared * 10 + (id.includes(parts[parts.length - 1] ?? "") ? 1 : 0);
    if (score > best.score) best = { id, score };
  }
  return best.score >= 0 ? best.id : undefined;
}

function collectSectionWarnings(patch: ExtractPatch, graph: InMemoryGraph): SectionWarning[] {
  const warnings: SectionWarning[] = [];
  for (const edge of patch.edges) {
    if (!SECTION_EDGE_TYPES.has(edge.type)) continue;
    if (graph.nodesById.has(edge.to)) continue; // resolved fine
    const suggestion = closestSectionId(edge.to, graph);
    warnings.push({
      nodeId: edge.from,
      attemptedSectionId: edge.to,
      suggestion,
      message: suggestion
        ? `listedInSection "${edge.to}" not found in graph — did you mean "${suggestion}"?`
        : `listedInSection "${edge.to}" not found in graph and no close match was found. Run \`npx ai-spector index\` first or check the section registry.`,
    });
  }
  return warnings;
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

  const sectionWarnings = collectSectionWarnings(patch, graph);
  if (sectionWarnings.length > 0) result.sectionWarnings = sectionWarnings;

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
