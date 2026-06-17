import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { pathExists } from "../util/fs.js";
import { logicalPathToDocPath, logicalPathToPrototypePath } from "./paths.js";
import type { PrototypeCommentAnchor } from "./types.js";

const SECTION_ANCHOR_RE = /<!--\s*section:\s*([^\s>]+)\s*-->/;
const HEADING_RE = /^(#{1,6})\s+(.+)$/;

export interface DocAnchorContext {
  docPath: string;
  startLine: number;
  endLine: number;
  /** 1-based line range text from the document */
  anchoredText: string;
  /** Nearest markdown heading at or above startLine */
  heading?: string;
  /** Section anchor comment at or above startLine */
  sectionAnchor?: string;
  /** Total lines in document */
  lineCount: number;
}

export interface PrototypeAnchorContext {
  prototypePath: string;
  url: string;
  selector: string;
  textExcerpt?: string;
  tagName?: string;
  /** HTML file content (truncated when very large). */
  htmlPreview: string;
}

export async function readPrototypeAnchorContext(
  projectRoot: string,
  logicalPath: string,
  anchor: PrototypeCommentAnchor,
): Promise<PrototypeAnchorContext | null> {
  const prototypePath = logicalPathToPrototypePath(logicalPath);
  if (!prototypePath) {
    return null;
  }
  const abs = join(projectRoot, prototypePath);
  if (!(await pathExists(abs))) {
    return null;
  }

  const raw = await readFile(abs, "utf8");
  const htmlPreview = raw.length > 4000 ? `${raw.slice(0, 4000)}\n…` : raw;

  return {
    prototypePath,
    url: anchor.url,
    selector: anchor.selector,
    textExcerpt: anchor.textExcerpt,
    tagName: anchor.tagName,
    htmlPreview,
  };
}

export async function readDocAnchorContext(
  projectRoot: string,
  logicalPath: string,
  startLine: number,
  endLine: number,
): Promise<DocAnchorContext | null> {
  const docPath = logicalPathToDocPath(logicalPath);
  if (!docPath) {
    return null;
  }
  const abs = join(projectRoot, docPath);
  if (!(await pathExists(abs))) {
    return null;
  }

  const raw = await readFile(abs, "utf8");
  const lines = raw.split("\n");
  const start = Math.max(1, startLine);
  const end = Math.min(lines.length, Math.max(endLine, startLine));
  const slice = lines.slice(start - 1, end);
  const anchoredText = slice.join("\n");

  let heading: string | undefined;
  let sectionAnchor: string | undefined;
  for (let i = start - 1; i >= 0; i--) {
    const line = lines[i] ?? "";
    if (!sectionAnchor) {
      const anchorMatch = line.match(SECTION_ANCHOR_RE);
      if (anchorMatch) {
        sectionAnchor = anchorMatch[1];
      }
    }
    if (!heading) {
      const h = line.match(HEADING_RE);
      if (h) {
        heading = h[2].trim();
      }
    }
    if (heading && sectionAnchor) {
      break;
    }
  }

  return {
    docPath,
    startLine: start,
    endLine: end,
    anchoredText,
    heading,
    sectionAnchor,
    lineCount: lines.length,
  };
}

export function previewCommentBody(body: string, maxLen = 120): string {
  const oneLine = body.replace(/\s+/g, " ").trim();
  if (oneLine.length <= maxLen) {
    return oneLine;
  }
  return `${oneLine.slice(0, maxLen - 1)}…`;
}
