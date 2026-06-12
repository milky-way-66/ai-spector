import type { GraphEdge, GraphNode } from "@/types.js";
import { sectionIdFromHeading } from "../registry/slug.js";
import type { ExtractPatch } from "./knowledge.js";
import {
  BASIC_DESIGN_LIST_DOCUMENT_IDS,
  DEFAULT_BD_LIST_DOC,
  isBasicDesignListChapterDocumentId,
} from "./defaults.js";

const HEADING_RE = /^(#{2,4})\s+(.+)$/;
const SECTION_ANCHOR_RE = /<!--\s*section:\s*([^\s>]+)\s*-->/;
const BLOCKQUOTE_LINE_RE = /^\s*>/;
const FIELD_LINE_RE = /^\s*\*\*[^*]+:\*\*/;
const TABLE_LINE_RE = /^\s*\|/;
const HR_RE = /^---+\s*$/;

export interface ParsedDetailSection {
  id: string;
  heading: string;
  level: number;
  order: number;
}

const BD_INSTANCE_PATH_RE =
  /docs\/basic-design\/(?:api\/|screens\/)/i;

/** List-chapter basic-design documents (api-list, screen map, db-design). */
export function isBasicDesignListChapterDocument(node: GraphNode): boolean {
  return node.type === "document" && isBasicDesignListChapterDocumentId(node.id);
}

/** Whether doc-extract may upsert `section` nodes under this document parent. */
export function allowsSectionUpsertParent(parentDoc: GraphNode): boolean {
  if (isPerDomainInstanceDocument(parentDoc)) {
    return true;
  }
  return isBasicDesignListChapterDocument(parentDoc);
}

/** Per-domain detail markdown instance (not a template document from bootstrap). */
export function isPerDomainInstanceDocument(node: GraphNode): boolean {
  if (node.type !== "document" || node.outputPattern) {
    return false;
  }
  const output = typeof node.output === "string" ? node.output : "";
  if (!output) {
    return false;
  }
  if (node.perDomain === "useCase" || node.perDomain === "feature") {
    return true;
  }
  if (
    node.perDomain === "apiDetail" ||
    node.perDomain === "screenDetail" ||
    BD_INSTANCE_PATH_RE.test(output.replace(/\\/g, "/"))
  ) {
    return true;
  }
  return false;
}

function resolveParentSectionId(
  sections: ParsedDetailSection[],
  index: number,
): string | null {
  const current = sections[index]!;
  if (current.level <= 2) {
    return null;
  }
  for (let i = index - 1; i >= 0; i--) {
    if (sections[i]!.level === current.level - 1) {
      return sections[i]!.id;
    }
  }
  return null;
}

function isSkippableBodyLine(line: string): boolean {
  const t = line.trim();
  if (!t) {
    return true;
  }
  if (HEADING_RE.test(t)) {
    return true;
  }
  if (BLOCKQUOTE_LINE_RE.test(line) || FIELD_LINE_RE.test(line)) {
    return true;
  }
  if (TABLE_LINE_RE.test(line) || HR_RE.test(t)) {
    return true;
  }
  if (t.startsWith("<!--")) {
    return true;
  }
  return false;
}

/** First paragraph of prose after a heading (skips fields, blockquotes, tables). */
export function snippetAfterHeading(content: string, heading: string): string | undefined {
  const lines = content.split(/\r?\n/);
  const needle = heading.trim().toLowerCase();
  let start = -1;

  for (let i = 0; i < lines.length; i++) {
    const m = HEADING_RE.exec(lines[i]!.trim());
    if (m && m[2]!.trim().toLowerCase() === needle) {
      start = i + 1;
      break;
    }
  }
  if (start < 0) {
    return undefined;
  }

  const parts: string[] = [];
  for (let i = start; i < lines.length; i++) {
    const line = lines[i]!;
    if (HEADING_RE.test(line.trim())) {
      break;
    }
    if (isSkippableBodyLine(line)) {
      if (parts.length > 0) {
        break;
      }
      continue;
    }
    const t = line.trim();
    if (BLOCKQUOTE_LINE_RE.test(line)) {
      const quoted = t.replace(/^>\s*/, "").trim();
      if (quoted) {
        parts.push(quoted);
      }
      continue;
    }
    parts.push(t);
    if (parts.join(" ").length >= 40) {
      break;
    }
  }

  const text = parts.join(" ").replace(/\s+/g, " ").trim();
  if (text.length < 12) {
    return undefined;
  }
  return text.length > 320 ? `${text.slice(0, 317)}…` : text;
}

/** Map section headings to body snippets for graph `description` fields. */
export function sectionSnippetsFromContent(
  content: string,
  sections: ParsedDetailSection[],
): Map<string, string> {
  const out = new Map<string, string>();
  for (const sec of sections) {
    const snippet = snippetAfterHeading(content, sec.heading);
    if (snippet) {
      out.set(sec.id, snippet);
    }
  }
  return out;
}

/** Parse `##`–`####` headings and optional `<!-- section:sec.... -->` anchors from detail markdown. */
export function parseDetailSections(
  content: string,
  documentId: string,
): ParsedDetailSection[] {
  const lines = content.split(/\r?\n/);
  const sections: ParsedDetailSection[] = [];
  let order = 0;
  let pendingAnchor: string | undefined;

  for (const line of lines) {
    const trimmed = line.trim();
    const anchorMatch = SECTION_ANCHOR_RE.exec(trimmed);
    if (anchorMatch) {
      pendingAnchor = anchorMatch[1]!.trim();
      continue;
    }
    const m = HEADING_RE.exec(trimmed);
    if (!m) {
      continue;
    }
    const level = m[1]!.length;
    const heading = m[2]!.trim();
    order += 1;
    const id =
      pendingAnchor ?? sectionIdFromHeading(documentId, heading, level, order);
    pendingAnchor = undefined;
    sections.push({ id, heading, level, order });
  }

  return sections;
}

export function detailSectionsToPatch(
  documentId: string,
  sections: ParsedDetailSection[],
  content?: string,
): ExtractPatch {
  const snippets = content ? sectionSnippetsFromContent(content, sections) : new Map();

  const nodes: GraphNode[] = sections.map((sec) => {
    const node: GraphNode = {
      id: sec.id,
      type: "section",
      documentId,
      heading: sec.heading,
      title: sec.heading,
      level: sec.level,
      order: sec.order,
    };
    const description = snippets.get(sec.id);
    if (description) {
      node.description = description;
    }
    return node;
  });

  const edges: GraphEdge[] = [];
  for (let i = 0; i < sections.length; i++) {
    const sec = sections[i]!;
    const parentSectionId = resolveParentSectionId(sections, i);
    const parentId = parentSectionId ?? documentId;
    edges.push({ type: "partOf", from: sec.id, to: parentId });
    edges.push({ type: "contains", from: parentId, to: sec.id });
    if (i > 0) {
      const prev = sections[i - 1]!;
      if (prev.level === sec.level) {
        edges.push({ type: "follows", from: prev.id, to: sec.id });
      }
    }
  }

  return { version: 1, nodes, edges };
}

function normalizeDocPath(relativePath: string): string {
  return relativePath.replace(/\\/g, "/").toLowerCase();
}

/** Map list-chapter markdown paths to graph document ids (includes common wrong paths). */
export function basicDesignListChapterDocumentId(
  relativePath: string,
): string | null {
  const p = normalizeDocPath(relativePath);
  if (p === "docs/basic-design/api-list.md" || p.endsWith("/api-list.md")) {
    return DEFAULT_BD_LIST_DOC.apiList;
  }
  if (p === "docs/basic-design/db-design.md" || p.endsWith("/db-design.md")) {
    return DEFAULT_BD_LIST_DOC.dbDesign;
  }
  if (
    p === "docs/basic-design/screens/list-screens.md" ||
    p === "docs/basic-design/list-screens.md" ||
    p.endsWith("/list-screens.md")
  ) {
    return DEFAULT_BD_LIST_DOC.screenList;
  }
  return null;
}

/** Parse headings from generated list-chapter basic-design files into section nodes. */
export function basicDesignListChapterFileToPatch(
  relativePath: string,
  content: string,
): ExtractPatch {
  const documentId = basicDesignListChapterDocumentId(relativePath);
  if (!documentId) {
    return { version: 1, nodes: [], edges: [] };
  }
  const sections = parseDetailSections(content, documentId);
  if (sections.length === 0) {
    return { version: 1, nodes: [], edges: [] };
  }
  return detailSectionsToPatch(documentId, sections, content);
}

export { BASIC_DESIGN_LIST_DOCUMENT_IDS };
