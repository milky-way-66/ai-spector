import type { InMemoryGraph } from "./InMemoryGraph.js";
import {
  resolveImpactOrigins,
  type ResolvedOrigin,
} from "ai-spector-graph";

export {
  globToRegExp,
  findDocumentNodeIdForPath,
  findSectionNodeIdByAnchor,
  findSectionNodeIdsByHeading,
  findNodeIdsByText,
  looksLikeExplicitNodeId,
  resolveImpactOrigins,
  pickPrimaryImpactOrigin,
} from "ai-spector-graph";
export type { ResolveHints, ResolvedOrigin } from "ai-spector-graph";

const SECTION_ANCHOR_IN_DIFF_RE = /<!--\s*section:\s*([^\s>]+)\s*-->/;
const HEADING_IN_DIFF_RE = /^[+\- ]?(#{1,6})\s+(.+)$/;

export interface GitDiffRegion {
  file: string;
  heading?: string;
  sectionAnchor?: string;
}

function normalizePath(relativePath: string): string {
  return relativePath.replace(/\\/g, "/").replace(/^\.\//, "");
}

function docPathPriority(relativePath: string): number {
  const p = normalizePath(relativePath);
  if (p.startsWith("docs/")) {
    return 0;
  }
  if (p.startsWith(".ai-spector/")) {
    return 1;
  }
  return 2;
}

/** Parse unified diff text into per-file regions with optional heading / section anchors. */
export function parseGitDiffRegions(diffText: string): GitDiffRegion[] {
  const regions: GitDiffRegion[] = [];
  const blocks = diffText.split(/^diff --git /m).filter(Boolean);

  const pushBlock = (raw: string) => {
    const lines = raw.split("\n");
    let filePath: string | undefined;
    const headings = new Set<string>();
    const anchors = new Set<string>();

    for (const line of lines) {
      const plus = line.match(/^\+\+\+ b\/(.+)$/);
      if (plus) {
        filePath = normalizePath(plus[1]);
        continue;
      }
      const minus = line.match(/^--- a\/(.+)$/);
      if (!filePath && minus) {
        filePath = normalizePath(minus[1]);
      }
      const anchor = line.match(SECTION_ANCHOR_IN_DIFF_RE);
      if (anchor) {
        anchors.add(anchor[1]);
      }
      const heading = line.match(HEADING_IN_DIFF_RE);
      if (heading) {
        headings.add(heading[2].trim());
      }
    }

    if (!filePath || filePath === "/dev/null") {
      return;
    }

    if (anchors.size === 0 && headings.size === 0) {
      regions.push({ file: filePath });
      return;
    }
    for (const sectionAnchor of anchors) {
      regions.push({ file: filePath, sectionAnchor });
    }
    for (const heading of headings) {
      regions.push({ file: filePath, heading });
    }
  };

  if (blocks.length > 0) {
    for (const block of blocks) {
      pushBlock(block);
    }
  } else if (diffText.includes("--- ")) {
    pushBlock(diffText);
  }

  return prioritizeGitDiffRegions(regions);
}

export function prioritizeGitDiffRegions(regions: GitDiffRegion[]): GitDiffRegion[] {
  const seen = new Set<string>();
  const unique: GitDiffRegion[] = [];
  for (const r of regions) {
    const key = `${r.file}\0${r.sectionAnchor ?? ""}\0${r.heading ?? ""}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    unique.push(r);
  }
  return unique.sort(
    (a, b) =>
      docPathPriority(a.file) - docPathPriority(b.file) ||
      a.file.localeCompare(b.file) ||
      (a.heading ?? "").localeCompare(b.heading ?? ""),
  );
}

/** Resolve graph seeds from a unified diff (staged + unstaged combined text). */
export function resolveFromGitDiff(
  g: InMemoryGraph,
  diffText: string,
): ResolvedOrigin[] {
  const regions = parseGitDiffRegions(diffText);
  const origins: ResolvedOrigin[] = [];
  const push = (o: ResolvedOrigin) => {
    if (!origins.some((x) => x.id === o.id)) {
      origins.push(o);
    }
  };

  for (const region of regions) {
    for (const o of resolveImpactOrigins(g, {
      file: region.file,
      heading: region.heading,
      sectionAnchor: region.sectionAnchor,
    })) {
      push(o);
    }
  }

  const typeRank = (type: string): number => {
    if (type === "section") {
      return 3;
    }
    if (["useCase", "feature", "requirement", "actor", "dataEntity"].includes(type)) {
      return 2;
    }
    if (type === "document") {
      return 1;
    }
    return 0;
  };
  return origins.sort(
    (a, b) => typeRank(b.type) - typeRank(a.type) || a.id.localeCompare(b.id),
  );
}
