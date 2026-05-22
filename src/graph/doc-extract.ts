import type { GraphEdge, GraphNode } from "../types.js";
import {
  basicDesignListChapterDocumentId,
  basicDesignListChapterFileToPatch,
  detailSectionsToPatch,
  parseDetailSections,
  snippetAfterHeading,
} from "./detail-sections.js";
import {
  BASIC_DESIGN_LIST_DOCUMENT_IDS,
  DEFAULT_BD_LIST_DOC,
  DEFAULT_LISTED_IN,
  PER_DOMAIN_TEMPLATE_DOC_BD,
} from "./defaults.js";
import type { InMemoryGraph } from "./InMemoryGraph.js";
import type { ExtractPatch } from "./knowledge.js";
import { scanBasicDesignListDocuments } from "../registry/build.js";
import {
  mergeStructurePatches,
  registryDocumentToStructurePatch,
} from "../registry/structure-patch.js";

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
  srsDetailDocuments: number;
  bdDetailDocuments: number;
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
const BRIEF_DESCRIPTION_BLOCK =
  /\*\*Brief Description:\*\*\s*\n+>\s*([^\n]+(?:\n>[^\n]+)*)/i;
const FEATURE_PURPOSE_BLOCK =
  /\*\*(?:Feature Purpose|Purpose):\*\*\s*\n+>\s*([^\n]+(?:\n>[^\n]+)*)/i;
const PRIORITY_LINE = /\*\*Priority:\*\*\s*(High|Medium|Low)/i;
const OVERVIEW_HEADING = /use case overview/i;
const FEATURE_DESC_HEADING = /^1\.\s*description$/i;

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
export type BasicDesignDetailKind = "apiDetail" | "screenDetail";

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

/** Classify markdown under docs/basic-design as list chapter vs per-endpoint/per-screen detail. */
export function classifyBasicDesignDetailFile(
  relativePath: string,
): BasicDesignDetailKind | null {
  const p = normalizeRelativePath(relativePath).toLowerCase();
  if (
    p === "docs/basic-design/api-list.md" ||
    p.endsWith("/api-list.md") ||
    p === "docs/basic-design/db-design.md" ||
    p.endsWith("/db-design.md") ||
    p === "docs/basic-design/list-screens.md" ||
    p.endsWith("/list-screens.md") ||
    p.includes("/screens/list-screens.md")
  ) {
    return null;
  }
  if (/\/api\/[^/]+\.md$/.test(p)) {
    return "apiDetail";
  }
  if (/\/screens\/[^/]+\.md$/.test(p)) {
    return "screenDetail";
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

function slugFromFilename(relativePath: string): string {
  const base =
    normalizeRelativePath(relativePath)
      .split("/")
      .pop()
      ?.replace(/\.md$/i, "") ?? "unknown";
  return base
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 64);
}

export function documentIdForBasicDesignDetail(
  kind: BasicDesignDetailKind,
  relativePath: string,
): string {
  const slug = slugFromFilename(relativePath);
  return kind === "apiDetail" ? `doc.bd.api-${slug}` : `doc.bd.screen-${slug}`;
}

const ENDPOINT_SPEC_HEADING = /###\s*\d+(?:\.\d+)?\s*`([A-Z]+)\s+([^`]+)`/i;
const API_DETAIL_TITLE = /^#\s*API Detail:\s*(.+)/im;
const SCREEN_SECTION_HEADING = /^##\s*\d+\.\s*Screen:\s*(.+)/im;

export interface BasicDesignDetailMeta {
  title: string;
  featureIds: string[];
}

/** Title and optional related features from per-endpoint / per-screen detail markdown. */
export function extractBasicDesignDetailMeta(
  content: string,
  kind: BasicDesignDetailKind,
  relativePath: string,
): BasicDesignDetailMeta {
  const featureIds = new Set<string>();
  for (const m of content.matchAll(/\bF-\d+\b/gi)) {
    const id = normalizeDomainId(m[0]);
    if (isRealDomainId(id)) {
      featureIds.add(id);
    }
  }
  const idLine = content.match(FEATURE_ID_LINE);
  if (idLine?.[1] && isRealDomainId(idLine[1])) {
    featureIds.add(normalizeDomainId(idLine[1]));
  }

  if (kind === "apiDetail") {
    const endpoint = content.match(ENDPOINT_SPEC_HEADING);
    if (endpoint) {
      return {
        title: `${endpoint[1]} ${endpoint[2]}`.trim(),
        featureIds: [...featureIds],
      };
    }
    const titleLine = content.match(API_DETAIL_TITLE);
    if (titleLine?.[1]?.trim()) {
      return { title: titleLine[1].trim(), featureIds: [...featureIds] };
    }
    return { title: slugFromFilename(relativePath), featureIds: [...featureIds] };
  }

  const screen = content.match(SCREEN_SECTION_HEADING);
  if (screen?.[1]?.trim()) {
    return { title: screen[1].trim(), featureIds: [...featureIds] };
  }
  return { title: slugFromFilename(relativePath), featureIds: [...featureIds] };
}

function buildBasicDesignDetailInstancePatch(opts: {
  relativePath: string;
  content: string;
  docId: string;
  kind: BasicDesignDetailKind;
  title: string;
  description?: string;
  featureIds: string[];
}): ExtractPatch {
  const path = normalizeRelativePath(opts.relativePath);
  const templateDocId =
    opts.kind === "apiDetail"
      ? PER_DOMAIN_TEMPLATE_DOC_BD.api
      : PER_DOMAIN_TEMPLATE_DOC_BD.screen;
  const listAnchorId =
    opts.kind === "apiDetail"
      ? DEFAULT_BD_LIST_DOC.apiList
      : DEFAULT_BD_LIST_DOC.screenList;

  const nodes: GraphNode[] = [
    {
      id: opts.docId,
      type: "document",
      output: path,
      perDomain: opts.kind,
      title: opts.title,
      ...(opts.description ? { description: opts.description } : {}),
    },
  ];
  const edges: GraphEdge[] = [
    { type: "rendersTo", from: opts.docId, to: path },
    { type: "rendersTo", from: templateDocId, to: path },
    { type: "partOf", from: opts.docId, to: templateDocId },
    { type: "contains", from: listAnchorId, to: opts.docId },
  ];

  for (const featureId of opts.featureIds) {
    edges.push({ type: "tracesTo", from: featureId, to: opts.docId });
  }

  const sections = parseDetailSections(opts.content, opts.docId);
  const sectionPatch = detailSectionsToPatch(opts.docId, sections, opts.content);
  nodes.push(...sectionPatch.nodes);
  edges.push(...sectionPatch.edges);

  return { version: 1, nodes, edges };
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

export interface DetailDomainMeta {
  title?: string;
  description?: string;
  priority?: string;
}

function cleanQuotedBlock(raw: string): string {
  return raw
    .split(/\r?\n/)
    .map((l) => l.replace(/^\s*>\s?/, "").trim())
    .filter(Boolean)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Rich title/description from generated detail markdown (not list-table stubs). */
export function extractDetailDomainMeta(
  content: string,
  kind: DetailFileKind,
): DetailDomainMeta | null {
  const primary = primaryDomainIdFromDetailContent(content, kind);
  if (!primary) {
    return null;
  }

  const meta: DetailDomainMeta = {};
  if (primary.title) {
    meta.title = primary.title;
  }

  const nameLine = content.match(USE_CASE_NAME_LINE);
  if (nameLine?.[1]?.trim()) {
    meta.title = nameLine[1].trim();
  }

  if (kind === "useCaseDetail") {
    const brief = content.match(BRIEF_DESCRIPTION_BLOCK);
    if (brief?.[1]) {
      meta.description = cleanQuotedBlock(brief[1]);
    }
    const priority = content.match(PRIORITY_LINE);
    if (priority?.[1]) {
      meta.priority = priority[1];
    }
    if (!meta.description) {
      const sections = parseDetailSections(content, "doc.temp");
      const overview = sections.find((s) => OVERVIEW_HEADING.test(s.heading));
      if (overview) {
        meta.description = snippetAfterHeading(content, overview.heading);
      }
    }
  } else {
    const purpose = content.match(FEATURE_PURPOSE_BLOCK);
    if (purpose?.[1]) {
      meta.description = cleanQuotedBlock(purpose[1]);
    }
    if (!meta.description) {
      const sections = parseDetailSections(content, "doc.temp");
      const descSec = sections.find((s) => FEATURE_DESC_HEADING.test(s.heading));
      if (descSec) {
        meta.description = snippetAfterHeading(content, descSec.heading);
      }
    }
  }

  return meta;
}

function listedInForPath(relativePath: string, kind: "useCase" | "feature" | "actor"): string {
  const p = relativePath.replace(/\\/g, "/").toLowerCase();
  if (kind === "useCase") {
    if (p.includes("use-case") || p.includes("use-cases") || /\/3-/.test(p)) {
      return DEFAULT_LISTED_IN.useCase;
    }
  }
  if (kind === "feature") {
    if (
      p.includes("basic-design") ||
      p.includes("system-features") ||
      p.includes("04-system-features") ||
      /\/4-/.test(p)
    ) {
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
  useCases: Map<string, { title?: string; description?: string; priority?: string }>;
  features: Map<string, { title?: string; description?: string }>;
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

function addUseCase(
  parsed: ParsedDomain,
  id: string,
  fields?: { title?: string; description?: string; priority?: string },
): void {
  const norm = normalizeDomainId(id);
  const prev = parsed.useCases.get(norm) ?? {};
  const next = { ...prev };
  if (fields?.title?.trim() && !prev.title) {
    next.title = fields.title.trim();
  }
  if (fields?.description?.trim() && !prev.description) {
    next.description = fields.description.trim();
  }
  if (fields?.priority?.trim() && !prev.priority) {
    next.priority = fields.priority.trim();
  }
  parsed.useCases.set(norm, next);
}

function addFeature(
  parsed: ParsedDomain,
  id: string,
  fields?: { title?: string; description?: string },
): void {
  const norm = normalizeDomainId(id);
  const prev = parsed.features.get(norm) ?? {};
  const next = { ...prev };
  if (fields?.title?.trim() && !prev.title) {
    next.title = fields.title.trim();
  }
  if (fields?.description?.trim() && !prev.description) {
    next.description = fields.description.trim();
  }
  parsed.features.set(norm, next);
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
      addUseCase(parsed, pendingUcId, {});
      continue;
    }
    if (pendingUcId) {
      const nameLine = line.match(USE_CASE_NAME_LINE);
      if (nameLine) {
        addUseCase(parsed, pendingUcId, { title: nameLine[1] });
        pendingUcId = undefined;
        continue;
      }
      if (line.startsWith("### ") || line.startsWith("## ")) {
        pendingUcId = undefined;
      }
    }

    const ucHeading = line.match(UC_HEADING);
    if (ucHeading) {
      addUseCase(parsed, ucHeading[1]!, { title: ucHeading[2] });
    }

    const fHeading = line.match(FEATURE_NAME_HEADING);
    if (fHeading) {
      addFeature(parsed, fHeading[1]!, { title: fHeading[2] });
    }

    const ucRow = line.match(TABLE_ROW_UC);
    if (ucRow) {
      const cells = line.split("|").map((c) => c.trim());
      const title = cells[2] || cells[1];
      addUseCase(parsed, ucRow[1]!, {
        title: title && !/^UC-/i.test(title) ? title : undefined,
      });
    }

    const fRow = line.match(TABLE_ROW_F);
    if (fRow) {
      const cells = line.split("|").map((c) => c.trim());
      const title = cells[2] || cells[1];
      addFeature(parsed, fRow[1]!, {
        title: title && !/^F-/i.test(title) ? title : undefined,
      });
      parseTableSatisfies(line, parsed);
    } else if (/^\|.*F-\d+/i.test(line) && /UC-/i.test(line)) {
      parseTableSatisfies(line, parsed);
    }
  }

  for (const m of content.matchAll(UC_ID_RE)) {
    if (m[1] && isRealDomainId(m[1])) {
      addUseCase(parsed, m[1], {});
    }
  }
  for (const m of content.matchAll(F_ID_RE)) {
    if (m[1] && isRealDomainId(m[1])) {
      addFeature(parsed, m[1], {});
    }
  }

  const srsDetailKind = classifySrsDetailFile(relativePath);
  if (srsDetailKind) {
    const rich = extractDetailDomainMeta(content, srsDetailKind);
    if (rich) {
      const primary = primaryDomainIdFromDetailContent(content, srsDetailKind);
      if (primary) {
        if (srsDetailKind === "useCaseDetail") {
          addUseCase(parsed, primary.id, rich);
        } else {
          addFeature(parsed, primary.id, rich);
        }
      }
    }
  }

  const bdKind = classifyBasicDesignDetailFile(relativePath);
  if (bdKind) {
    const meta = extractBasicDesignDetailMeta(content, bdKind, relativePath);
    for (const featureId of meta.featureIds) {
      addFeature(parsed, featureId, {
        description: extractBasicDesignDetailDescription(content, bdKind),
      });
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

const SCREEN_PURPOSE_BLOCK =
  /##\s*1\.\s*Screen:[\s\S]*?\*\*Purpose:\*\*\s*\n+>\s*([^\n]+(?:\n>[^\n]+)*)/i;

function extractBasicDesignDetailDescription(
  content: string,
  kind: BasicDesignDetailKind,
): string | undefined {
  if (kind === "apiDetail") {
    const meta = extractDetailDomainMeta(content, "featureDetail");
    return meta?.description;
  }
  const purpose = content.match(SCREEN_PURPOSE_BLOCK);
  if (purpose?.[1]) {
    return cleanQuotedBlock(purpose[1]);
  }
  const sections = parseDetailSections(content, "doc.temp");
  const screenHeading = sections.find((s) => /^##\s*1\.\s*screen/i.test(s.heading));
  if (screenHeading) {
    return snippetAfterHeading(content, screenHeading.heading);
  }
  return undefined;
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
    if (meta.description) {
      node.description = meta.description;
    }
    if (meta.priority) {
      node.priority = meta.priority;
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
    if (meta.description) {
      node.description = meta.description;
    }
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

function buildDetailInstancePatch(opts: {
  relativePath: string;
  content: string;
  docId: string;
  domainId: string;
  domainType: "useCase" | "feature";
  perDomain: GraphNode["perDomain"];
  templateDocId: string;
  listAnchorId: string;
  title?: string;
  description?: string;
  priority?: string;
}): ExtractPatch {
  const path = normalizeRelativePath(opts.relativePath);
  const nodes: GraphNode[] = [
    {
      id: opts.docId,
      type: "document",
      output: path,
      perDomain: opts.perDomain,
      title: opts.title ?? opts.domainId,
      ...(opts.description ? { description: opts.description } : {}),
    },
    {
      id: opts.domainId,
      type: opts.domainType,
      title: opts.title ?? opts.domainId,
      ...(opts.description ? { description: opts.description } : {}),
      ...(opts.priority ? { priority: opts.priority } : {}),
    },
  ];

  const edges: GraphEdge[] = [
    { type: "rendersTo", from: opts.domainId, to: path },
    { type: "rendersTo", from: opts.templateDocId, to: path },
    { type: "partOf", from: opts.docId, to: opts.templateDocId },
    { type: "describedIn", from: opts.domainId, to: opts.docId },
    { type: "contains", from: opts.listAnchorId, to: opts.docId },
    { type: "tracesTo", from: opts.domainId, to: opts.docId },
  ];

  const sections = parseDetailSections(opts.content, opts.docId);
  const sectionPatch = detailSectionsToPatch(opts.docId, sections, opts.content);
  nodes.push(...sectionPatch.nodes);
  edges.push(...sectionPatch.edges);
  for (const sec of sections) {
    edges.push({ type: "definedIn", from: opts.domainId, to: sec.id });
    edges.push({ type: "describedIn", from: opts.domainId, to: sec.id });
  }
  if (sections.length === 0) {
    edges.push({ type: "definedIn", from: opts.domainId, to: opts.docId });
  }

  return { version: 1, nodes, edges };
}

function srsDetailFileToPatch(relativePath: string, content: string): ExtractPatch {
  const kind = classifySrsDetailFile(relativePath);
  if (!kind) {
    return { version: 1, nodes: [], edges: [] };
  }

  const primary = primaryDomainIdFromDetailContent(content, kind);
  if (!primary) {
    return { version: 1, nodes: [], edges: [] };
  }

  const perDomain = kind === "useCaseDetail" ? "useCase" : "feature";
  const rich = extractDetailDomainMeta(content, kind);

  return buildDetailInstancePatch({
    relativePath,
    content,
    docId: documentIdForDomainDetail(kind, primary.id),
    domainId: primary.id,
    domainType: perDomain === "useCase" ? "useCase" : "feature",
    perDomain,
    templateDocId: PER_DOMAIN_TEMPLATE_DOC[perDomain],
    listAnchorId:
      perDomain === "useCase" ? DEFAULT_LISTED_IN.useCase : DEFAULT_LISTED_IN.feature,
    title: rich?.title ?? primary.title,
    description: rich?.description,
    priority: rich?.priority,
  });
}

function basicDesignDetailFileToPatch(
  relativePath: string,
  content: string,
): ExtractPatch {
  const kind = classifyBasicDesignDetailFile(relativePath);
  if (!kind) {
    return { version: 1, nodes: [], edges: [] };
  }

  const meta = extractBasicDesignDetailMeta(content, kind, relativePath);
  return buildBasicDesignDetailInstancePatch({
    relativePath,
    content,
    docId: documentIdForBasicDesignDetail(kind, relativePath),
    kind,
    title: meta.title,
    description: extractBasicDesignDetailDescription(content, kind),
    featureIds: meta.featureIds,
  });
}

/** Document nodes + sections for per-UC/F SRS or per-endpoint/per-screen basic-design files. */
export function detailFileToPatch(
  relativePath: string,
  content: string,
  options?: BuildDocExtractPatchOptions,
): ExtractPatch {
  if (options?.includeListChapterMarkdown !== false) {
    const listChapter = basicDesignListChapterFileToPatch(relativePath, content);
    if (listChapter.nodes.length > 0 || listChapter.edges.length > 0) {
      return listChapter;
    }
  } else if (basicDesignListChapterDocumentId(relativePath)) {
    return { version: 1, nodes: [], edges: [] };
  }

  const srs = srsDetailFileToPatch(relativePath, content);
  if (srs.nodes.length > 0 || srs.edges.length > 0) {
    return srs;
  }
  return basicDesignDetailFileToPatch(relativePath, content);
}

export function mergeParsedDomains(domains: ParsedDomain[]): ParsedDomain {
  const out = emptyParsed();
  for (const d of domains) {
    for (const [id, meta] of d.useCases) {
      addUseCase(out, id, meta);
    }
    for (const [id, meta] of d.features) {
      addFeature(out, id, meta);
    }
    for (const [id, meta] of d.actors) {
      out.actors.set(id, meta);
    }
    out.satisfies.push(...d.satisfies);
  }
  return out;
}

/** Per-domain template shells (outputPattern — no section coverage required). */
export function basicDesignPerDomainTemplateNodes(): GraphNode[] {
  return [
    {
      id: PER_DOMAIN_TEMPLATE_DOC_BD.api,
      type: "document",
      outputPattern: "docs/basic-design/api/",
      perDomain: "apiDetail",
      title: "API Detail (template)",
    },
    {
      id: PER_DOMAIN_TEMPLATE_DOC_BD.screen,
      type: "document",
      outputPattern: "docs/basic-design/screens/",
      perDomain: "screenDetail",
      title: "Screen Detail (template)",
    },
  ];
}

/** @deprecated Prefer {@link basicDesignAnchorStructurePatch} — documents only, no sections. */
export function basicDesignAnchorDocumentNodes(): GraphNode[] {
  return [
    {
      id: DEFAULT_BD_LIST_DOC.apiList,
      type: "document",
      output: "docs/basic-design/api-list.md",
      title: "API List",
    },
    {
      id: DEFAULT_BD_LIST_DOC.screenList,
      type: "document",
      output: "docs/basic-design/list-screens.md",
      title: "Screen Map",
    },
    {
      id: DEFAULT_BD_LIST_DOC.dbDesign,
      type: "document",
      output: "docs/basic-design/db-design.md",
      title: "Database Design",
    },
  ];
}

/** True when any basic-design list chapter document has no child sections in the graph. */
export function basicDesignListChaptersNeedSections(graph: InMemoryGraph): boolean {
  for (const docId of BASIC_DESIGN_LIST_DOCUMENT_IDS) {
    const doc = graph.nodesById.get(docId);
    if (!doc || doc.type !== "document") {
      continue;
    }
    const hasSection = (graph.outEdges.get(docId) ?? []).some(
      (e) =>
        e.type === "contains" &&
        graph.nodesById.get(e.to)?.type === "section",
    );
    if (!hasSection) {
      return true;
    }
  }
  return false;
}

/** List chapters + section trees from templates; used when bootstrap omitted basic-design registry docs. */
export async function basicDesignAnchorStructurePatch(
  projectRoot: string,
): Promise<ExtractPatch> {
  try {
    const listDocs = await scanBasicDesignListDocuments(projectRoot);
    const listPatches = listDocs.map((d) => registryDocumentToStructurePatch(d));
    const templatePatch: ExtractPatch = {
      version: 1,
      nodes: basicDesignPerDomainTemplateNodes(),
      edges: [],
    };
    return mergeStructurePatches([...listPatches, templatePatch]);
  } catch {
    return {
      version: 1,
      nodes: [
        ...basicDesignAnchorDocumentNodes(),
        ...basicDesignPerDomainTemplateNodes(),
      ],
      edges: [],
    };
  }
}

export interface BuildDocExtractPatchOptions {
  /** When false, do not re-parse api-list / list-screens / db-design bodies (avoids duplicate section trees after bootstrap). */
  includeListChapterMarkdown?: boolean;
}

export async function buildDocExtractPatch(
  entries: DocExtractEntry[],
  _projectRoot?: string,
  options?: BuildDocExtractPatchOptions,
): Promise<{
  patch: ExtractPatch;
  stats: DocExtractResult;
}> {
  const includeListChapterMarkdown = options?.includeListChapterMarkdown !== false;
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
  let srsDetailDocuments = 0;
  let bdDetailDocuments = 0;

  const mergePatchInto = (patch: ExtractPatch) => {
    for (const n of patch.nodes) {
      if (!allNodes.some((x) => x.id === n.id && x.type === n.type)) {
        allNodes.push(n);
        if (n.type === "document" && n.output && !n.outputPattern) {
          const out = String(n.output).replace(/\\/g, "/");
          const isBdInstance =
            n.id.startsWith("doc.bd.api-") ||
            (n.id.startsWith("doc.bd.screen-") &&
              !out.includes("list-screens") &&
              !out.endsWith("api-list.md"));
          const isSrsInstance =
            n.id.startsWith("doc.srs.uc-") || n.id.startsWith("doc.srs.f-");
          if (isBdInstance) {
            detailDocuments++;
            bdDetailDocuments++;
          } else if (isSrsInstance) {
            detailDocuments++;
            srsDetailDocuments++;
          }
        }
        if (
          n.type === "section" &&
          typeof n.documentId === "string" &&
          (n.documentId.startsWith("doc.srs.") || n.documentId.startsWith("doc.bd."))
        ) {
          detailSections++;
        }
      } else {
        const idx = allNodes.findIndex((x) => x.id === n.id);
        const existing = allNodes[idx]!;
        const merged = { ...existing, ...n };
        if (!n.title && existing.title) {
          merged.title = existing.title;
        }
        if (!n.description && existing.description) {
          merged.description = existing.description;
        }
        allNodes[idx] = merged;
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

  const hasBasicDesignFiles = entries.some((e) =>
    normalizeRelativePath(e.relativePath).toLowerCase().startsWith("docs/basic-design/"),
  );
  if (hasBasicDesignFiles) {
    mergePatchInto({
      version: 1,
      nodes: [
        ...basicDesignAnchorDocumentNodes(),
        ...basicDesignPerDomainTemplateNodes(),
      ],
      edges: [],
    });
  }

  for (const e of entries) {
    const single = extractDomainFromMarkdown(e.content, e.relativePath);
    mergePatchInto(parsedDomainToPatch(single, e.relativePath));
    mergePatchInto(
      detailFileToPatch(e.relativePath, e.content, {
        includeListChapterMarkdown,
      }),
    );
  }

  return {
    patch: { version: 1, nodes: allNodes, edges: allEdges },
    stats: {
      useCases: merged.useCases.size,
      features: merged.features.size,
      actors: merged.actors.size,
      detailDocuments,
      detailSections,
      srsDetailDocuments,
      bdDetailDocuments,
      filesScanned: entries.length,
    },
  };
}
