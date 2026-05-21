import type { GraphEdge, GraphNode } from "../types.js";
import { sectionIdFromHeading } from "../registry/slug.js";
import type { ExtractPatch } from "./knowledge.js";

const HEADING_RE = /^(#{2,4})\s+(.+)$/;
const SECTION_ANCHOR_RE = /<!--\s*section:\s*([^\s>]+)\s*-->/;

export interface ParsedDetailSection {
  id: string;
  heading: string;
  level: number;
  order: number;
}

/** Per-domain detail markdown instance (not a template document from bootstrap). */
export function isPerDomainInstanceDocument(node: GraphNode): boolean {
  return (
    node.type === "document" &&
    typeof node.output === "string" &&
    !node.outputPattern &&
    (node.perDomain === "useCase" || node.perDomain === "feature")
  );
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

/** Parse `###` headings and optional `<!-- section:sec.... -->` anchors from detail markdown. */
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
    if (line.startsWith(">")) {
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
): ExtractPatch {
  const nodes: GraphNode[] = sections.map((sec) => ({
    id: sec.id,
    type: "section",
    documentId,
    heading: sec.heading,
    level: sec.level,
    order: sec.order,
  }));

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
