import type { EdgeType } from "@/types.js";

/** Edges whose `to` is a repo-relative path or external id, not a graph node id. */
export const PATH_TARGET_EDGE_TYPES: ReadonlySet<EdgeType> = new Set([
  "rendersTo",
  "derivedFrom",
]);

export function isPathTargetEdge(type: EdgeType): boolean {
  return PATH_TARGET_EDGE_TYPES.has(type);
}
