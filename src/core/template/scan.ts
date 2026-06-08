import { readFile, readdir } from "node:fs/promises";
import { join, relative } from "node:path";
import { visit } from "unist-util-visit";
import { parseMarkdown, textContent } from "../markdown/parse.js";
import type { Heading } from "../markdown/parse.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ScanHeading {
  depth: number;
  text: string;
  order: number;
}

export interface ScanFile {
  relativePath: string; // relative to sourceDir
  headings: ScanHeading[];
  placeholders: string[]; // unique {placeholder} tokens found anywhere in file
}

export interface ScanResult {
  scannedAt: string; // ISO timestamp
  sourceDir: string; // absolute path
  files: ScanFile[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const PLACEHOLDER_RE = /\{([a-zA-Z][a-zA-Z0-9_-]*)\}/g;

function extractPlaceholders(content: string): string[] {
  const root = parseMarkdown(content);
  const found = new Set<string>();

  visit(root, (node) => {
    const type = node.type;
    if (type === "text" || type === "inlineCode" || type === "code") {
      const value = (node as { value: string }).value;
      PLACEHOLDER_RE.lastIndex = 0;
      let m: RegExpExecArray | null;
      while ((m = PLACEHOLDER_RE.exec(value)) !== null) {
        found.add(`{${m[1]}}`);
      }
    }
  });

  return Array.from(found).sort();
}

/** Walk a directory recursively and return absolute paths to all .md files. */
async function collectMdFiles(dir: string): Promise<string[]> {
  const results: string[] = [];

  async function walk(current: string) {
    const entries = await readdir(current, { withFileTypes: true });
    for (const entry of entries) {
      // Skip dot files / dot folders
      if (entry.name.startsWith(".")) continue;
      const full = join(current, entry.name);
      if (entry.isDirectory()) {
        await walk(full);
      } else if (entry.isFile() && entry.name.endsWith(".md")) {
        results.push(full);
      }
    }
  }

  await walk(dir);
  return results.sort();
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

/**
 * Walk `sourceDir`, extract headings + placeholders from each .md file,
 * and return a `ScanResult`. Does NOT write any files — the command does that.
 */
export async function scanTemplateFolder(
  sourceDir: string,
  _stagingDir: string,
): Promise<ScanResult> {
  const mdFiles = await collectMdFiles(sourceDir);

  const files: ScanFile[] = [];

  for (const absPath of mdFiles) {
    const content = await readFile(absPath, "utf-8");
    const root = parseMarkdown(content);

    // Extract headings
    const headings: ScanHeading[] = [];
    let order = 0;
    visit(root, "heading", (node: Heading) => {
      order += 1;
      headings.push({
        depth: node.depth,
        text: textContent(node),
        order,
      });
    });

    // Extract placeholders
    const placeholders = extractPlaceholders(content);

    files.push({
      relativePath: relative(sourceDir, absPath),
      headings,
      placeholders,
    });
  }

  return {
    scannedAt: new Date().toISOString(),
    sourceDir,
    files,
  };
}
