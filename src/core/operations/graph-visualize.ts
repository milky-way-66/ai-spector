import { join } from "node:path";
import { openInBrowser } from "../util/open-browser.js";
import { writeFile, mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import { pathExists, readJson } from "../util/fs.js";
import { resolveProjectPaths } from "../util/paths.js";
import type { TraceabilityGraph } from "@/types.js";
import {
  isKnowledgePayload,
  type AnalysisKnowledge,
} from "../graph/knowledge.js";
import { buildVisualizationHtml } from "../visualize/html.js";
import { computeGraphStats, computeKnowledgeStats } from "../visualize/stats.js";

export interface GraphVisualizeOptions {
  root?: string;
  graphPath?: string;
  knowledgePath?: string;
  output?: string;
  open?: boolean;
  skipKnowledge?: boolean;
}

export interface GraphVisualizeResult {
  outputPath: string;
  nodeCount: number;
  edgeCount: number;
  knowledgeStats?: ReturnType<typeof computeKnowledgeStats>;
}

export async function runGraphVisualize(opts: GraphVisualizeOptions): Promise<GraphVisualizeResult> {
  const paths = await resolveProjectPaths(opts.root);
  const graphPath = opts.graphPath ?? paths.graph;
  const knowledgePath =
    opts.knowledgePath ??
    join(paths.root, ".ai-spector/.docflow/analysis/knowledge.json");
  const outputPath =
    opts.output ?? join(paths.root, ".ai-spector/views/graph-knowledge.html");

  const graph = await readJson<TraceabilityGraph>(graphPath);

  let knowledge: AnalysisKnowledge | null = null;
  if (!opts.skipKnowledge && (await pathExists(knowledgePath))) {
    const raw = await readJson<unknown>(knowledgePath);
    if (isKnowledgePayload(raw)) {
      knowledge = raw as AnalysisKnowledge;
    }
  }

  const html = buildVisualizationHtml({
    generatedAt: new Date().toISOString(),
    projectRoot: paths.root,
    graph,
    knowledge,
    graphStats: computeGraphStats(graph),
    knowledgeStats: computeKnowledgeStats(knowledge),
  });

  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, html, "utf8");

  if (opts.open) {
    await openInBrowser(outputPath);
  }

  return {
    outputPath,
    nodeCount: graph.nodes.length,
    edgeCount: graph.edges.length,
    knowledgeStats: knowledge ? computeKnowledgeStats(knowledge) : undefined,
  };
}
