import type { TraceabilityGraph } from "@/types.js";
import { readJson } from "../util/fs.js";

export async function loadGraph(path: string): Promise<TraceabilityGraph> {
  const graph = await readJson<TraceabilityGraph>(path);
  if (!graph.version || !Array.isArray(graph.nodes) || !Array.isArray(graph.edges)) {
    throw new Error(`Invalid graph file: ${path}`);
  }
  return graph;
}

export function emptyGraph(): TraceabilityGraph {
  return { version: 1, nodes: [], edges: [] };
}
