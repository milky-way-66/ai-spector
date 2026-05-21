import type { GraphEdge, GraphNode, NodeType } from "../types.js";
import { isPathTargetEdge } from "./path-target-edges.js";
import { isPerDomainInstanceDocument } from "./detail-sections.js";
import { InMemoryGraph } from "./InMemoryGraph.js";
import type { ExtractPatch } from "./knowledge.js";

const STRUCTURE_TYPES = new Set<NodeType>(["document", "section", "table", "diagram"]);
const DOMAIN_TYPES = new Set<NodeType>([
  "actor",
  "useCase",
  "feature",
  "requirement",
  "dataEntity",
]);

export interface MergeStats {
  nodesCreated: number;
  nodesUpdated: number;
  edgesAdded: number;
  nodesSkipped: number;
}

export interface MergeResult {
  graph: InMemoryGraph;
  stats: MergeStats;
}

export function normalizePatch(input: ExtractPatch | Partial<ExtractPatch>): ExtractPatch {
  return {
    version: 1,
    nodes: input.nodes ?? [],
    edges: input.edges ?? [],
  };
}

export function mergePatch(graph: InMemoryGraph, patch: ExtractPatch): MergeResult {
  const stats: MergeStats = {
    nodesCreated: 0,
    nodesUpdated: 0,
    edgesAdded: 0,
    nodesSkipped: 0,
  };

  for (const node of patch.nodes) {
    if (node.type === "section") {
      const parentDoc = graph.nodesById.get(String(node.documentId ?? ""));
      if (parentDoc && isPerDomainInstanceDocument(parentDoc)) {
        const outcome = graph.upsertNode(node);
        if (outcome === "created") {
          stats.nodesCreated++;
        } else {
          stats.nodesUpdated++;
        }
      } else {
        stats.nodesSkipped++;
      }
      continue;
    }
    if (node.type === "table" || node.type === "diagram") {
      stats.nodesSkipped++;
      continue;
    }
    if (node.type === "document") {
      const outcome = graph.upsertNode(node);
      if (outcome === "created") {
        stats.nodesCreated++;
      } else {
        stats.nodesUpdated++;
      }
      continue;
    }
    if (!DOMAIN_TYPES.has(node.type)) {
      throw new Error(`Patch node ${node.id} has unsupported type: ${node.type}`);
    }
    const outcome = graph.upsertNode(node);
    if (outcome === "created") {
      stats.nodesCreated++;
    } else {
      stats.nodesUpdated++;
    }
  }

  for (const edge of patch.edges) {
    assertMergeEdgeAllowed(graph, edge);
    if (graph.addEdgeIfAbsent(edge)) {
      stats.edgesAdded++;
    }
  }

  return { graph, stats };
}

function assertMergeEdgeAllowed(graph: InMemoryGraph, edge: GraphEdge): void {
  const from = graph.nodesById.get(edge.from);

  if (isPathTargetEdge(edge.type)) {
    if (!from) {
      throw new Error(`${edge.type} missing source node: ${edge.from}`);
    }
    if (edge.type === "rendersTo") {
      if (
        from.type === "document" ||
        from.type === "section" ||
        DOMAIN_TYPES.has(from.type)
      ) {
        return;
      }
      throw new Error(
        `rendersTo source must be document, section, or domain node: ${edge.from}`,
      );
    }
    if (edge.type === "derivedFrom" && DOMAIN_TYPES.has(from.type)) {
      return;
    }
    throw new Error(
      `${edge.type} source must be a domain node (or document/section for rendersTo): ${edge.from}`,
    );
  }

  const to = graph.nodesById.get(edge.to);

  if (!from) {
    throw new Error(`Merge edge missing source node: ${edge.from}`);
  }
  if (!to) {
    throw new Error(`Merge edge missing target node: ${edge.to}`);
  }

  if (STRUCTURE_TYPES.has(to.type)) {
    const allowedToStructure = new Set([
      "listedIn",
      "definedIn",
      "describedIn",
      "references",
      "dependsOn",
      "contains",
      "partOf",
    ]);
    if (!allowedToStructure.has(edge.type)) {
      throw new Error(
        `Edge ${edge.type} cannot target structure node ${edge.to}`,
      );
    }
  }
}
