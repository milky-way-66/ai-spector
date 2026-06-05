import { computeGraphStats as computeGraphStatsCore } from "ai-spector-graph";
import type { TraceabilityGraph } from "../types.js";
import type { AnalysisKnowledge } from "../graph/knowledge.js";

export type { GraphStats } from "ai-spector-graph";

export interface KnowledgeStats {
  present: boolean;
  actors: number;
  useCases: number;
  features: number;
  functionalRequirements: number;
  nfrs: number;
  entities: number;
}

export function computeGraphStats(graph: TraceabilityGraph) {
  return computeGraphStatsCore(graph);
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
