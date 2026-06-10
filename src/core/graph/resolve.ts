import type { GraphNode } from "../../types.js";
import type { InMemoryGraph } from "./InMemoryGraph.js";

export interface ResolveHints {
  /** Repo-relative file path (e.g. docs/srs/3-use-cases.md) */
  file?: string;
  /** Section anchor from markdown comment or graph id */
  sectionAnchor?: string;
  /** Heading text or substring (e.g. "3.2 List Use Case", "UC-3") */
  heading?: string;
  /** Free-text change description; matched against ids, titles, headings */
  text?: string;
  /** Explicit graph node id when already known */
  nodeId?: string;
}

export interface ResolvedOrigin {
  id: string;
  type: string;
  reason: string;
}

export function globToRegExp(glob: string): RegExp {
  const TMPL = "\x00";
  const GLOBSTAR_SLASH = "\x01";
  const GLOBSTAR = "\x02";
  // Placeholder tokens keep the regex fragments inserted for ** from being
  // re-mangled by the later single-* replacement.
  const escaped = glob
    .replace(/\{[^}]+\}/g, TMPL)
    .replace(/[.+^${}()|[\]\\]/g, "\\$&")
    .replace(/\*\*\//g, GLOBSTAR_SLASH)
    .replace(/\*\*/g, GLOBSTAR)
    .replace(/\*/g, "[^/]*")
    .replace(new RegExp(GLOBSTAR_SLASH, "g"), "(?:.*/)?")
    .replace(new RegExp(GLOBSTAR, "g"), ".*")
    .replace(new RegExp(TMPL, "g"), "[^/]+");
  return new RegExp(`^${escaped}$`, "i");
}

function normalizePath(relativePath: string): string {
  return relativePath.replace(/\\/g, "/").replace(/^\.\//, "");
}

function documentNodes(g: InMemoryGraph): GraphNode[] {
  return [...g.nodesById.values()].filter((n) => n.type === "document");
}

function stripLocaleSegment(p: string): string | undefined {
  const m = p.match(/^(docs\/[^/]+\/)([a-z]{2,5}(?:-[a-zA-Z]{2,4})?\/)(.+)$/i);
  return m ? m[1] + m[3] : undefined;
}

export function findDocumentNodeIdForPath(
  g: InMemoryGraph,
  relativePath: string,
): string | undefined {
  const norm = normalizePath(relativePath);
  const normNoLocale = stripLocaleSegment(norm);

  const match = (candidate: string): boolean =>
    norm === candidate || (normNoLocale !== undefined && normNoLocale === candidate);

  const patternMatch = (pattern: string): boolean => {
    const re = globToRegExp(pattern);
    return re.test(norm) || (normNoLocale !== undefined && re.test(normNoLocale));
  };

  for (const n of documentNodes(g)) {
    const out = n.output as string | undefined;
    if (out && match(normalizePath(out))) {
      return n.id;
    }
    const pattern = n.outputPattern as string | undefined;
    if (pattern && patternMatch(pattern)) {
      return n.id;
    }
  }
  return undefined;
}

export function findSectionNodeIdByAnchor(
  g: InMemoryGraph,
  anchor: string,
): string | undefined {
  const id = anchor.trim();
  if (g.nodesById.has(id) && g.nodesById.get(id)!.type === "section") {
    return id;
  }
  return undefined;
}

function normalizeHeading(text: string): string {
  return text
    .replace(/^#+\s*/, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

export function findSectionNodeIdsByHeading(
  g: InMemoryGraph,
  heading: string,
  filePath?: string,
): string[] {
  const norm = normalizeHeading(heading);
  if (!norm) {
    return [];
  }
  const docId = filePath ? findDocumentNodeIdForPath(g, filePath) : undefined;
  const matches: string[] = [];
  for (const n of g.nodesById.values()) {
    if (n.type !== "section") {
      continue;
    }
    if (docId && n.documentId !== docId) {
      continue;
    }
    const h = n.heading as string | undefined;
    if (!h) {
      continue;
    }
    const hn = normalizeHeading(h);
    if (hn === norm || hn.includes(norm) || norm.includes(hn)) {
      matches.push(n.id);
    }
  }
  return matches;
}

function nodeSearchFields(n: GraphNode): string[] {
  const fields: string[] = [n.id];
  for (const key of ["title", "heading", "name", "label"] as const) {
    const v = n[key as keyof GraphNode];
    if (typeof v === "string" && v.trim()) {
      fields.push(v);
    }
  }
  return fields;
}

export function findNodeIdsByText(
  g: InMemoryGraph,
  text: string,
  opts?: { types?: GraphNode["type"][]; limit?: number },
): string[] {
  const q = text.trim().toLowerCase();
  if (!q) {
    return [];
  }
  const typeSet = opts?.types ? new Set(opts.types) : null;
  const limit = opts?.limit ?? 12;
  const scored: { id: string; score: number }[] = [];

  for (const n of g.nodesById.values()) {
    if (typeSet && !typeSet.has(n.type)) {
      continue;
    }
    for (const field of nodeSearchFields(n)) {
      const f = field.toLowerCase();
      let score = 0;
      if (f === q) {
        score = 100;
      } else if (n.id.toLowerCase() === q) {
        score = 95;
      } else if (f.includes(q)) {
        score = 50 + q.length / Math.max(f.length, 1);
      } else if (q.includes(f) && f.length >= 4) {
        score = 30;
      }
      if (score > 0) {
        scored.push({ id: n.id, score });
        break;
      }
    }
  }

  scored.sort((a, b) => b.score - a.score || a.id.localeCompare(b.id));
  const seen = new Set<string>();
  const out: string[] = [];
  for (const { id } of scored) {
    if (seen.has(id)) {
      continue;
    }
    seen.add(id);
    out.push(id);
    if (out.length >= limit) {
      break;
    }
  }
  return out;
}

export function looksLikeExplicitNodeId(text: string): boolean {
  const t = text.trim();
  if (!t || t.includes(" ")) {
    return false;
  }
  return (
    t.startsWith("doc.") ||
    t.startsWith("sec.") ||
    /^UC-\d+/i.test(t) ||
    /^F-\d+/i.test(t) ||
    /^ENT-/i.test(t) ||
    t.startsWith("actor.")
  );
}

export function resolveImpactOrigins(
  g: InMemoryGraph,
  hints: ResolveHints,
): ResolvedOrigin[] {
  const origins: ResolvedOrigin[] = [];
  const push = (id: string, reason: string) => {
    const node = g.nodesById.get(id);
    if (!node) {
      return;
    }
    if (origins.some((o) => o.id === id)) {
      return;
    }
    origins.push({ id, type: node.type, reason });
  };

  if (hints.nodeId?.trim()) {
    push(hints.nodeId.trim(), "explicit nodeId");
  }

  if (hints.sectionAnchor?.trim()) {
    const sec = findSectionNodeIdByAnchor(g, hints.sectionAnchor);
    if (sec) {
      push(sec, "section anchor");
    }
  }

  if (hints.file?.trim()) {
    const path = normalizePath(hints.file);
    const pathNoLocale = stripLocaleSegment(path);

    const pathMatches = (candidate: string): boolean => {
      const c = normalizePath(candidate);
      return (
        c === path ||
        c.toLowerCase() === path.toLowerCase() ||
        (pathNoLocale !== undefined &&
          (c === pathNoLocale || c.toLowerCase() === pathNoLocale.toLowerCase()))
      );
    };

    const docId = findDocumentNodeIdForPath(g, path);
    if (docId) {
      push(docId, `document for path ${path}`);
    }

    for (const [fromId, edges] of g.outEdges) {
      for (const e of edges) {
        if (e.type === "rendersTo" && pathMatches(e.to)) {
          const fromNode = g.nodesById.get(fromId);
          if (fromNode && fromNode.type !== "document") {
            push(fromId, `rendersTo ${path}`);
          }
        }
      }
    }

    if (hints.heading?.trim()) {
      for (const id of findSectionNodeIdsByHeading(g, hints.heading, path)) {
        push(id, `section heading in ${path}`);
      }
    }
  } else if (hints.heading?.trim()) {
    for (const id of findSectionNodeIdsByHeading(g, hints.heading)) {
      push(id, "section heading match");
    }
  }

  const text = hints.text?.trim();
  if (text) {
    if (looksLikeExplicitNodeId(text) && g.nodesById.has(text)) {
      push(text, "text matches graph id");
    } else {
      for (const id of findNodeIdsByText(g, text)) {
        const node = g.nodesById.get(id)!;
        push(id, `text match on ${node.type}`);
      }
    }
  }

  return origins;
}

/** Pick the most specific seed when multiple origins match (section > domain > document). */
export function pickPrimaryImpactOrigin(
  origins: ResolvedOrigin[],
): ResolvedOrigin | undefined {
  if (origins.length === 0) {
    return undefined;
  }
  const rank = (type: string): number => {
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
  return [...origins].sort((a, b) => rank(b.type) - rank(a.type))[0];
}

const SECTION_ANCHOR_IN_DIFF_RE = /<!--\s*section:\s*([^\s>]+)\s*-->/;
const HEADING_IN_DIFF_RE = /^[+\- ]?(#{1,6})\s+(.+)$/;

export interface GitDiffRegion {
  file: string;
  heading?: string;
  sectionAnchor?: string;
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
