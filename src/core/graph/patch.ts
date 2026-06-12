import type { InMemoryGraph } from "./InMemoryGraph.js";
import { isPathTargetEdge } from "./path-target-edges.js";
import type { GraphEdge, GraphNode } from "@/types.js";

export interface ExtractPatch {
  version: 1;
  nodes: GraphNode[];
  edges: GraphEdge[];
}

export function normalizePatch(input: ExtractPatch | Partial<ExtractPatch>): ExtractPatch {
  return {
    version: 1,
    nodes: input.nodes ?? [],
    edges: input.edges ?? [],
  };
}

export function parseExtractPatch(json: unknown): ExtractPatch {
  if (!json || typeof json !== "object") {
    throw new Error("patch.json must be an object");
  }
  return normalizePatch(json as Partial<ExtractPatch>);
}

export interface PatchSimulationResult {
  nodesToCreate: GraphNode[];
  nodesToUpdate: GraphNode[];
  edgesToAdd: GraphEdge[];
  edgesSkipped: GraphEdge[];
  nodesSkipped: GraphNode[];
}

/**
 * Read-only preview of what merge would add (does not mutate the graph).
 * Simplified vs CLI merge — no semanticOnly / structure guards.
 */
export function simulatePatch(
  graph: InMemoryGraph,
  patchInput: ExtractPatch | Partial<ExtractPatch>,
): PatchSimulationResult {
  const patch = normalizePatch(patchInput);
  const nodesToCreate: GraphNode[] = [];
  const nodesToUpdate: GraphNode[] = [];
  const nodesSkipped: GraphNode[] = [];
  const edgesToAdd: GraphEdge[] = [];
  const edgesSkipped: GraphEdge[] = [];

  for (const node of patch.nodes) {
    const existing = graph.nodesById.get(node.id);
    if (!existing) {
      nodesToCreate.push(node);
      continue;
    }
    if (existing.type !== node.type) {
      nodesSkipped.push(node);
      continue;
    }
    nodesToUpdate.push(node);
  }

  const patchNodeIds = new Set(patch.nodes.map((n) => n.id));
  const hasEndpoint = (id: string): boolean =>
    graph.nodesById.has(id) || patchNodeIds.has(id);

  for (const edge of patch.edges) {
    if (graph.hasEdge(edge)) {
      continue;
    }
    if (!hasEndpoint(edge.from)) {
      edgesSkipped.push(edge);
      continue;
    }
    if (!isPathTargetEdge(edge.type) && !hasEndpoint(edge.to)) {
      edgesSkipped.push(edge);
      continue;
    }
    edgesToAdd.push(edge);
  }

  return {
    nodesToCreate,
    nodesToUpdate,
    edgesToAdd,
    edgesSkipped,
    nodesSkipped,
  };
}
