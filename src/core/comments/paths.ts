import { join } from "node:path";
import { DEFAULT_DOCOPS_PATHS, LEGACY_DOCOPS_PATHS } from "../docops/paths.js";
import { loadOrDeriveDocopsConfig } from "../docops/config.js";

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

/** Map prototype thread filePath (e.g. `prototype/src/login.html`) to repo HTML path. */
export function logicalPathToPrototypePath(logicalPath: string): string | null {
  const p = normalizeLogicalPath(logicalPath);
  if (!p.startsWith("prototype/")) {
    return null;
  }
  return p;
}

/** Doc or prototype repo-relative path for a thread's logical filePath. */
export function logicalPathToTargetPath(logicalPath: string): string | null {
  return logicalPathToDocPath(logicalPath) ?? logicalPathToPrototypePath(logicalPath);
}

export function isPrototypeLogicalPath(logicalPath: string): boolean {
  const p = normalizeLogicalPath(logicalPath);
  return p === "prototype" || p.startsWith("prototype/");
}

/** Screen stem from bundle-relative prototype URL (e.g. `src/login.html` → `login`). */
export function screenStemFromPrototypeUrl(url: string): string {
  const base = url.split("/").pop() ?? url;
  const stem = base.replace(/\.html?$/i, "");
  return stem || "index";
}

/** Match list/inbox filePath filter — `prototype` aggregates all URL subfolders. */
export function matchesFilePathFilter(logicalPath: string, fileFilter: string): boolean {
  const lp = normalizeLogicalPath(logicalPath);
  const ff = normalizeLogicalPath(fileFilter);
  if (ff === "prototype") {
    return lp.startsWith("prototype/");
  }
  return lp === ff;
}

/** Default comments root under the Writer `.docops/` contract. */
export function commentsRootRel(commentsRoot: string = DEFAULT_DOCOPS_PATHS.comments): string {
  return commentsRoot;
}

export function legacyCommentsRootRel(): string {
  return LEGACY_DOCOPS_PATHS.comments;
}

/** Resolve the comments root for a project from its docops config. */
export async function resolveCommentsRoot(projectRoot: string): Promise<string> {
  const config = await loadOrDeriveDocopsConfig(projectRoot);
  return config.paths.comments;
}

export function threadDirRel(
  logicalPath: string,
  threadId: string,
  commentsRoot: string = DEFAULT_DOCOPS_PATHS.comments,
): string {
  const lp = normalizeLogicalPath(logicalPath);
  return join(commentsRoot, lp, threadId).replace(/\\/g, "/");
}

export function threadMetaRel(
  logicalPath: string,
  threadId: string,
  commentsRoot: string = DEFAULT_DOCOPS_PATHS.comments,
): string {
  return `${threadDirRel(logicalPath, threadId, commentsRoot)}/meta_data.json`;
}

export function threadEventsRel(
  logicalPath: string,
  threadId: string,
  commentsRoot: string = DEFAULT_DOCOPS_PATHS.comments,
): string {
  return `${threadDirRel(logicalPath, threadId, commentsRoot)}/events.jsonl`;
}
