import type { TraceabilityGraph } from "./types.js";

export interface GraphStats {
  nodes: number;
  edges: number;
  byType: Record<string, number>;
  domainNodes: number;
  structureNodes: number;
}

export function computeGraphStats(graph: TraceabilityGraph): GraphStats {
  const byType: Record<string, number> = {};
  const structure = new Set(["document", "section", "table", "diagram"]);
  let domainNodes = 0;
  let structureNodes = 0;

  for (const n of graph.nodes) {
    byType[n.type] = (byType[n.type] ?? 0) + 1;
    if (structure.has(n.type)) {
      structureNodes++;
    } else {
      domainNodes++;
    }
  }

  return {
    nodes: graph.nodes.length,
    edges: graph.edges.length,
    byType,
    domainNodes,
    structureNodes,
  };
}
