import type { GraphEdge, GraphNode } from "../types.js";
import { DEFAULT_LISTED_IN } from "./defaults.js";
import type { ExtractPatch } from "./knowledge.js";

export interface DocExtractEntry {
  relativePath: string;
  content: string;
}

export interface DocExtractResult {
  useCases: number;
  features: number;
  actors: number;
  filesScanned: number;
}

const UC_ID_RE = /\b(UC-\d+)\b/gi;
const F_ID_RE = /\b(F-\d+)\b/gi;
const USE_CASE_ID_LINE = /\*\*Use Case ID:\*\*\s*(UC-\d+)/i;
const USE_CASE_NAME_LINE = /\*\*Use Case Name:\*\*\s*(.+)/i;
const FEATURE_NAME_HEADING = /^#{1,3}\s+(F-\d+)\s*[:\-–—]\s*(.+)$/im;
const UC_HEADING = /^#{1,3}\s+(UC-\d+)\s*[:\-–—]\s*(.+)$/im;
const TABLE_ROW_UC = /^\|\s*(UC-\d+)\s*\|/im;
const TABLE_ROW_F = /^\|\s*(F-\d+)\s*\|/im;

/** Normalize UC-1 → UC-01, F-2 → F-02; leaves placeholders (UC-XX) unchanged */
export function normalizeDomainId(raw: string): string {
  const t = raw.trim();
  if (/XX$/i.test(t)) {
    return t;
  }
  const uc = t.match(/^UC-(\d+)$/i);
  if (uc) {
    return `UC-${uc[1].padStart(2, "0")}`;
  }
  const f = t.match(/^F-(\d+)$/i);
  if (f) {
    return `F-${f[1].padStart(2, "0")}`;
  }
  return t;
}

function isRealDomainId(id: string): boolean {
  return /^(UC|F)-\d+$/i.test(id) && !/XX$/i.test(id);
}

function listedInForPath(relativePath: string, kind: "useCase" | "feature" | "actor"): string {
  const p = relativePath.replace(/\\/g, "/").toLowerCase();
  if (kind === "useCase") {
    if (p.includes("use-case") || p.includes("use-cases") || /\/3-/.test(p)) {
      return DEFAULT_LISTED_IN.useCase;
    }
  }
  if (kind === "feature") {
    if (p.includes("system-features") || p.includes("04-system-features") || /\/4-/.test(p)) {
      return DEFAULT_LISTED_IN.feature;
    }
  }
  if (kind === "actor") {
    if (p.includes("overall-description") || /\/2-/.test(p)) {
      return DEFAULT_LISTED_IN.actor;
    }
  }
  return DEFAULT_LISTED_IN[kind];
}

interface ParsedDomain {
  useCases: Map<string, { title?: string }>;
  features: Map<string, { title?: string }>;
  actors: Map<string, { title?: string }>;
  satisfies: Array<{ from: string; to: string }>;
}

function emptyParsed(): ParsedDomain {
  return {
    useCases: new Map(),
    features: new Map(),
    actors: new Map(),
    satisfies: [],
  };
}

function addUseCase(parsed: ParsedDomain, id: string, title?: string): void {
  const norm = normalizeDomainId(id);
  const prev = parsed.useCases.get(norm);
  if (!prev?.title && title?.trim()) {
    parsed.useCases.set(norm, { title: title.trim() });
  } else if (!prev) {
    parsed.useCases.set(norm, { title: title?.trim() });
  }
}

function addFeature(parsed: ParsedDomain, id: string, title?: string): void {
  const norm = normalizeDomainId(id);
  const prev = parsed.features.get(norm);
  if (!prev?.title && title?.trim()) {
    parsed.features.set(norm, { title: title.trim() });
  } else if (!prev) {
    parsed.features.set(norm, { title: title?.trim() });
  }
}

function parseTableSatisfies(line: string, parsed: ParsedDomain): void {
  const cells = line
    .split("|")
    .map((c) => c.trim())
    .filter(Boolean);
  if (cells.length < 2) {
    return;
  }
  const fMatch = cells[0]?.match(/^F-(\d+)$/i);
  if (!fMatch) {
    return;
  }
  const from = normalizeDomainId(cells[0]!);
  for (const cell of cells.slice(1)) {
    for (const m of cell.matchAll(UC_ID_RE)) {
      parsed.satisfies.push({ from, to: normalizeDomainId(m[1]!) });
    }
  }
}

export function extractDomainFromMarkdown(
  content: string,
  relativePath: string,
): ParsedDomain {
  const parsed = emptyParsed();
  const lines = content.split(/\r?\n/);

  let pendingUcId: string | undefined;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;

    const ucIdLine = line.match(USE_CASE_ID_LINE);
    if (ucIdLine) {
      pendingUcId = normalizeDomainId(ucIdLine[1]!);
      addUseCase(parsed, pendingUcId);
      continue;
    }
    if (pendingUcId) {
      const nameLine = line.match(USE_CASE_NAME_LINE);
      if (nameLine) {
        addUseCase(parsed, pendingUcId, nameLine[1]);
        pendingUcId = undefined;
        continue;
      }
      if (line.startsWith("### ") || line.startsWith("## ")) {
        pendingUcId = undefined;
      }
    }

    const ucHeading = line.match(UC_HEADING);
    if (ucHeading) {
      addUseCase(parsed, ucHeading[1]!, ucHeading[2]);
    }

    const fHeading = line.match(FEATURE_NAME_HEADING);
    if (fHeading) {
      addFeature(parsed, fHeading[1]!, fHeading[2]);
    }

    const ucRow = line.match(TABLE_ROW_UC);
    if (ucRow) {
      const cells = line.split("|").map((c) => c.trim());
      const title = cells[2] || cells[1];
      addUseCase(parsed, ucRow[1]!, title && !/^UC-/i.test(title) ? title : undefined);
    }

    const fRow = line.match(TABLE_ROW_F);
    if (fRow) {
      const cells = line.split("|").map((c) => c.trim());
      const title = cells[2] || cells[1];
      addFeature(parsed, fRow[1]!, title && !/^F-/i.test(title) ? title : undefined);
      parseTableSatisfies(line, parsed);
    } else if (/^\|.*F-\d+/i.test(line) && /UC-/i.test(line)) {
      parseTableSatisfies(line, parsed);
    }
  }

  for (const m of content.matchAll(UC_ID_RE)) {
    if (m[1] && isRealDomainId(m[1])) {
      addUseCase(parsed, m[1]);
    }
  }
  for (const m of content.matchAll(F_ID_RE)) {
    if (m[1] && isRealDomainId(m[1])) {
      addFeature(parsed, m[1]);
    }
  }

  const actorSection = /(?:\*\*Primary Actor:\*\*|Primary Actor:)\s*\*?\*?\s*([^\n*]+)/gi;
  for (const m of content.matchAll(actorSection)) {
    const name = m[1]?.trim();
    if (name && !/^tbd$/i.test(name) && name.length > 1) {
      const id = `actor.${slugActorId(name)}`;
      parsed.actors.set(id, { title: name });
    }
  }

  return parsed;
}

function slugActorId(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48) || "unknown";
}

export function parsedDomainToPatch(
  parsed: ParsedDomain,
  relativePath: string,
): ExtractPatch {
  const nodes: GraphNode[] = [];
  const edges: GraphEdge[] = [];

  for (const [id, meta] of parsed.useCases) {
    const node: GraphNode = { id, type: "useCase", title: meta.title ?? id };
    if (meta.title) {
      node.description = meta.title;
    }
    nodes.push(node);
    edges.push({
      type: "listedIn",
      from: id,
      to: listedInForPath(relativePath, "useCase"),
    });
  }

  for (const [id, meta] of parsed.features) {
    const node: GraphNode = { id, type: "feature", title: meta.title ?? id };
    nodes.push(node);
    edges.push({
      type: "listedIn",
      from: id,
      to: listedInForPath(relativePath, "feature"),
    });
  }

  for (const [id, meta] of parsed.actors) {
    nodes.push({
      id,
      type: "actor",
      title: meta.title ?? id,
      name: meta.title,
    });
    edges.push({
      type: "describedIn",
      from: id,
      to: listedInForPath(relativePath, "actor"),
    });
  }

  const seenSatisfies = new Set<string>();
  for (const { from, to } of parsed.satisfies) {
    const key = `${from}->${to}`;
    if (seenSatisfies.has(key)) {
      continue;
    }
    seenSatisfies.add(key);
    if (parsed.features.has(from) && parsed.useCases.has(to)) {
      edges.push({ type: "satisfies", from, to });
    }
  }

  return { version: 1, nodes, edges };
}

export function mergeParsedDomains(domains: ParsedDomain[]): ParsedDomain {
  const out = emptyParsed();
  for (const d of domains) {
    for (const [id, meta] of d.useCases) {
      addUseCase(out, id, meta.title);
    }
    for (const [id, meta] of d.features) {
      addFeature(out, id, meta.title);
    }
    for (const [id, meta] of d.actors) {
      out.actors.set(id, meta);
    }
    out.satisfies.push(...d.satisfies);
  }
  return out;
}

export function buildDocExtractPatch(entries: DocExtractEntry[]): {
  patch: ExtractPatch;
  stats: DocExtractResult;
} {
  const perFile: ParsedDomain[] = [];
  for (const e of entries) {
    perFile.push(extractDomainFromMarkdown(e.content, e.relativePath));
  }
  const merged = mergeParsedDomains(perFile);

  const allNodes: GraphNode[] = [];
  const allEdges: GraphEdge[] = [];
  const edgeKeys = new Set<string>();

  for (const e of entries) {
    const single = extractDomainFromMarkdown(e.content, e.relativePath);
    const patch = parsedDomainToPatch(single, e.relativePath);
    for (const n of patch.nodes) {
      if (!allNodes.some((x) => x.id === n.id && x.type === n.type)) {
        allNodes.push(n);
      } else {
        const idx = allNodes.findIndex((x) => x.id === n.id);
        const existing = allNodes[idx]!;
        if (!existing.title && n.title) {
          allNodes[idx] = { ...existing, ...n };
        }
      }
    }
    for (const edge of patch.edges) {
      const key = `${edge.type}:${edge.from}:${edge.to}`;
      if (!edgeKeys.has(key)) {
        edgeKeys.add(key);
        allEdges.push(edge);
      }
    }
  }

  return {
    patch: { version: 1, nodes: allNodes, edges: allEdges },
    stats: {
      useCases: merged.useCases.size,
      features: merged.features.size,
      actors: merged.actors.size,
      filesScanned: entries.length,
    },
  };
}
