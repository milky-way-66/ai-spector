export { GraphSession } from "./session.js";
export type {
  GraphSessionOptions,
  ResolveOriginsHints,
  ImpactOptions,
} from "./session.js";

export { ProjectSession } from "./project.js";
export type { ProjectBundle, ProjectSessionOptions } from "./project.js";

export {
  isKnowledgePayload,
  parseKnowledge,
  knowledgeHasDomainEntries,
  computeKnowledgeStats,
  knowledgeGraphCoverage,
} from "./knowledge.js";
export type {
  AnalysisKnowledge,
  KnowledgeActor,
  KnowledgeUseCase,
  KnowledgeFeature,
  KnowledgeRequirement,
  KnowledgeEntity,
  KnowledgeStats,
  KnowledgeCategory,
  KnowledgeCoverageRow,
  KnowledgeCoverageCategory,
  KnowledgeCoverageReport,
} from "./knowledge.js";

export {
  parseSectionRegistry,
  findRegistryDocument,
  findRegistrySection,
  sectionHeading,
  sectionLabel,
  documentTemplate,
  registryDocuments,
  allRegistrySections,
} from "./registry.js";
export type {
  RegistrySection,
  RegistryDocument,
  SectionRegistry,
} from "./registry.js";

export {
  parseDocflowConfig,
  primaryLanguage,
  languageCodes,
} from "./config.js";
export type {
  DocflowConfig,
  DocflowProjectPaths,
  LanguageConfig,
} from "./config.js";

export {
  parseProjectState,
  lastIndexRunAt,
  lastGraphMergedAt,
} from "./state.js";
export type {
  ProjectState,
  ProjectAnalysisState,
  ProjectIndexState,
} from "./state.js";

export {
  auditGraphLayers,
  BUNDLE_SOURCE_ID,
  BUNDLE_BUSINESS_ID,
} from "./layer-audit.js";
export type {
  LayerAuditLayers,
  LayerAuditReport,
  LayerAuditOptions,
} from "./layer-audit.js";

export {
  normalizePatch,
  parseExtractPatch,
  simulatePatch,
} from "./patch.js";
export type { ExtractPatch, PatchSimulationResult } from "./patch.js";

export {
  parseDocFilePath,
  resolveDocPath,
  jobGroupKey,
  parsePendingQueue,
  parseFailedJobs,
  parseResolvedJobs,
  parseFingerprints,
  parseTranslationQueueBundle,
  computeTranslationQueueStats,
  jobsForProjectionPath,
  linkStaleTranslationsToQueue,
  pendingTargetLangs,
} from "./translation-queue.js";
export type {
  SyncDirection,
  FailReason,
  DocType,
  FileChangeRecord,
  TranslationTarget,
  TranslationJob,
  PendingQueueFile,
  ResolvedTranslationJob,
  FailedTranslationJob,
  FileFingerprint,
  FingerprintsFile,
  TranslationQueueBundleInput,
  TranslationQueueData,
  TranslationQueueStats,
  StaleTranslationLink,
} from "./translation-queue.js";

export {
  summarizeValidation,
  layersNeedingWork,
  graphHealthSummary,
} from "./health.js";
export type { GraphHealthSummary } from "./health.js";

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
} from "../../types.js";
