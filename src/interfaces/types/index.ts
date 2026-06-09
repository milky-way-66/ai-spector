// Shared domain types — browser-safe, zero runtime, re-export only.
// Import from "ai-spector/types" in any environment.

export type {
  NodeType,
  BundleRole,
  EdgeType,
  GraphNode,
  GraphEdge,
  TraceabilityGraph,
  ValidationIssue,
} from "../../types.js";

export type {
  ProjectBundle,
  ProjectSessionOptions,
} from "../../core/graph/project.js";

export type {
  ImpactRulesFile,
  ImpactEntry,
  ImpactResult,
} from "../../core/graph/impact.js";

export type {
  GraphQueryResult,
  QueryOptions,
} from "../../core/graph/query.js";

export type {
  GraphSessionOptions,
  ResolveOriginsHints,
} from "../../core/graph/session.js";

export type { GraphHealthSummary } from "../../core/graph/health.js";
export type { LayerAuditReport } from "../../core/graph/layer-audit.js";
export type { GraphStats } from "../../core/graph/stats.js";
export type { KnowledgeCoverageReport, AnalysisKnowledge } from "../../core/graph/knowledge.js";
export type { ResolvedOrigin } from "../../core/graph/resolve.js";
