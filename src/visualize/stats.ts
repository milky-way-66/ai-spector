import { computeGraphStats as computeGraphStatsCore } from "ai-spector-graph";
import {
  computeKnowledgeStats as computeKnowledgeStatsCore,
  type KnowledgeStats,
} from "ai-spector-graph";
import type { TraceabilityGraph } from "../types.js";
import type { AnalysisKnowledge } from "../graph/knowledge.js";

export type { GraphStats } from "ai-spector-graph";
export type { KnowledgeStats };

export function computeGraphStats(graph: TraceabilityGraph) {
  return computeGraphStatsCore(graph);
}

export function computeKnowledgeStats(
  knowledge: AnalysisKnowledge | null,
): KnowledgeStats {
  return computeKnowledgeStatsCore(knowledge);
}
