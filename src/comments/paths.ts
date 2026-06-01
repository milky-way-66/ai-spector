import { join } from "node:path";

const COMMENTS_ROOT = "comments";

/** Strip leading/trailing slashes and `docs/` prefix from logical paths. */
export function normalizeLogicalPath(filePath: string): string {
  let p = filePath.trim().replace(/\\/g, "/");
  p = p.replace(/^\/+|\/+$/g, "");
  if (p.startsWith("docs/")) {
    p = p.slice("docs/".length);
  }
  if (p.endsWith(".md")) {
    p = p.slice(0, -3);
  }
  return p;
}

/**
 * Map comment logical_path (e.g. `srs/01-overview`) to repo-relative doc file.
 * Returns null when the prefix is unknown.
 */
export function logicalPathToDocPath(logicalPath: string): string | null {
  const p = normalizeLogicalPath(logicalPath);
  if (!p) {
    return null;
  }
  if (p.startsWith("srs/") || p === "srs") {
    return `docs/srs/${p === "srs" ? "" : p.slice("srs/".length)}.md`.replace(
      /\/\.md$/,
      ".md",
    );
  }
  if (p.startsWith("basic-design/") || p.startsWith("bd/")) {
    const rest = p.startsWith("basic-design/")
      ? p.slice("basic-design/".length)
      : p.slice("bd/".length);
    return `docs/basic-design/${rest}.md`;
  }
  if (p.startsWith("detail-design/") || p.startsWith("dd/")) {
    const rest = p.startsWith("detail-design/")
      ? p.slice("detail-design/".length)
      : p.slice("dd/".length);
    return `docs/detail-design/${rest}.md`;
  }
  return null;
}

export function commentsRootRel(): string {
  return COMMENTS_ROOT;
}

export function threadDirRel(logicalPath: string, threadId: string): string {
  const lp = normalizeLogicalPath(logicalPath);
  return join(COMMENTS_ROOT, lp, threadId).replace(/\\/g, "/");
}

export function threadMetaRel(logicalPath: string, threadId: string): string {
  return `${threadDirRel(logicalPath, threadId)}/meta_data.json`;
}

export function threadEventsRel(logicalPath: string, threadId: string): string {
  return `${threadDirRel(logicalPath, threadId)}/events.jsonl`;
}
