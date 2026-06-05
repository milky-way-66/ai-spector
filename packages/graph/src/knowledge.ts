import type { InMemoryGraph } from "./InMemoryGraph.js";
import type { NodeType } from "./types.js";

export interface AnalysisKnowledge {
  knowledgeVersion?: number;
  actors?: KnowledgeActor[];
  useCases?: KnowledgeUseCase[];
  features?: KnowledgeFeature[];
  functionalRequirements?: KnowledgeRequirement[];
  nfrs?: KnowledgeRequirement[];
  entities?: KnowledgeEntity[];
}

export interface KnowledgeActor {
  id: string;
  name?: string;
  title?: string;
  description?: string;
  listedInSection?: string;
}

export interface KnowledgeUseCase {
  id: string;
  title: string;
  priority?: string;
  description?: string;
  listedInSection?: string;
}

export interface KnowledgeFeature {
  id: string;
  title: string;
  description?: string;
  listedInSection?: string;
  satisfies?: string[];
}

export interface KnowledgeRequirement {
  id: string;
  title: string;
  description?: string;
  listedInSection?: string;
  tracesTo?: string[];
}

export interface KnowledgeEntity {
  id: string;
  name: string;
  description?: string;
  listedInSection?: string;
}

export interface KnowledgeStats {
  present: boolean;
  actors: number;
  useCases: number;
  features: number;
  functionalRequirements: number;
  nfrs: number;
  entities: number;
}

export type KnowledgeCategory =
  | "actor"
  | "useCase"
  | "feature"
  | "requirement"
  | "nfr"
  | "dataEntity";

export interface KnowledgeCoverageRow {
  id: string;
  category: KnowledgeCategory;
  inGraph: boolean;
  graphNodeType?: NodeType;
  /** Raw knowledge fields for UI display (title, name, priority, satisfies, tracesTo, …). */
  data: Record<string, unknown>;
}

export interface KnowledgeCoverageCategory {
  category: KnowledgeCategory;
  label: string;
  total: number;
  inGraph: number;
  rows: KnowledgeCoverageRow[];
}

export interface KnowledgeCoverageReport {
  present: boolean;
  categories: KnowledgeCoverageCategory[];
}

const CATEGORY_META: { key: keyof AnalysisKnowledge; category: KnowledgeCategory; label: string }[] = [
  { key: "actors", category: "actor", label: "Actors" },
  { key: "useCases", category: "useCase", label: "Use cases" },
  { key: "features", category: "feature", label: "Features" },
  { key: "functionalRequirements", category: "requirement", label: "Functional requirements" },
  { key: "nfrs", category: "nfr", label: "NFRs" },
  { key: "entities", category: "dataEntity", label: "Data entities" },
];

export function isKnowledgePayload(data: unknown): data is AnalysisKnowledge {
  if (!data || typeof data !== "object") {
    return false;
  }
  const k = data as Record<string, unknown>;
  return (
    "knowledgeVersion" in k ||
    Array.isArray(k.useCases) ||
    Array.isArray(k.features) ||
    Array.isArray(k.actors)
  );
}

export function parseKnowledge(json: unknown): AnalysisKnowledge | null {
  return isKnowledgePayload(json) ? json : null;
}

export function knowledgeHasDomainEntries(knowledge: AnalysisKnowledge): boolean {
  return (
    (knowledge.useCases?.length ?? 0) > 0 ||
    (knowledge.features?.length ?? 0) > 0 ||
    (knowledge.actors?.length ?? 0) > 0 ||
    (knowledge.functionalRequirements?.length ?? 0) > 0 ||
    (knowledge.nfrs?.length ?? 0) > 0 ||
    (knowledge.entities?.length ?? 0) > 0
  );
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
    present: knowledgeHasDomainEntries(knowledge),
    actors: knowledge.actors?.length ?? 0,
    useCases: knowledge.useCases?.length ?? 0,
    features: knowledge.features?.length ?? 0,
    functionalRequirements: knowledge.functionalRequirements?.length ?? 0,
    nfrs: knowledge.nfrs?.length ?? 0,
    entities: knowledge.entities?.length ?? 0,
  };
}

function rowData(item: Record<string, unknown>): Record<string, unknown> {
  const { id: _id, ...rest } = item;
  return rest;
}

function coverageCategory(
  g: InMemoryGraph,
  label: string,
  category: KnowledgeCategory,
  items: Array<Record<string, unknown> & { id: string }> | undefined,
): KnowledgeCoverageCategory {
  const rows: KnowledgeCoverageRow[] = (items ?? []).map((item) => {
    const node = g.nodesById.get(item.id);
    return {
      id: item.id,
      category,
      inGraph: Boolean(node),
      graphNodeType: node?.type,
      data: rowData(item),
    };
  });
  const inGraph = rows.filter((r) => r.inGraph).length;
  return { category, label, total: rows.length, inGraph, rows };
}

/** Compare knowledge.json entries against merged graph nodes (parity with graph visualize Knowledge tab). */
export function knowledgeGraphCoverage(
  knowledge: AnalysisKnowledge | null,
  g: InMemoryGraph,
): KnowledgeCoverageReport {
  if (!knowledge || !knowledgeHasDomainEntries(knowledge)) {
    return { present: false, categories: [] };
  }

  const categories: KnowledgeCoverageCategory[] = [];
  for (const { key, category, label } of CATEGORY_META) {
    const items = knowledge[key] as Array<Record<string, unknown> & { id: string }> | undefined;
    if (!items?.length) {
      continue;
    }
    categories.push(coverageCategory(g, label, category, items));
  }

  return { present: true, categories };
}
