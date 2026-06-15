import { normalizeLogicalPath } from "../comments/paths.js";

/** Map a review logical path prefix to a docflow doc type id. */
export function docTypeFromLogicalPath(logicalPath: string): string | null {
  const p = normalizeLogicalPath(logicalPath);
  if (!p) return null;
  if (p === "srs" || p.startsWith("srs/")) return "srs";
  if (p === "basic-design" || p.startsWith("basic-design/") || p.startsWith("bd/")) {
    return "basic-design";
  }
  if (p === "detail-design" || p.startsWith("detail-design/") || p.startsWith("dd/")) {
    return "detail-design";
  }
  return null;
}
