import { InMemoryGraph } from "@/core/graph/InMemoryGraph.js";
import type { GraphEdge, GraphNode, TraceabilityGraph } from "@/types.js";

export function node(
  id: string,
  type: GraphNode["type"],
  extra?: Partial<GraphNode>,
): GraphNode {
  return { id, type, ...extra };
}

export function graph(
  nodes: GraphNode[],
  edges: GraphEdge[],
): TraceabilityGraph {
  return { version: 1, nodes, edges };
}

export function loadGraph(
  nodes: GraphNode[],
  edges: GraphEdge[],
): InMemoryGraph {
  return InMemoryGraph.from(graph(nodes, edges));
}
