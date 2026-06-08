import type { GraphEdge, GraphNode } from "../../types.js";
import type { PackManifest } from "../config/types.js";
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
import {
  extractBlockquoteAfterBoldField,
  extractBoldFieldDeep,
  extractBoldFieldInParagraph,
  findHeadingText,
  parseMarkdown,
  textContent,
} from "../markdown/parse.js";
import type { Paragraph } from "../markdown/parse.js";
import { visit } from "unist-util-visit";

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

/**
 * Builtin fallback for per-domain template doc IDs.
 * Prefer PackManifest.perDomainTemplates when a pack config is available.
 * @deprecated Use packConfig?.perDomainTemplates instead.
 */
const BUILTIN_PER_DOMAIN_TEMPLATE_DOC: Record<string, string> = {
  useCase: "doc.srs.uc-detail",
  feature: "doc.srs.feature-detail",
};

const UC_ID_RE = /\b(UC-\d+)\b/gi;
const F_ID_RE = /\b(F-\d+)\b/gi;
const TABLE_ROW_UC = /^\|\s*(UC-\d+)\s*\|/im;
const TABLE_ROW_F = /^\|\s*(F-\d+)\s*\|/im;
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
  nodePrefix?: string,
): string {
  const prefix = nodePrefix ?? "doc.srs";
  const norm = normalizeDomainId(domainId);
  return kind === "useCaseDetail"
    ? `${prefix}.uc-${norm}`
    : `${prefix}.f-${norm}`;
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
  const root = parseMarkdown(content);
  const fIdVal = extractBoldFieldDeep(root, /^Feature ID$/i);
  if (fIdVal) {
    const m = fIdVal.match(/\b(F-\d+)\b/i);
    if (m?.[1] && isRealDomainId(m[1])) featureIds.add(normalizeDomainId(m[1]));
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
  const root = parseMarkdown(content);

  if (kind === "useCaseDetail") {
    const idVal = extractBoldFieldDeep(root, /^Use Case ID$/i);
    if (idVal) {
      const m = idVal.match(/\b(UC-\d+)\b/i);
      if (m?.[1] && isRealDomainId(m[1])) {
        const nameVal = extractBoldFieldDeep(root, /^Use Case Name$/i);
        return { id: normalizeDomainId(m[1]), title: nameVal?.trim() };
      }
    }
    const hText = findHeadingText(root, /\bUC-\d+\b/);
    if (hText) {
      const hm = hText.match(/\b(UC-\d+)\b\s*[:\-–—]\s*(.+)$/i);
      if (hm?.[1] && isRealDomainId(hm[1])) {
        return { id: normalizeDomainId(hm[1]), title: hm[2]?.trim() };
      }
    }
    return null;
  }

  const idVal = extractBoldFieldDeep(root, /^Feature ID$/i);
  if (idVal) {
    const m = idVal.match(/\b(F-\d+)\b/i);
    if (m?.[1] && isRealDomainId(m[1])) {
      const hText = findHeadingText(root, /\bF-\d+\b/);
      let title: string | undefined;
      if (hText) {
        const hm = hText.match(/\b(F-\d+)\b\s*[:\-–—]\s*(.+)$/i);
        title = hm?.[2]?.trim();
      }
      return { id: normalizeDomainId(m[1]), title };
    }
  }
  const hText = findHeadingText(root, /\bF-\d+\b/);
  if (hText) {
    const hm = hText.match(/\b(F-\d+)\b\s*[:\-–—]\s*(.+)$/i);
    if (hm?.[1] && isRealDomainId(hm[1])) {
      return { id: normalizeDomainId(hm[1]), title: hm[2]?.trim() };
    }
  }
  return null;
}

export interface DetailDomainMeta {
  title?: string;
  description?: string;
  priority?: string;
}

/** Rich title/description from generated detail markdown (not list-table stubs). */
export function extractDetailDomainMeta(
  content: string,
  kind: DetailFileKind,
): DetailDomainMeta | null {
  const primary = primaryDomainIdFromDetailContent(content, kind);
  if (!primary) return null;

  const root = parseMarkdown(content);
  const meta: DetailDomainMeta = {};

  if (primary.title) meta.title = primary.title;

  const nameVal = extractBoldFieldDeep(root, /^Use Case Name$/i);
  if (nameVal?.trim()) meta.title = nameVal.trim();

  if (kind === "useCaseDetail") {
    const brief = extractBlockquoteAfterBoldField(root, /^Brief Description$/i);
    if (brief) meta.description = brief;

    const priorityVal = extractBoldFieldDeep(root, /^Priority$/i);
    if (priorityVal && /^(High|Medium|Low)$/i.test(priorityVal.trim())) {
      meta.priority = priorityVal.trim();
    }

    if (!meta.description) {
      const sections = parseDetailSections(content, "doc.temp");
      const overview = sections.find((s) => OVERVIEW_HEADING.test(s.heading));
      if (overview) meta.description = snippetAfterHeading(content, overview.heading);
    }
  } else {
    const purpose = extractBlockquoteAfterBoldField(
      root,
      /^(?:Feature Purpose|Purpose)$/i,
    );
    if (purpose) meta.description = purpose;

    if (!meta.description) {
      const sections = parseDetailSections(content, "doc.temp");
      const descSec = sections.find((s) => FEATURE_DESC_HEADING.test(s.heading));
      if (descSec) meta.description = snippetAfterHeading(content, descSec.heading);
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
  const root = parseMarkdown(content);

  // --- 1. Headings: ## UC-01: Title, ## F-01: Title ---
  for (const node of root.children) {
    if (node.type !== "heading") continue;
    const text = textContent(node);
    const ucm = text.match(/\b(UC-\d+)\b\s*[:\-–—]\s*(.+)$/i);
    if (ucm?.[1] && isRealDomainId(ucm[1])) {
      addUseCase(parsed, ucm[1], { title: ucm[2]?.trim() });
    }
    const fm = text.match(/\b(F-\d+)\b\s*[:\-–—]\s*(.+)$/i);
    if (fm?.[1] && isRealDomainId(fm[1])) {
      addFeature(parsed, fm[1], { title: fm[2]?.trim() });
    }
  }

  // --- 2. Bold field patterns in paragraphs (AST-based) ---
  let pendingUcId: string | undefined;
  for (const node of root.children) {
    if (node.type === "heading" && pendingUcId) {
      pendingUcId = undefined;
    }
    if (node.type !== "paragraph") continue;
    const para = node as Paragraph;

    const ucIdVal = extractBoldFieldInParagraph(para, /^Use Case ID$/i);
    if (ucIdVal) {
      const m = ucIdVal.match(/\b(UC-\d+)\b/i);
      if (m?.[1] && isRealDomainId(m[1])) {
        pendingUcId = normalizeDomainId(m[1]);
        addUseCase(parsed, pendingUcId, {});
      }
    }
    if (pendingUcId) {
      const nameVal = extractBoldFieldInParagraph(para, /^Use Case Name$/i);
      if (nameVal) {
        addUseCase(parsed, pendingUcId, { title: nameVal });
        pendingUcId = undefined;
      }
    }

    const fIdVal = extractBoldFieldInParagraph(para, /^Feature ID$/i);
    if (fIdVal) {
      const m = fIdVal.match(/\b(F-\d+)\b/i);
      if (m?.[1] && isRealDomainId(m[1])) addFeature(parsed, m[1], {});
    }
  }

  // --- 3. Actor extraction from paragraphs and list items (AST-based) ---
  visit(root, "paragraph", (para: Paragraph) => {
    const actorVal = extractBoldFieldInParagraph(para, /^Primary Actor$/i);
    if (actorVal && !/^tbd$/i.test(actorVal) && actorVal.length > 1) {
      const id = `actor.${slugActorId(actorVal)}`;
      parsed.actors.set(id, { title: actorVal });
    }
  });

  // --- 4. Table rows (line-based: handles GFM and non-GFM pipe tables) ---
  for (const line of content.split(/\r?\n/)) {
    const ucRow = line.match(TABLE_ROW_UC);
    if (ucRow?.[1]) {
      const cells = line.split("|").map((c) => c.trim());
      const title = cells[2] || cells[1];
      addUseCase(parsed, ucRow[1], {
        title: title && !/^UC-/i.test(title) ? title : undefined,
      });
    }
    const fRow = line.match(TABLE_ROW_F);
    if (fRow?.[1]) {
      const cells = line.split("|").map((c) => c.trim());
      const title = cells[2] || cells[1];
      addFeature(parsed, fRow[1], {
        title: title && !/^F-/i.test(title) ? title : undefined,
      });
      parseTableSatisfies(line, parsed);
    } else if (/^\|.*F-\d+/i.test(line) && /UC-/i.test(line)) {
      parseTableSatisfies(line, parsed);
    }
  }

  // --- 5. Global catch-all scan (picks up any remaining UC/F references) ---
  for (const m of content.matchAll(UC_ID_RE)) {
    if (m[1] && isRealDomainId(m[1])) addUseCase(parsed, m[1], {});
  }
  for (const m of content.matchAll(F_ID_RE)) {
    if (m[1] && isRealDomainId(m[1])) addFeature(parsed, m[1], {});
  }

  // --- 6. Rich metadata from SRS detail files ---
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

  // --- 7. Basic-design detail metadata ---
  const bdKind = classifyBasicDesignDetailFile(relativePath);
  if (bdKind) {
    const meta = extractBasicDesignDetailMeta(content, bdKind, relativePath);
    for (const featureId of meta.featureIds) {
      addFeature(parsed, featureId, {
        description: extractBasicDesignDetailDescription(content, bdKind),
      });
    }
  }

  return parsed;
}

function extractBasicDesignDetailDescription(
  content: string,
  kind: BasicDesignDetailKind,
): string | undefined {
  if (kind === "apiDetail") {
    const meta = extractDetailDomainMeta(content, "featureDetail");
    return meta?.description;
  }
  const root = parseMarkdown(content);
  const purpose = extractBlockquoteAfterBoldField(root, /^Purpose$/i);
  if (purpose) return purpose;
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
  // Anchor to the primary (first) section only — one definedIn is enough for validation
  // and avoids flooding the graph with edges to every section.
  edges.push({
    type: "definedIn",
    from: opts.domainId,
    to: sections[0]?.id ?? opts.docId,
  });

  return { version: 1, nodes, edges };
}

function srsDetailFileToPatch(
  relativePath: string,
  content: string,
  packConfig?: PackManifest | null,
): ExtractPatch {
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
  const nodePrefix = packConfig?.nodePrefix;
  const templateDocId =
    packConfig?.perDomainTemplates?.[perDomain] ??
    BUILTIN_PER_DOMAIN_TEMPLATE_DOC[perDomain] ??
    `doc.srs.${perDomain === "useCase" ? "uc-detail" : "feature-detail"}`;
  const listAnchorId =
    packConfig?.defaultListedIn?.[perDomain] ??
    (perDomain === "useCase" ? DEFAULT_LISTED_IN.useCase : DEFAULT_LISTED_IN.feature);

  return buildDetailInstancePatch({
    relativePath,
    content,
    docId: documentIdForDomainDetail(kind, primary.id, nodePrefix),
    domainId: primary.id,
    domainType: perDomain === "useCase" ? "useCase" : "feature",
    perDomain,
    templateDocId,
    listAnchorId,
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

  const srs = srsDetailFileToPatch(relativePath, content, options?.packConfig);
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
  /** Active pack config for resolving template doc IDs, node prefixes, etc. */
  packConfig?: PackManifest | null;
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

  const allNodesMap = new Map<string, GraphNode>();
  const allEdges: GraphEdge[] = [];
  const edgeKeys = new Set<string>();
  let detailDocuments = 0;
  let detailSections = 0;
  let srsDetailDocuments = 0;
  let bdDetailDocuments = 0;

  const mergePatchInto = (patch: ExtractPatch) => {
    for (const n of patch.nodes) {
      const existing = allNodesMap.get(n.id);
      if (!existing) {
        allNodesMap.set(n.id, n);
        if (n.type === "document" && n.output && !n.outputPattern) {
          const isBdInstance =
            n.perDomain === "apiDetail" || n.perDomain === "screenDetail";
          const isSrsInstance =
            n.perDomain === "useCase" || n.perDomain === "feature";
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
          (n.documentId.startsWith("doc.srs.") ||
            n.documentId.startsWith("doc.bd.") ||
            allNodesMap.get(n.documentId)?.perDomain != null)
        ) {
          detailSections++;
        }
      } else {
        const merged: GraphNode = { ...existing, ...n };
        if (!n.title && existing.title) {
          merged.title = existing.title;
        }
        if (!n.description && existing.description) {
          merged.description = existing.description;
        }
        if (n.type === "document" && !n.output && existing.output) {
          merged.output = existing.output;
        }
        allNodesMap.set(n.id, merged);
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
    patch: { version: 1, nodes: [...allNodesMap.values()], edges: allEdges },
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
