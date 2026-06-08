import type {
  AnalysisKnowledge,
  KnowledgeActor,
  KnowledgeEntity,
  KnowledgeFeature,
  KnowledgeRequirement,
  KnowledgeUseCase,
} from "ai-spector-graph";
import type { GraphEdge, GraphNode } from "../../types.js";
import { DEFAULT_LISTED_IN } from "./defaults.js";

export type {
  AnalysisKnowledge,
  KnowledgeActor,
  KnowledgeUseCase,
  KnowledgeFeature,
  KnowledgeRequirement,
  KnowledgeEntity,
} from "ai-spector-graph";

export {
  isKnowledgePayload,
  knowledgeHasDomainEntries,
} from "ai-spector-graph";

export interface ExtractPatch {
  version: 1;
  nodes: GraphNode[];
  edges: GraphEdge[];
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

