import type { GraphEdge, GraphNode } from "../types.js";
import {
  detailSectionsToPatch,
  parseDetailSections,
} from "./detail-sections.js";
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
  detailDocuments: number;
  detailSections: number;
  filesScanned: number;
}

/** Registry template ids for per-domain SRS detail (see documents.json). */
export const PER_DOMAIN_TEMPLATE_DOC = {
  useCase: "doc.srs.uc-detail",
  feature: "doc.srs.feature-detail",
} as const;

const UC_ID_RE = /\b(UC-\d+)\b/gi;
const F_ID_RE = /\b(F-\d+)\b/gi;
const USE_CASE_ID_LINE = /\*\*Use Case ID:\*\*\s*(UC-\d+)/i;
const USE_CASE_NAME_LINE = /\*\*Use Case Name:\*\*\s*(.+)/i;
const FEATURE_ID_LINE = /\*\*Feature ID:\*\*\s*(F-\d+)/i;
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

export type DetailFileKind = "useCaseDetail" | "featureDetail";

function normalizeRelativePath(relativePath: string): string {
  return relativePath.replace(/\\/g, "/").replace(/^\.\//, "");
}

/** Classify markdown under docs/srs as list chapter vs per-domain detail file. */
export function classifySrsDetailFile(relativePath: string): DetailFileKind | null {
  const p = normalizeRelativePath(relativePath).toLowerCase();
  if (p.endsWith("/3-use-cases.md") || p === "docs/srs/3-use-cases.md") {
    return null;
  }
  if (p.endsWith("/4-system-features.md") || p === "docs/srs/4-system-features.md") {
    return null;
  }
  if (/\/03-use-cases\//.test(p) || /\/uc-\d+/.test(p)) {
    return "useCaseDetail";
  }
  if (/\/04-system-features\/f-\d+/.test(p)) {
    return "featureDetail";
  }
  return null;
}

export function documentIdForDomainDetail(
  kind: DetailFileKind,
  domainId: string,
): string {
  const norm = normalizeDomainId(domainId);
  return kind === "useCaseDetail"
    ? `doc.srs.uc-${norm}`
    : `doc.srs.f-${norm}`;
}

function primaryDomainIdFromDetailContent(
  content: string,
  kind: DetailFileKind,
): { id: string; title?: string } | null {
  if (kind === "useCaseDetail") {
    const idLine = content.match(USE_CASE_ID_LINE);
    if (idLine?.[1] && isRealDomainId(idLine[1])) {
      const nameLine = content.match(USE_CASE_NAME_LINE);
      return {
        id: normalizeDomainId(idLine[1]),
        title: nameLine?.[1]?.trim(),
      };
    }
    const heading = content.match(UC_HEADING);
    if (heading?.[1] && isRealDomainId(heading[1])) {
      return { id: normalizeDomainId(heading[1]), title: heading[2]?.trim() };
    }
    return null;
  }
  const idLine = content.match(FEATURE_ID_LINE);
  if (idLine?.[1] && isRealDomainId(idLine[1])) {
    const heading = content.match(FEATURE_NAME_HEADING);
    return {
      id: normalizeDomainId(idLine[1]),
      title: heading?.[2]?.trim(),
    };
  }
  const heading = content.match(FEATURE_NAME_HEADING);
  if (heading?.[1] && isRealDomainId(heading[1])) {
    return { id: normalizeDomainId(heading[1]), title: heading[2]?.trim() };
  }
  return null;
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

/** Document nodes + definedIn/rendersTo for per-UC / per-feature markdown on disk. */
export function detailFileToPatch(
  relativePath: string,
  content: string,
): ExtractPatch {
  const kind = classifySrsDetailFile(relativePath);
  if (!kind) {
    return { version: 1, nodes: [], edges: [] };
  }

  const primary = primaryDomainIdFromDetailContent(content, kind);
  if (!primary) {
    return { version: 1, nodes: [], edges: [] };
  }

  const path = normalizeRelativePath(relativePath);
  const docId = documentIdForDomainDetail(kind, primary.id);
  const perDomain = kind === "useCaseDetail" ? "useCase" : "feature";
  const templateDocId = PER_DOMAIN_TEMPLATE_DOC[perDomain];

  const nodes: GraphNode[] = [
    {
      id: docId,
      type: "document",
      output: path,
      perDomain,
      title: primary.title ?? primary.id,
    },
  ];

  const edges: GraphEdge[] = [
    { type: "rendersTo", from: primary.id, to: path },
    { type: "rendersTo", from: templateDocId, to: path },
    { type: "partOf", from: docId, to: templateDocId },
  ];

  const sections = parseDetailSections(content, docId);
  const sectionPatch = detailSectionsToPatch(docId, sections);
  nodes.push(...sectionPatch.nodes);
  edges.push(...sectionPatch.edges);
  for (const sec of sections) {
    edges.push({ type: "definedIn", from: primary.id, to: sec.id });
  }
  if (sections.length === 0) {
    edges.push({ type: "definedIn", from: primary.id, to: docId });
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
  let detailDocuments = 0;
  let detailSections = 0;

  const mergePatchInto = (patch: ExtractPatch) => {
    for (const n of patch.nodes) {
      if (!allNodes.some((x) => x.id === n.id && x.type === n.type)) {
        allNodes.push(n);
        if (n.type === "document" && n.output) {
          detailDocuments++;
        }
        if (
          n.type === "section" &&
          typeof n.documentId === "string" &&
          n.documentId.startsWith("doc.srs.")
        ) {
          detailSections++;
        }
      } else {
        const idx = allNodes.findIndex((x) => x.id === n.id);
        const existing = allNodes[idx]!;
        if (!existing.title && n.title) {
          allNodes[idx] = { ...existing, ...n };
        }
        if (n.type === "document" && n.output && !existing.output) {
          allNodes[idx] = { ...allNodes[idx]!, output: n.output };
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
  };

  for (const e of entries) {
    const single = extractDomainFromMarkdown(e.content, e.relativePath);
    mergePatchInto(parsedDomainToPatch(single, e.relativePath));
    mergePatchInto(detailFileToPatch(e.relativePath, e.content));
  }

  return {
    patch: { version: 1, nodes: allNodes, edges: allEdges },
    stats: {
      useCases: merged.useCases.size,
      features: merged.features.size,
      actors: merged.actors.size,
      detailDocuments,
      detailSections,
      filesScanned: entries.length,
    },
  };
}
