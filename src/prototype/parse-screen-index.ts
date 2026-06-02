import { join } from "node:path";
import { headingSlug } from "../registry/slug.js";
import type { PrototypeConfig, ScreenIndexRow } from "./types.js";

const PLACEHOLDER_RE = /^<[^>]+>$/;

function parseTableRow(line: string): string[] {
  const trimmed = line.trim();
  if (!trimmed.startsWith("|")) {
    return [];
  }
  return trimmed
    .split("|")
    .map((c) => c.trim())
    .filter((_, i, arr) => i > 0 && i < arr.length - 1);
}

function isSeparatorRow(cells: string[]): boolean {
  return cells.every((c) => /^:?-{2,}:?$/.test(c.replace(/\s/g, "")));
}

function isPlaceholderRow(cells: string[]): boolean {
  const first = cells[0]?.trim() ?? "";
  return !first || PLACEHOLDER_RE.test(first) || /^screen\s*\d+$/i.test(first);
}

export function extractScreenIndexSection(
  markdown: string,
  sectionHeading: string,
): string {
  const lines = markdown.split(/\r?\n/);
  const target = sectionHeading.trim().toLowerCase();
  let start = -1;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i]!.trim().toLowerCase() === target) {
      start = i + 1;
      break;
    }
  }
  if (start < 0) {
    throw new Error(`Section not found: ${sectionHeading}`);
  }
  const chunk: string[] = [];
  for (let i = start; i < lines.length; i++) {
    const line = lines[i]!;
    if (/^##\s+/.test(line) && !line.trim().toLowerCase().startsWith("###")) {
      break;
    }
    chunk.push(line);
  }
  return chunk.join("\n");
}

export interface ParseScreenIndexOptions {
  projectRoot: string;
  config: PrototypeConfig;
  listMarkdown: string;
}

/** Parse Screen Index table from list-screens markdown. */
export function parseScreenIndexFromList(
  opts: ParseScreenIndexOptions,
): ScreenIndexRow[] {
  const section = extractScreenIndexSection(
    opts.listMarkdown,
    opts.config.screenIndexSection,
  );
  const tableLines = section.split(/\r?\n/).filter((l) => l.trim().startsWith("|"));
  if (tableLines.length < 2) {
    return [];
  }

  const headerCells = parseTableRow(tableLines[0]!);
  const hasScreenIdCol =
    headerCells[0]?.toLowerCase().replace(/\s+/g, " ") === "screen id";

  const rows: ScreenIndexRow[] = [];
  for (let i = 1; i < tableLines.length; i++) {
    const cells = parseTableRow(tableLines[i]!);
    if (cells.length === 0 || isSeparatorRow(cells) || isPlaceholderRow(cells)) {
      continue;
    }

    let screenId: string;
    let displayName: string;
    let purpose: string | undefined;
    let userRole: string | undefined;

    if (hasScreenIdCol) {
      screenId = cells[0]!.trim();
      displayName = (cells[1] ?? cells[0]!).trim();
      userRole = cells[3]?.trim() || undefined;
      purpose = cells[4]?.trim() || cells[3]?.trim() || undefined;
    } else {
      displayName = cells[0]!.trim();
      screenId = headingSlug(displayName);
      userRole = cells[2]?.trim() || undefined;
      purpose = cells[3]?.trim() || undefined;
    }

    if (!displayName || PLACEHOLDER_RE.test(displayName)) {
      continue;
    }

    const slug = headingSlug(displayName);
    const id = screenId && !PLACEHOLDER_RE.test(screenId) ? screenId : slug;
    const screenDoc = join(opts.config.screenDetailDir, `${slug}.md`).replace(/\\/g, "/");
    const prototypeStem = slug;
    const prototypePath = join(opts.config.srcDir, `${prototypeStem}.html`).replace(
      /\\/g,
      "/",
    );

    rows.push({
      screenId: id,
      displayName,
      purpose,
      userRole,
      slug,
      screenDoc,
      prototypeStem,
      prototypePath,
    });
  }

  return rows;
}
