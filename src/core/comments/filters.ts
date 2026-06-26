import { normalizeLogicalPath, screenStemFromPrototypeUrl } from "./paths.js";
import type { AnchorState, CommentType, ThreadSummary } from "./types.js";
import {
  isDocumentAnchor,
  isPrototypeAnchor,
  threadCommentType,
} from "./types.js";

export interface CommentListFilters {
  /** Document registry entityId (UUID). */
  entityId?: string;
  /** Prototype screenId. */
  screenId?: string;
  /** Exact or aggregate path (`prototype` = all prototype URL folders). */
  filePath?: string;
  /** Prefix match on logical path (e.g. `srs/`, `prototype/src/`). */
  pathPrefix?: string;
  commentTypes?: CommentType[];
  status?: "open" | "resolved" | "all";
  /** Prototype screen stem or URL fragment (e.g. `login`, `src/login.html`). */
  screen?: string;
  originBranch?: string;
  anchorState?: AnchorState;
}

export interface FacetCount {
  value: string;
  count: number;
}

export interface CommentFacets {
  total: number;
  open: number;
  types: FacetCount[];
  paths: FacetCount[];
  screens: FacetCount[];
  branches: FacetCount[];
  anchorStates: FacetCount[];
  filters: CommentListFilters;
}

function normalizeScreenToken(screen: string): string {
  return screen
    .trim()
    .replace(/\\/g, "/")
    .replace(/^\/+|\/+$/g, "")
    .replace(/\.html?$/i, "")
    .toLowerCase();
}

function threadScreenStem(thread: ThreadSummary): string | null {
  if (threadCommentType(thread) !== "prototype" || !isPrototypeAnchor(thread.anchor)) {
    return null;
  }
  return screenStemFromPrototypeUrl(thread.anchor.url);
}

function matchesFilePath(thread: ThreadSummary, filePath: string): boolean {
  const lp = normalizeLogicalPath(thread.filePath);
  const ff = normalizeLogicalPath(filePath);
  if (ff === "prototype") {
    return lp.startsWith("prototype/");
  }
  return lp === ff;
}

function matchesPathPrefix(thread: ThreadSummary, prefix: string): boolean {
  const lp = normalizeLogicalPath(thread.filePath);
  const p = normalizeLogicalPath(prefix).replace(/\/$/, "");
  if (p === "prototype") {
    return lp.startsWith("prototype/");
  }
  return lp === p || lp.startsWith(`${p}/`);
}

function matchesScreen(thread: ThreadSummary, screen: string): boolean {
  const token = normalizeScreenToken(screen);
  const stem = threadScreenStem(thread);
  if (!stem) {
    return false;
  }
  if (stem.toLowerCase() === token) {
    return true;
  }
  if (isPrototypeAnchor(thread.anchor)) {
    const url = thread.anchor.url.toLowerCase();
    return url.includes(token) || url.replace(/\.html?$/i, "").endsWith(`/${token}`);
  }
  return false;
}

function threadAnchorState(thread: ThreadSummary): AnchorState {
  return thread.anchor.anchorState ?? "active";
}

export function threadMatchesFilters(
  thread: ThreadSummary,
  filters: CommentListFilters,
): boolean {
  if (filters.entityId) {
    const tid = thread.targetId ?? thread.filePath;
    if (tid !== filters.entityId.trim()) {
      return false;
    }
  }
  if (filters.screenId) {
    const tid = thread.targetId ?? "";
    if (tid !== filters.screenId.trim()) {
      return false;
    }
  }
  if (filters.filePath && !matchesFilePath(thread, filters.filePath)) {
    return false;
  }
  if (filters.pathPrefix && !matchesPathPrefix(thread, filters.pathPrefix)) {
    return false;
  }
  if (filters.commentTypes?.length) {
    const allowed = new Set(filters.commentTypes);
    if (!allowed.has(threadCommentType(thread))) {
      return false;
    }
  }
  const status = filters.status ?? "open";
  if (status !== "all" && thread.status !== status) {
    return false;
  }
  if (filters.screen && !matchesScreen(thread, filters.screen)) {
    return false;
  }
  if (filters.originBranch && thread.originBranch !== filters.originBranch) {
    return false;
  }
  if (filters.anchorState && threadAnchorState(thread) !== filters.anchorState) {
    return false;
  }
  return true;
}

function increment(map: Map<string, number>, key: string): void {
  map.set(key, (map.get(key) ?? 0) + 1);
}

function toFacetCounts(map: Map<string, number>, limit = 30): FacetCount[] {
  return [...map.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, limit)
    .map(([value, count]) => ({ value, count }));
}

export function buildCommentFacets(
  threads: ThreadSummary[],
  filters: CommentListFilters = {},
): CommentFacets {
  const types = new Map<string, number>();
  const paths = new Map<string, number>();
  const screens = new Map<string, number>();
  const branches = new Map<string, number>();
  const anchorStates = new Map<string, number>();

  for (const t of threads) {
    increment(types, threadCommentType(t));
    increment(paths, t.filePath);
    const stem = threadScreenStem(t);
    if (stem) {
      increment(screens, stem);
    }
    increment(branches, t.originBranch);
    increment(anchorStates, threadAnchorState(t));
  }

  return {
    total: threads.length,
    open: threads.filter((t) => t.status === "open").length,
    types: toFacetCounts(types),
    paths: toFacetCounts(paths),
    screens: toFacetCounts(screens),
    branches: toFacetCounts(branches),
    anchorStates: toFacetCounts(anchorStates),
    filters,
  };
}

export function formatFacetsForChat(facets: CommentFacets): string {
  const lines: string[] = [
    `Comment facets (${facets.open} open / ${facets.total} total):`,
    "",
  ];

  if (facets.types.length > 0) {
    lines.push("**Types:**", ...facets.types.map((f) => `- \`${f.value}\`: ${f.count}`), "");
  }
  if (facets.screens.length > 0) {
    lines.push(
      "**Prototype screens:**",
      ...facets.screens.map((f) => `- \`${f.value}\`: ${f.count} thread(s)`),
      "",
    );
  }
  if (facets.paths.length > 0) {
    lines.push("**Paths:**", ...facets.paths.slice(0, 15).map((f) => `- \`${f.value}\`: ${f.count}`), "");
    if (facets.paths.length > 15) {
      lines.push(`- …and ${facets.paths.length - 15} more`);
    }
    lines.push("");
  }
  if (facets.branches.length > 0) {
    lines.push("**Branches:**", ...facets.branches.map((f) => `- \`${f.value}\`: ${f.count}`), "");
  }

  lines.push(
    "",
    "Filter examples:",
    "- `comments inbox --type prototype --screen login --group screen`",
    "- `comments batch-plan --screen login`",
    "- `comments batch-plan B-001`",
  );

  return lines.join("\n");
}

/** Infer prototype screen filter from natural phrases like "login screen". */
export function parseScreenFromPhrase(phrase: string): string | null {
  const m = phrase.match(/\b([a-z0-9][\w-]*)\s+screen\b/i);
  if (m?.[1]) {
    return m[1].toLowerCase();
  }
  const bare = phrase.match(/\bscreen\s+([a-z0-9][\w-]*)\b/i);
  if (bare?.[1]) {
    return bare[1].toLowerCase();
  }
  return null;
}

export function documentThreadLabel(thread: ThreadSummary): string {
  if (isDocumentAnchor(thread.anchor)) {
    return `lines ${thread.anchor.startLine}-${thread.anchor.endLine}`;
  }
  return thread.filePath;
}
