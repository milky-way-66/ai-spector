import { computeGraphStats as computeGraphStatsCore } from "../graph/stats.js";
import {
  computeKnowledgeStats as computeKnowledgeStatsCore,
  type KnowledgeStats,
} from "../graph/knowledge.js";
import type { TraceabilityGraph } from "@/types.js";
import type { AnalysisKnowledge } from "../graph/knowledge.js";

export type { GraphStats } from "../graph/stats.js";
export type { KnowledgeStats };

export function computeGraphStats(graph: TraceabilityGraph) {
  return computeGraphStatsCore(graph);
}

export function computeKnowledgeStats(
  knowledge: AnalysisKnowledge | null,
): KnowledgeStats {
  return computeKnowledgeStatsCore(knowledge);
}
