import { discoverMarkdownFiles } from "../index/docs-build.js";
import { loadDocflowConfig } from "../config/load.js";
import { normalizeLogicalPath } from "../comments/paths.js";

export interface DiscoveredReviewDoc {
  logicalPath: string;
  docPath: string;
  contentHash: string;
}

const DOC_ROOTS = [
  { root: "docs/srs", logicalPrefix: "srs" },
  { root: "docs/basic-design", logicalPrefix: "basic-design" },
  { root: "docs/detail-design", logicalPrefix: "detail-design" },
] as const;

/**
 * Map a repo-relative doc path (e.g. docs/srs/en/1-introduction.md) to a logical path.
 * Strips configured language subfolders when present.
 */
export function docRelPathToLogicalPath(
  docRelPath: string,
  languageCodes: string[],
): string | null {
  const normalized = docRelPath.replace(/\\/g, "/");
  if (!normalized.startsWith("docs/") || !normalized.endsWith(".md")) {
    return null;
  }

  const withoutExt = normalized.slice("docs/".length, -3);
  const parts = withoutExt.split("/");
  if (parts.length < 2) {
    return null;
  }

  const [prefix, ...rest] = parts;
  const logicalPrefix =
    prefix === "bd"
      ? "basic-design"
      : prefix === "dd"
        ? "detail-design"
        : prefix;

  if (!["srs", "basic-design", "detail-design"].includes(logicalPrefix)) {
    return null;
  }

  let segments = rest;
  if (segments.length > 0 && languageCodes.includes(segments[0]!)) {
    segments = segments.slice(1);
  }
  if (segments.length === 0) {
    return null;
  }

  return `${logicalPrefix}/${segments.join("/")}`;
}

/**
 * Walk doc output folders and return reviewable documents on disk.
 * Does not depend on graph, index, or task state.
 */
export async function discoverReviewableDocs(projectRoot: string): Promise<DiscoveredReviewDoc[]> {
  let languageCodes: string[] = [];
  try {
    const { config } = await loadDocflowConfig(projectRoot);
    languageCodes = config.languages.map((l) => l.code);
  } catch {
    languageCodes = ["en"];
  }

  const byLogical = new Map<string, DiscoveredReviewDoc>();

  for (const { root } of DOC_ROOTS) {
    const files = await discoverMarkdownFiles(projectRoot, root);
    for (const file of files) {
      const logicalPath = docRelPathToLogicalPath(file.relativePath, languageCodes);
      if (!logicalPath) {
        continue;
      }
      const normalized = normalizeLogicalPath(logicalPath);
      byLogical.set(normalized, {
        logicalPath: normalized,
        docPath: file.relativePath,
        contentHash: file.contentHash,
      });
    }
  }

  return [...byLogical.values()].sort((a, b) => a.logicalPath.localeCompare(b.logicalPath));
}
