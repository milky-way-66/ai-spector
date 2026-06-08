import { createHash } from "node:crypto";
import { readdir, readFile, stat } from "node:fs/promises";
import { basename, join, relative, resolve } from "node:path";
import { InMemoryGraph } from "../graph/InMemoryGraph.js";
import {
  findDocumentNodeIdForPath as findDocumentNodeIdInGraph,
  globToRegExp,
} from "../graph/resolve.js";
import type { TraceabilityGraph } from "../../types.js";
import type { IndexDocsConfig } from "./docs-config.js";
import { INDEX_PLACEHOLDER_MARKERS } from "./docs-config.js";

export { globToRegExp };

export interface DiscoveredDocFile {
  relativePath: string;
  absolutePath: string;
  basename: string;
  sizeBytes: number;
  contentHash: string;
}

export interface IndexEntry {
  basename: string;
  location: string;
  graphNodeId?: string;
  contentHash: string;
  sizeBytes: number;
  previewLine: string;
}

export interface BuiltDocIndex {
  title: string;
  sourceRoot: string;
  indexedAt: string;
  entries: IndexEntry[];
  markdown: string;
}

export async function discoverMarkdownFiles(
  projectRoot: string,
  sourceRoot: string,
  glob = "**/*.md",
): Promise<DiscoveredDocFile[]> {
  const rootAbs = resolve(projectRoot, sourceRoot);
  const pattern = globToRegExp(glob);
  const files: DiscoveredDocFile[] = [];

  async function walk(dir: string): Promise<void> {
    let entries;
    try {
      entries = await readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const ent of entries) {
      const abs = join(dir, ent.name);
      if (ent.isDirectory()) {
        if (ent.name === "node_modules" || ent.name.startsWith(".")) {
          continue;
        }
        await walk(abs);
        continue;
      }
      if (!ent.isFile() || !ent.name.endsWith(".md")) {
        continue;
      }
      const relFromSource = relative(rootAbs, abs).replace(/\\/g, "/");
      if (!pattern.test(relFromSource)) {
        continue;
      }
      const rel = relative(projectRoot, abs).replace(/\\/g, "/");
      const st = await stat(abs);
      const raw = await readFile(abs, "utf8");
      const contentHash = createHash("sha256").update(raw).digest("hex").slice(0, 16);
      files.push({
        relativePath: rel,
        absolutePath: abs,
        basename: basename(abs),
        sizeBytes: st.size,
        contentHash,
      });
    }
  }

  await walk(rootAbs);
  files.sort((a, b) => a.relativePath.localeCompare(b.relativePath));
  return files;
}

export function findDocumentNodeIdForPath(
  graph: TraceabilityGraph | null,
  relativePath: string,
): string | undefined {
  if (!graph) {
    return undefined;
  }
  return findDocumentNodeIdInGraph(InMemoryGraph.from(graph), relativePath);
}

export function firstMeaningfulLine(content: string): string {
  for (const line of content.split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith("<!--")) {
      continue;
    }
    if (t.startsWith("#")) {
      return t.replace(/^#+\s*/, "").slice(0, 120);
    }
    return t.slice(0, 120);
  }
  return "(empty file)";
}

export async function buildDocIndex(params: {
  kind: "srs" | "basicDesign";
  config: IndexDocsConfig;
  projectRoot: string;
  files: DiscoveredDocFile[];
  graph: TraceabilityGraph | null;
  indexedAt?: string;
}): Promise<BuiltDocIndex> {
  const sourceKey = params.kind === "srs" ? "srs" : "basicDesign";
  const source = params.config.sources[sourceKey];
  const sourceRoot = source?.root ?? (params.kind === "srs" ? "docs/srs" : "docs/basic-design");
  const title =
    params.kind === "srs" ? "SRS Document Index" : "Basic Design Document Index";
  const indexedAt = params.indexedAt ?? new Date().toISOString();
  const headingTemplate =
    params.config.entryFormat?.heading ?? "## File: {basename}";

  const entries: IndexEntry[] = [];
  for (const f of params.files) {
    let previewLine = "(unreadable)";
    try {
      const raw = await readFile(f.absolutePath, "utf8");
      previewLine = firstMeaningfulLine(raw);
    } catch {
      previewLine = "(file not readable)";
    }
    entries.push({
      basename: f.basename,
      location: f.relativePath,
      graphNodeId: findDocumentNodeIdForPath(params.graph, f.relativePath),
      contentHash: f.contentHash,
      sizeBytes: f.sizeBytes,
      previewLine,
    });
  }

  const lines: string[] = [
    `# ${title}`,
    "",
    `Last indexed: ${indexedAt} (npx ai-spector index)`,
    "",
  ];

  if (entries.length === 0) {
    lines.push("No entries yet. Source root: `" + sourceRoot + "/`.", "");
  } else {
    for (const e of entries) {
      const heading = headingTemplate.replace("{basename}", e.basename);
      lines.push(heading, "");
      lines.push(`- location: ${e.location}`);
      const meta: string[] = [`sha256=${e.contentHash}`, `bytes=${e.sizeBytes}`];
      if (e.graphNodeId) {
        meta.unshift(`graphNodeId=${e.graphNodeId}`);
      }
      lines.push(`- metadata: ${meta.join(" | ")}`);
      lines.push(`- summary: ${e.previewLine}`);
      lines.push("");
    }
  }

  return {
    title,
    sourceRoot,
    indexedAt,
    entries,
    markdown: lines.join("\n"),
  };
}

export function indexHasPlaceholderContent(markdown: string): boolean {
  return INDEX_PLACEHOLDER_MARKERS.some((m) => markdown.includes(m));
}

export function computeIndexSourceHash(files: DiscoveredDocFile[]): string {
  const payload = files.map((f) => `${f.relativePath}:${f.contentHash}`).join("\n");
  return createHash("sha256").update(payload).digest("hex").slice(0, 16);
}
