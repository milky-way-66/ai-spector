export { GraphSession } from "./session.js";
export type {
  GraphSessionOptions,
  ResolveOriginsHints,
  ImpactOptions,
} from "./session.js";

export { InMemoryGraph } from "./InMemoryGraph.js";
export {
  PATH_TARGET_EDGE_TYPES,
  isPathTargetEdge,
} from "./path-target-edges.js";

export {
  querySubgraph,
  resolveDocumentForNode,
  projectionPathForNode,
  dataSourcePathsForNode,
} from "./query.js";
export type { QueryOptions, GraphQueryResult } from "./query.js";

export {
  computeImpact,
  mergeImpactResults,
  parseImpactRules,
  DEFAULT_IMPACT_RULES,
} from "./impact.js";
export type {
  ImpactRulesFile,
  ImpactEntry,
  ImpactResult,
} from "./impact.js";

export {
  resolveImpactOrigins,
  pickPrimaryImpactOrigin,
  findDocumentNodeIdForPath,
  findSectionNodeIdByAnchor,
  findSectionNodeIdsByHeading,
  findNodeIdsByText,
  looksLikeExplicitNodeId,
  globToRegExp,
} from "./resolve.js";
export type { ResolveHints, ResolvedOrigin } from "./resolve.js";

export { computeGraphStats } from "./stats.js";
export type { GraphStats } from "./stats.js";

export {
  expandPathTargetNodes,
  nodesForVisualization,
  fileNodeId,
  sourceNodeId,
} from "./expand-path-nodes.js";
export type {
  SyntheticPathNode,
  SyntheticNodeType,
  ExpandPathTargetOptions,
  ExpandedPathTargets,
} from "./expand-path-nodes.js";

export type {
  NodeType,
  EdgeType,
  GraphNode,
  GraphEdge,
  TraceabilityGraph,
  ValidationIssue,
} from "./types.js";
