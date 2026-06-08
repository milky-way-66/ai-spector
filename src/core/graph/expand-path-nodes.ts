import type { GraphEdge, GraphNode } from "../../types.js";
import type { InMemoryGraph } from "./InMemoryGraph.js";

export type SyntheticNodeType = "file" | "source";

export interface SyntheticPathNode {
  id: string;
  type: SyntheticNodeType;
  path: string;
  label: string;
}

export interface ExpandPathTargetOptions {
  /** Only expand for these graph node ids (e.g. visible subgraph). */
  nodeIds?: ReadonlySet<string>;
}

export interface ExpandedPathTargets {
  syntheticNodes: SyntheticPathNode[];
  /** Edges from graph nodes to synthetic node ids (resolved `to` targets). */
  resolvedEdges: GraphEdge[];
}

export function fileNodeId(path: string): string {
  return `file:${path}`;
}

export function sourceNodeId(path: string): string {
  return `source:${path}`;
}

function basename(path: string): string {
  return path.split("/").pop() || path;
}

/**
 * Create synthetic file/source nodes for path-target edges (`rendersTo`, `derivedFrom`).
 * Use when building a canvas graph where targets are repo paths, not node ids.
 */
export function expandPathTargetNodes(
  g: InMemoryGraph,
  options: ExpandPathTargetOptions = {},
): ExpandedPathTargets {
  const activeIds = options.nodeIds;
  const pathsWithDocument = new Set<string>();
  for (const n of g.nodesById.values()) {
    if (n.type === "document" && typeof n.output === "string") {
      pathsWithDocument.add(n.output);
    }
  }

  const pathToDocId = new Map<string, string>();
  for (const n of g.nodesById.values()) {
    if (n.type === "document" && typeof n.output === "string") {
      pathToDocId.set(n.output, n.id);
    }
  }

  const fileNodes = new Map<string, SyntheticPathNode>();
  const sourceNodes = new Map<string, SyntheticPathNode>();
  const resolvedEdges: GraphEdge[] = [];

  for (const [fromId, edges] of g.outEdges) {
    if (activeIds && !activeIds.has(fromId)) {
      continue;
    }
    for (const e of edges) {
      if (e.type === "derivedFrom") {
        const sid = sourceNodeId(e.to);
        if (!sourceNodes.has(sid)) {
          sourceNodes.set(sid, {
            id: sid,
            type: "source",
            path: e.to,
            label: basename(e.to),
          });
        }
        resolvedEdges.push({ type: e.type, from: fromId, to: sid, role: e.role });
        continue;
      }
      if (e.type !== "rendersTo") {
        continue;
      }
      if (g.nodesById.has(e.to)) {
        resolvedEdges.push(e);
        continue;
      }
      if (pathsWithDocument.has(e.to)) {
        const docId = pathToDocId.get(e.to);
        if (docId) {
          resolvedEdges.push({ type: e.type, from: fromId, to: docId, role: e.role });
        }
        continue;
      }
      const fid = fileNodeId(e.to);
      if (!fileNodes.has(fid)) {
        fileNodes.set(fid, {
          id: fid,
          type: "file",
          path: e.to,
          label: basename(e.to),
        });
      }
      resolvedEdges.push({ type: e.type, from: fromId, to: fid, role: e.role });
    }
  }

  return {
    syntheticNodes: [...fileNodes.values(), ...sourceNodes.values()],
    resolvedEdges,
  };
}

/** Merge graph nodes with synthetic path nodes for visualization. */
export function nodesForVisualization(
  graphNodes: GraphNode[],
  expanded: ExpandedPathTargets,
): Array<GraphNode | SyntheticPathNode> {
  return [...graphNodes, ...expanded.syntheticNodes];
}
