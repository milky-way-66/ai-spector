// Graph domain — re-exported from ai-spector-graph workspace package
export { querySubgraph, computeImpact } from "ai-spector-graph";
export type {
  GraphQueryResult,
  ImpactResult,
  LayerAuditReport,
  ResolvedOrigin,
} from "ai-spector-graph";

// Graph commands
export { validateGraph } from "../../commands/validate.js";
export { runGraphMerge } from "../../commands/graph-merge.js";
export type { GraphMergeOptions, GraphMergeResult } from "../../commands/graph-merge.js";
export { runGraphImpact, runGraphImpactFromGit } from "../../commands/graph-impact.js";
export type { GraphImpactCliOptions } from "../../commands/graph-impact.js";
export { runGraphQuery } from "../../commands/graph-query.js";
export type { GraphQueryCliOptions } from "../../commands/graph-query.js";

// Index
export { runIndex } from "../../commands/index.js";
export type { IndexReport, IndexOptions } from "../../commands/index.js";

// Comments
export {
  runCommentsList,
  runCommentsInbox,
  runCommentsPlan,
  runCommentsShow,
  runCommentsResolve,
} from "../../commands/comments.js";
export type {
  CommentsListOptions,
  CommentsListResult,
  CommentsInboxOptions,
  CommentsPlanOptions,
  CommentsShowOptions,
  CommentsResolveOptions,
} from "../../commands/comments.js";

