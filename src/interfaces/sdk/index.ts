// ─── Browser-safe (also works in Node) ───────────────────────────────────────
// These exports come from ai-spector/graph — no Node built-ins, safe to import
// in Vite / webpack / Next.js. Prefer "ai-spector/graph" in frontend bundles;
// the re-exports here are for Node callers who want everything in one import.

export {
  // Session classes
  GraphSession,
  ProjectSession,
  createProjectSession,        // free-function alias for ProjectSession.fromBundle()

  // Graph algorithms
  querySubgraph,
  computeImpact,
  mergeImpactResults,
  parseImpactRules,
  DEFAULT_IMPACT_RULES,

  // Audit / coverage
  auditGraphLayers,
  knowledgeGraphCoverage,
  computeKnowledgeStats,

  // Visualization helpers
  expandPathTargetNodes,
  nodesForVisualization,

  // Impact origin helpers
  resolveImpactOrigins,
  pickPrimaryImpactOrigin,

  // Registry helpers
  sectionLabel,
  registryDocuments,

  // Health
  graphHealthSummary,

  // Stats
  computeGraphStats,
} from "../../core/graph/index.js";

export type {
  // Sessions
  GraphSessionOptions,
  ResolveOriginsHints,
  ProjectBundle,
  ProjectSessionOptions,

  // Impact
  ImpactRulesFile,
  ImpactEntry,
  ImpactResult,

  // Query
  QueryOptions,
  GraphQueryResult,

  // Audit / coverage
  LayerAuditReport,
  KnowledgeCoverageReport,
  AnalysisKnowledge,
  KnowledgeStats,

  // Resolve
  ResolvedOrigin,

  // Health / stats
  GraphHealthSummary,
  GraphStats,

  // Patch
  ExtractPatch,
  PatchSimulationResult,

  // Registry
  SectionRegistry,
  RegistryDocument,

  // Translation
  TranslationJob,
  TranslationQueueStats,
  StaleTranslationLink,
} from "../../core/graph/index.js";

// Shared primitive types (also in ai-spector/types)
export type { NodeType, BundleRole, EdgeType, GraphNode, GraphEdge, TraceabilityGraph, ValidationIssue } from "../../types.js";


// ─── Node-only ────────────────────────────────────────────────────────────────
// These use the filesystem, git, or child_process. Do NOT import in browser bundles.

// Graph commands (file-backed)
export { validateGraph } from "../../core/operations/validate.js";
export { runGraphMerge } from "../../core/operations/graph-merge.js";
export type { GraphMergeOptions, GraphMergeResult } from "../../core/operations/graph-merge.js";
export { runGraphImpact, runGraphImpactFromGit } from "../../core/operations/graph-impact.js";
export type {
  GraphImpactCliOptions,
  GraphImpactResult,
  SemanticSuggestion,
} from "../../core/operations/graph-impact.js";
export { runGraphQuery } from "../../core/operations/graph-query.js";
export type { GraphQueryCliOptions } from "../../core/operations/graph-query.js";

// Index
export { runIndex } from "../../core/operations/index.js";
export type { IndexReport, IndexOptions } from "../../core/operations/index.js";

// CocoIndex
export {
  runCocoindexSetup,
  runCocoindexSearch,
  runCocoindexStats,
  runGraphQueryFuzzy,
  isCocoindexConfigured,
} from "../../core/operations/cocoindex.js";
export type {
  CocoindexSetupOptions,
  CocoindexSetupResult,
  CocoindexSearchOptions,
  CocoindexSearchResult,
  CocoindexStatsResult,
  SearchResult as CocoindexSearchHit,
  FuzzyQueryOptions,
  FuzzyQueryResult,
} from "../../core/operations/cocoindex.js";

// Reviews
export {
  runApprove,
  runReviewStatus,
  runReviewQueue,
  runReviewCheck,
  runReviewReject,
  runReviewList,
  runReviewMigrate,
} from "../../core/operations/review.js";
export type {
  ReviewApproveOptions,
  ReviewApproveResult,
  ReviewStatusOptions,
  ReviewStatusResult,
  ReviewQueueOptions,
  ReviewQueueResult,
  ReviewCheckOptions,
  ReviewCheckResult,
  ReviewRejectOptions,
  ReviewRejectResult,
  ReviewListOptions,
  ReviewListResult,
  ReviewListEntry,
  ReviewMigrateOptions,
  ReviewMigrateResult,
} from "../../core/operations/review.js";

// Workspace check
export { runCheck } from "../../core/operations/check.js";
export type {
  CheckOptions,
  CheckResult,
  CheckFinding,
  CheckSeverity,
} from "../../core/operations/check.js";

// Context store (clarifications before generation)
export {
  runContextList,
  runContextRecord,
  runContextResolve,
  contextStorePath,
} from "../../core/operations/context.js";
export type {
  ContextEntry,
  ContextStore,
  ContextEntryStatus,
  ContextEntrySource,
  ContextListOptions,
  ContextListResult,
  ContextRecordOptions,
  ContextRecordResult,
  ContextResolveOptions,
  ContextResolveResult,
} from "../../core/operations/context.js";

// Comments
export {
  runCommentsList,
  runCommentsInbox,
  runCommentsPlan,
  runCommentsShow,
  runCommentsResolve,
} from "../../core/operations/comments.js";
export type {
  CommentsListOptions,
  CommentsListResult,
  CommentsInboxOptions,
  CommentsPlanOptions,
  CommentsShowOptions,
  CommentsResolveOptions,
} from "../../core/operations/comments.js";
