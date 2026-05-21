import type { TraceabilityGraph } from "../types.js";
import type { AnalysisKnowledge } from "../graph/knowledge.js";

export interface GraphStats {
  nodes: number;
  edges: number;
  byType: Record<string, number>;
  domainNodes: number;
  structureNodes: number;
}

export interface KnowledgeStats {
  present: boolean;
  actors: number;
  useCases: number;
  features: number;
  functionalRequirements: number;
  nfrs: number;
  entities: number;
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

export function computeKnowledgeStats(
  knowledge: AnalysisKnowledge | null,
): KnowledgeStats {
  if (!knowledge) {
    return {
      present: false,
      actors: 0,
      useCases: 0,
      features: 0,
      functionalRequirements: 0,
      nfrs: 0,
      entities: 0,
    };
  }
  return {
    present: true,
    actors: knowledge.actors?.length ?? 0,
    useCases: knowledge.useCases?.length ?? 0,
    features: knowledge.features?.length ?? 0,
    functionalRequirements: knowledge.functionalRequirements?.length ?? 0,
    nfrs: knowledge.nfrs?.length ?? 0,
    entities: knowledge.entities?.length ?? 0,
  };
}
