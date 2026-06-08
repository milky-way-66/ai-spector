import type { GraphEdge, GraphNode } from "../../types.js";
import type { InMemoryGraph } from "./InMemoryGraph.js";
import type { NodeType } from "../../types.js";
import { DEFAULT_LISTED_IN } from "./defaults.js";

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

export interface ExtractPatch {
  version: 1;
  nodes: GraphNode[];
  edges: GraphEdge[];
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

function pickNodeFields(
  item: Record<string, unknown>,
  id: string,
  type: GraphNode["type"],
): GraphNode {
  const node: GraphNode = { id, type };
  for (const [key, value] of Object.entries(item)) {
    if (key === "id" || key === "listedInSection" || key === "satisfies" || key === "tracesTo") {
      continue;
    }
    if (value !== undefined && value !== null) {
      node[key] = value;
    }
  }
  if (type === "dataEntity" && item.name && !node.title) {
    node.title = String(item.name);
  }
  return node;
}

export function knowledgeToPatch(knowledge: AnalysisKnowledge): ExtractPatch {
  const nodes: GraphNode[] = [];
  const edges: GraphEdge[] = [];

  for (const actor of knowledge.actors ?? []) {
    const section = actor.listedInSection ?? DEFAULT_LISTED_IN.actor;
    nodes.push(
      pickNodeFields(actor as unknown as Record<string, unknown>, actor.id, "actor"),
    );
    edges.push({ type: "describedIn", from: actor.id, to: section });
  }

  for (const uc of knowledge.useCases ?? []) {
    const section = uc.listedInSection ?? DEFAULT_LISTED_IN.useCase;
    nodes.push(
      pickNodeFields(uc as unknown as Record<string, unknown>, uc.id, "useCase"),
    );
    edges.push({ type: "listedIn", from: uc.id, to: section });
  }

  for (const f of knowledge.features ?? []) {
    const section = f.listedInSection ?? DEFAULT_LISTED_IN.feature;
    nodes.push(
      pickNodeFields(f as unknown as Record<string, unknown>, f.id, "feature"),
    );
    edges.push({ type: "listedIn", from: f.id, to: section });
    for (const ucId of f.satisfies ?? []) {
      edges.push({ type: "satisfies", from: f.id, to: ucId });
    }
  }

  for (const req of knowledge.functionalRequirements ?? []) {
    const section = req.listedInSection ?? DEFAULT_LISTED_IN.functionalRequirement;
    nodes.push(
      pickNodeFields(req as unknown as Record<string, unknown>, req.id, "requirement"),
    );
    edges.push({ type: "listedIn", from: req.id, to: section });
    for (const target of req.tracesTo ?? []) {
      edges.push({ type: "tracesTo", from: req.id, to: target });
    }
  }

  for (const req of knowledge.nfrs ?? []) {
    const section = req.listedInSection ?? DEFAULT_LISTED_IN.nfr;
    nodes.push(
      pickNodeFields(req as unknown as Record<string, unknown>, req.id, "nfr"),
    );
    edges.push({ type: "describedIn", from: req.id, to: section });
    for (const target of req.tracesTo ?? []) {
      edges.push({ type: "tracesTo", from: req.id, to: target });
    }
  }

  for (const ent of knowledge.entities ?? []) {
    const section = ent.listedInSection ?? DEFAULT_LISTED_IN.dataEntity;
    nodes.push(
      pickNodeFields(ent as unknown as Record<string, unknown>, ent.id, "dataEntity"),
    );
    edges.push({ type: "definedIn", from: ent.id, to: section });
  }

  return { version: 1, nodes, edges };
}
