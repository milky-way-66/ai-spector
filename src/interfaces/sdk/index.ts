// Graph domain — re-exported from ai-spector-graph workspace package
export { querySubgraph, computeImpact } from "ai-spector-graph";
export type {
  GraphQueryResult,
  ImpactResult,
  LayerAuditReport,
  ResolvedOrigin,
} from "ai-spector-graph";

// Graph commands
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
  runGraphQueryFuzzy,
  isCocoindexConfigured,
} from "../../core/operations/cocoindex.js";
export type {
  CocoindexSetupOptions,
  CocoindexSetupResult,
  CocoindexSearchOptions,
  CocoindexSearchResult,
  SearchResult as CocoindexSearchHit,
  FuzzyQueryOptions,
  FuzzyQueryResult,
} from "../../core/operations/cocoindex.js";

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

