import {
  languageCodes,
  parseDocflowConfig,
  primaryLanguage,
  type DocflowConfig,
  type LanguageConfig,
} from "./config.js";
import { graphHealthSummary, type GraphHealthSummary } from "./health.js";
import type { ImpactResult, ImpactRulesFile } from "./impact.js";
import {
  auditGraphLayers,
  type LayerAuditOptions,
  type LayerAuditReport,
} from "./layer-audit.js";
import {
  computeKnowledgeStats,
  knowledgeGraphCoverage,
  parseKnowledge,
  type AnalysisKnowledge,
  type KnowledgeCoverageReport,
  type KnowledgeStats,
} from "./knowledge.js";
import { normalizePatch, simulatePatch, type ExtractPatch, type PatchSimulationResult } from "./patch.js";
import {
  parseSectionRegistry,
  registryDocuments,
  sectionLabel,
  type RegistryDocument,
  type SectionRegistry,
} from "./registry.js";
import { GraphSession, type GraphSessionOptions } from "./session.js";
import {
  lastGraphMergedAt,
  lastIndexRunAt,
  parseProjectState,
  type ProjectState,
} from "./state.js";
import {
  computeTranslationQueueStats,
  linkStaleTranslationsToQueue,
  jobsForProjectionPath,
  parseTranslationQueueBundle,
  type StaleTranslationLink,
  type TranslationJob,
  type TranslationQueueBundleInput,
  type TranslationQueueData,
  type TranslationQueueStats,
} from "./translation-queue.js";
import type { TraceabilityGraph, ValidationIssue } from "../../types.js";

export interface ProjectBundle {
  graph: TraceabilityGraph;
  impactRules?: ImpactRulesFile;
  /** Parsed or raw knowledge.json */
  knowledge?: unknown;
  /** Parsed or raw section-registry.json */
  registry?: unknown;
  /** Parsed or raw docflow.config.json */
  config?: unknown;
  /** Parsed or raw .ai-spector/.docflow/state.json */
  state?: unknown;
  /** Translation queue JSON from `.ai-spector/.docflow/translation-queue/` */
  translationQueue?: TranslationQueueBundleInput;
}

export interface ProjectSessionOptions extends GraphSessionOptions {
  knowledge?: AnalysisKnowledge | null;
  registry?: SectionRegistry | null;
  config?: DocflowConfig | null;
  state?: ProjectState | null;
  translationQueue?: TranslationQueueData | null;
}

/**
 * Multi-file project facade: graph + optional knowledge + section registry.
 * Pass JSON your API fetched; no HTTP inside this class.
 */
export class ProjectSession {
  readonly graph: GraphSession;
  private readonly knowledge: AnalysisKnowledge | null;
  private readonly registry: SectionRegistry | null;
  private readonly config: DocflowConfig | null;
  private readonly state: ProjectState | null;
  private readonly translationQueue: TranslationQueueData | null;

  private constructor(
    graph: GraphSession,
    knowledge: AnalysisKnowledge | null,
    registry: SectionRegistry | null,
    config: DocflowConfig | null,
    state: ProjectState | null,
    translationQueue: TranslationQueueData | null,
  ) {
    this.graph = graph;
    this.knowledge = knowledge;
    this.registry = registry;
    this.config = config;
    this.state = state;
    this.translationQueue = translationQueue;
  }

  static fromBundle(bundle: ProjectBundle): ProjectSession {
    const knowledge =
      bundle.knowledge === undefined ? null : parseKnowledge(bundle.knowledge);
    const registry =
      bundle.registry === undefined ? null : parseSectionRegistry(bundle.registry);
    const config =
      bundle.config === undefined ? null : parseDocflowConfig(bundle.config);
    const state =
      bundle.state === undefined ? null : parseProjectState(bundle.state);
    const translationQueue =
      bundle.translationQueue === undefined
        ? null
        : parseTranslationQueueBundle(bundle.translationQueue);

    const graph = GraphSession.fromJson(bundle.graph, {
      impactRules: bundle.impactRules,
    });
    return new ProjectSession(graph, knowledge, registry, config, state, translationQueue);
  }

  static create(
    graph: TraceabilityGraph,
    options?: ProjectSessionOptions,
  ): ProjectSession {
    const graphSession = GraphSession.fromJson(graph, {
      impactRules: options?.impactRules,
    });
    return new ProjectSession(
      graphSession,
      options?.knowledge ?? null,
      options?.registry ?? null,
      options?.config ?? null,
      options?.state ?? null,
      options?.translationQueue ?? null,
    );
  }

  hasKnowledge(): boolean {
    return this.knowledge !== null;
  }

  hasRegistry(): boolean {
    return this.registry !== null;
  }

  hasConfig(): boolean {
    return this.config !== null;
  }

  hasState(): boolean {
    return this.state !== null;
  }

  hasTranslationQueue(): boolean {
    return this.translationQueue !== null;
  }

  getKnowledge(): AnalysisKnowledge | null {
    return this.knowledge;
  }

  getRegistry(): SectionRegistry | null {
    return this.registry;
  }

  getConfig(): DocflowConfig | null {
    return this.config;
  }

  getState(): ProjectState | null {
    return this.state;
  }

  getTranslationQueue(): TranslationQueueData | null {
    return this.translationQueue;
  }

  knowledgeStats(): KnowledgeStats {
    return computeKnowledgeStats(this.knowledge);
  }

  knowledgeCoverage(): KnowledgeCoverageReport {
    return knowledgeGraphCoverage(this.knowledge, this.graph.graph);
  }

  sectionLabel(sectionId: string): string | undefined {
    if (!this.registry) {
      return undefined;
    }
    return sectionLabel(this.registry, sectionId);
  }

  registryDocuments(): RegistryDocument[] {
    if (!this.registry) {
      return [];
    }
    return registryDocuments(this.registry);
  }

  languages(): LanguageConfig[] {
    return this.config?.languages ?? [];
  }

  primaryLanguage(): LanguageConfig | undefined {
    return this.config ? primaryLanguage(this.config) : undefined;
  }

  languageCodes(): string[] {
    return this.config ? languageCodes(this.config) : [];
  }

  graphFilePath(): string | undefined {
    return this.config?.paths.graph;
  }

  lastIndexRunAt(): string | undefined {
    return this.state ? lastIndexRunAt(this.state) : undefined;
  }

  lastGraphMergedAt(): string | undefined {
    return this.state ? lastGraphMergedAt(this.state) : undefined;
  }

  layerAudit(options?: LayerAuditOptions): LayerAuditReport {
    return auditGraphLayers(this.graph.graph, options);
  }

  simulatePatch(patch: ExtractPatch | Partial<ExtractPatch>): PatchSimulationResult {
    return simulatePatch(this.graph.graph, patch);
  }

  validationIssues(): ValidationIssue[] {
    return this.graph.graph.validateStructure();
  }

  healthSummary(options?: LayerAuditOptions): GraphHealthSummary {
    return graphHealthSummary(
      this.graph.graph,
      auditGraphLayers(this.graph.graph, options),
    );
  }

  translationQueueStats(): TranslationQueueStats {
    return computeTranslationQueueStats(
      this.translationQueue ?? {
        pending: [],
        failed: [],
        resolved: [],
        fingerprints: null,
      },
    );
  }

  pendingTranslationJobs(): TranslationJob[] {
    return this.translationQueue?.pending ?? [];
  }

  failedTranslationJobs() {
    return this.translationQueue?.failed ?? [];
  }

  jobsForProjectionPath(projectionPath: string): TranslationJob[] {
    return jobsForProjectionPath(this.pendingTranslationJobs(), projectionPath);
  }

  linkStaleTranslations(impact: ImpactResult): StaleTranslationLink[] {
    return linkStaleTranslationsToQueue(impact, this.pendingTranslationJobs());
  }
}
