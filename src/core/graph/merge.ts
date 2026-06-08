import type { GraphEdge, GraphNode, NodeType } from "../../types.js";
import { isPathTargetEdge } from "./path-target-edges.js";
import { allowsSectionUpsertParent } from "./detail-sections.js";
import { InMemoryGraph } from "./InMemoryGraph.js";
import type { ExtractPatch } from "./knowledge.js";

const STRUCTURE_TYPES = new Set<NodeType>([
  "document",
  "section",
  "table",
  "diagram",
]);
const HUB_TYPES = new Set<NodeType>(["bundle", "sourceFile"]);
const DOMAIN_TYPES = new Set<NodeType>([
  "actor",
  "useCase",
  "feature",
  "requirement",
  "nfr",
  "dataEntity",
]);

const STRUCTURE_CREATE_TYPES = new Set<NodeType>([
  "document",
  "section",
  "table",
  "diagram",
]);

const SEMANTIC_EDGE_TYPES = new Set<GraphEdge["type"]>(["relatesTo", "references"]);

const RELATES_TO_ENDPOINT_TYPES = new Set<NodeType>([
  ...DOMAIN_TYPES,
  "section",
  "sourceFile",
  "bundle",
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

export interface MergePatchOptions {
  /** Agent semantic patch: no structure nodes; only relatesTo/references + domain field updates. */
  semanticOnly?: boolean;
  /** Source path of the patch file, shown in error messages. */
  patchSourcePath?: string;
}

export function normalizePatch(input: ExtractPatch | Partial<ExtractPatch>): ExtractPatch {
  return {
    version: 1,
    nodes: input.nodes ?? [],
    edges: input.edges ?? [],
  };
}

const PATCH_NODE_ORDER: Record<string, number> = {
  bundle: -2,
  sourceFile: -1,
  document: 0,
  actor: 1,
  useCase: 1,
  feature: 1,
  requirement: 1,
  dataEntity: 1,
  section: 2,
  table: 3,
  diagram: 3,
};

function patchNodeSortKey(node: GraphNode): number {
  return PATCH_NODE_ORDER[node.type] ?? 9;
}

export function mergePatch(
  graph: InMemoryGraph,
  patch: ExtractPatch,
  options?: MergePatchOptions,
): MergeResult {
  const stats: MergeStats = {
    nodesCreated: 0,
    nodesUpdated: 0,
    edgesAdded: 0,
    nodesSkipped: 0,
  };

  if (options?.semanticOnly) {
    validateSemanticPatch(patch);
  }

  const sortedNodes = [...patch.nodes].sort(
    (a, b) => patchNodeSortKey(a) - patchNodeSortKey(b),
  );

  for (const node of sortedNodes) {
    if (options?.semanticOnly && STRUCTURE_CREATE_TYPES.has(node.type)) {
      throw new Error(
        `Semantic patch cannot create structure node ${node.id} (${node.type})`,
      );
    }

    if (node.type === "section") {
      const parentDoc = graph.nodesById.get(String(node.documentId ?? ""));
      if (parentDoc && allowsSectionUpsertParent(parentDoc)) {
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
    if (HUB_TYPES.has(node.type) || node.type === "document") {
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
    if (options?.semanticOnly && !SEMANTIC_EDGE_TYPES.has(edge.type)) {
      throw new Error(
        `Semantic patch edge type not allowed: ${edge.type} (use relatesTo or references)`,
      );
    }
    if (skipPatchEdgeIfEndpointsMissing(graph, edge)) {
      continue;
    }
    assertMergeEdgeAllowed(graph, edge, options?.patchSourcePath);
    if (graph.addEdgeIfAbsent(edge)) {
      stats.edgesAdded++;
    }
  }

  return { graph, stats };
}

/**
 * Fallback when an edge references a node not in this patch or graph yet (e.g. optional
 * projection-only ids). Doc-extract now emits basic-design anchor documents before edges.
 */
export function skipPatchEdgeIfEndpointsMissing(
  graph: InMemoryGraph,
  edge: GraphEdge,
): boolean {
  const from = graph.nodesById.get(edge.from);
  if (isPathTargetEdge(edge.type)) {
    return !from;
  }
  const to = graph.nodesById.get(edge.to);
  if (
    edge.type === "partOf" ||
    edge.type === "contains" ||
    edge.type === "follows" ||
    edge.type === "tracesTo"
  ) {
    return !from || !to;
  }
  // listedIn: skip gracefully when the list-anchor section doesn't exist in the graph
  // (common with custom packs whose defaultListedIn differs from builtin sections)
  if (edge.type === "listedIn") {
    const to = graph.nodesById.get(edge.to);
    return !from || !to;
  }
  return false;
}

function validateSemanticPatch(patch: ExtractPatch): void {
  for (const node of patch.nodes) {
    if (STRUCTURE_CREATE_TYPES.has(node.type)) {
      throw new Error(
        `Semantic patch cannot add structure node ${node.id} (${node.type})`,
      );
    }
    if (HUB_TYPES.has(node.type)) {
      throw new Error(`Semantic patch cannot add hub node ${node.id}`);
    }
  }
}

function missingNodeError(nodeId: string, role: "source" | "target", edge: GraphEdge, patchSourcePath?: string): Error {
  const edgeJson = JSON.stringify(edge);
  const patchLine = patchSourcePath ? `\nPatch file: ${patchSourcePath}` : "";
  return new Error(
    `Merge edge missing ${role} node: ${nodeId}\n\n` +
    `${nodeId} does not exist in the graph yet.\n` +
    `To create it:\n` +
    `  1. Add ${nodeId} to knowledge.json, then run:\n` +
    `       npx ai-spector graph merge --from-knowledge\n` +
    `  2. Then retry the patch merge.\n` +
    `  Or use --with-knowledge to merge knowledge.json automatically before applying the patch.\n` +
    `\nFailing edge: ${edgeJson}${patchLine}`,
  );
}

function assertMergeEdgeAllowed(graph: InMemoryGraph, edge: GraphEdge, patchSourcePath?: string): void {
  if (edge.type === "relatesTo") {
    assertRelatesToEdge(graph, edge, patchSourcePath);
    return;
  }

  const from = graph.nodesById.get(edge.from);

  if (isPathTargetEdge(edge.type)) {
    if (!from) {
      throw missingNodeError(edge.from, "source", edge, patchSourcePath);
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
    throw missingNodeError(edge.from, "source", edge, patchSourcePath);
  }
  if (!to) {
    throw missingNodeError(edge.to, "target", edge, patchSourcePath);
  }

  if (STRUCTURE_TYPES.has(to.type)) {
    const allowedToStructure = new Set([
      "listedIn",
      "definedIn",
      "describedIn",
      "references",
      "dependsOn",
      "tracesTo",
      "contains",
      "partOf",
      "follows",
    ]);
    if (!allowedToStructure.has(edge.type)) {
      throw new Error(
        `Edge ${edge.type} cannot target structure node ${edge.to}`,
      );
    }
  }

  if (HUB_TYPES.has(to.type) || HUB_TYPES.has(from.type)) {
    const allowedHub = new Set(["contains", "partOf", "relatesTo", "references"]);
    if (!allowedHub.has(edge.type)) {
      throw new Error(
        `Edge ${edge.type} cannot connect hub nodes ${edge.from} → ${edge.to}`,
      );
    }
  }
}

function assertRelatesToEdge(graph: InMemoryGraph, edge: GraphEdge, patchSourcePath?: string): void {
  const from = graph.nodesById.get(edge.from);
  const to = graph.nodesById.get(edge.to);
  if (!from) {
    throw missingNodeError(edge.from, "source", edge, patchSourcePath);
  }
  if (!to) {
    throw missingNodeError(edge.to, "target", edge, patchSourcePath);
  }
  if (!RELATES_TO_ENDPOINT_TYPES.has(from.type)) {
    throw new Error(`relatesTo invalid source type ${from.type}: ${edge.from}`);
  }
  if (!RELATES_TO_ENDPOINT_TYPES.has(to.type)) {
    throw new Error(`relatesTo invalid target type ${to.type}: ${edge.to}`);
  }
}
