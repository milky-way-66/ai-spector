import { readFileSync, readdirSync, statSync } from "node:fs";
import { basename, join } from "node:path";
import {
  loadBasicDesignListManifest,
  loadDocumentsManifest,
  packageBundleRoot,
} from "../config/load.js";
import type { DocumentsManifest } from "../config/types.js";

export type DocopsLayerClass = "builtin-aligned" | "reshaped" | "custom" | "missing";
export type DocopsPrototypeClass = "static-html" | "spa" | "disconnected" | "missing";
export type DocopsLangStrategy = "per-lang-folders" | "flat" | "mixed";

const FILENAME_WEIGHT = 0.55;
const HEADING_WEIGHT = 0.45;
const LANG_CODE = /^[a-z]{2,3}(?:-[a-z]{2})?$/i;
const LAYER_PREFIX =
  /^(?:docs\/srs|docs\/basic-design|docs\/detail-design|docs\/dd|docs\/detail_design)\/([^/]+)(?:\/(.+))?$/;
const DOMAIN_ID_RE = /\b(UC|F|SCR|API)-(\d+)\b/gi;
const PROTOTYPE_SOURCE_DIRS = ["prototype/src", "prototype", "docs/prototype"] as const;
const SPA_FRAMEWORKS = ["react", "vue", "@vue/", "next", "nuxt", "svelte"];
const PROTOTYPE_EXTENSIONS = new Set([".html", ".htm", ".tsx", ".jsx", ".vue"]);

export interface DocopsClassifyFile {
  relativePath: string;
  headings: Array<{ depth: number; text: string }>;
  content?: string;
  ids?: string[];
}

interface ManifestEntry {
  template: string;
  heading: string;
}

let srsManifestCache: ManifestEntry[] | null = null;
let basicDesignManifestCache: ManifestEntry[] | null = null;
let detailDesignManifestCache: ManifestEntry[] | null = null;

function readManifestSync(filename: string): DocumentsManifest {
  const raw = readFileSync(join(packageBundleRoot(), filename), "utf8");
  const manifest = JSON.parse(raw) as DocumentsManifest;
  if (!manifest.templatesDir || !Array.isArray(manifest.documents)) {
    throw new Error(`Invalid ${filename} in ${packageBundleRoot()}`);
  }
  return manifest;
}

function firstHeadingFromTemplate(templatesDir: string, template: string): string {
  const path = join(packageBundleRoot(), templatesDir, template);
  try {
    const content = readFileSync(path, "utf8");
    for (const line of content.split(/\r?\n/)) {
      const match = line.match(/^#{1,6}\s+(.+?)\s*$/);
      if (match) {
        return match[1]!.replace(/\{[^}]+\}/g, "").trim();
      }
    }
  } catch {
    // fall through
  }
  return headingFromFilename(template);
}

function headingFromFilename(template: string): string {
  const stem = template.replace(/\.md$/i, "").replace(/-template$/i, "");
  const parts = stem.split("-").filter((part) => !/^\d+$/.test(part));
  return parts
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ")
    .trim();
}

function buildManifestEntries(manifest: DocumentsManifest): ManifestEntry[] {
  return manifest.documents.map((doc) => ({
    template: doc.template,
    heading: firstHeadingFromTemplate(manifest.templatesDir, doc.template),
  }));
}

function getManifestEntries(layer: "srs" | "basic-design" | "detail-design"): ManifestEntry[] {
  if (layer === "srs") {
    if (!srsManifestCache) {
      srsManifestCache = buildManifestEntries(readManifestSync("documents.json"));
    }
    return srsManifestCache;
  }
  if (layer === "basic-design") {
    if (!basicDesignManifestCache) {
      basicDesignManifestCache = buildManifestEntries(
        readManifestSync("documents-basic-design.json"),
      );
    }
    return basicDesignManifestCache;
  }
  if (!detailDesignManifestCache) {
    detailDesignManifestCache = buildManifestEntries(
      readManifestSync("documents-detail-design.json"),
    );
  }
  return detailDesignManifestCache;
}

function normalizeLabel(text: string): string {
  return text
    .replace(/^[\d.]+\s*/, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]/gu, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

function normalizeFilename(name: string): string {
  return basename(name).replace(/\.md$/i, "").toLowerCase();
}

function filenameStem(name: string): string {
  return normalizeFilename(name).replace(/^\d+-/, "").replace(/-template$/, "");
}

function textSimilarity(a: string, b: string): number {
  const left = normalizeLabel(a);
  const right = normalizeLabel(b);
  if (!left || !right) return 0;
  if (left === right) return 1;
  if (left.includes(right) || right.includes(left)) return 0.9;

  const leftTokens = new Set(left.split("-").filter(Boolean));
  const rightTokens = new Set(right.split("-").filter(Boolean));
  const union = new Set([...leftTokens, ...rightTokens]);
  let intersection = 0;
  for (const token of leftTokens) {
    if (rightTokens.has(token)) intersection += 1;
  }
  return union.size === 0 ? 0 : intersection / union.size;
}

function firstHeadingText(headings: Array<{ depth: number; text: string }>): string {
  const h1 = headings.find((heading) => heading.depth === 1);
  if (h1) return h1.text.trim();
  return headings[0]?.text.trim() ?? "";
}

function scoreAgainstManifestEntry(file: DocopsClassifyFile, entry: ManifestEntry): number {
  const filenameScore = textSimilarity(
    filenameStem(file.relativePath),
    filenameStem(entry.template),
  );
  const headingScore = textSimilarity(firstHeadingText(file.headings), entry.heading);
  return FILENAME_WEIGHT * filenameScore + HEADING_WEIGHT * headingScore;
}

export function scoreBuiltinMatch(
  file: DocopsClassifyFile,
  layer: "srs" | "basic-design" | "detail-design",
): number {
  const entries = getManifestEntries(layer);
  let best = 0;
  for (const entry of entries) {
    best = Math.max(best, scoreAgainstManifestEntry(file, entry));
  }
  return best;
}

export function classifyLayer(
  files: DocopsClassifyFile[],
  layer: "srs" | "basic-design" | "detail-design",
): DocopsLayerClass {
  if (files.length === 0) return "missing";

  const scores = files.map((file) => scoreBuiltinMatch(file, layer));
  const alignedCount = scores.filter((score) => score >= 0.6).length;
  const alignedRatio = alignedCount / files.length;
  const averageScore = scores.reduce((sum, score) => sum + score, 0) / scores.length;

  if (alignedRatio >= 0.7) return "builtin-aligned";

  const hasDomainIds = files.some((file) => {
    const ids = file.ids ?? (file.content ? extractDomainIds(file.content) : []);
    return ids.length > 0;
  });
  if (hasDomainIds && averageScore < 0.7) return "reshaped";

  return "reshaped";
}

export function detectLanguageLayout(paths: string[]): {
  detected: string[];
  strategy: DocopsLangStrategy;
} {
  const normalized = paths.map((path) => path.replace(/\\/g, "/"));
  const langs = new Set<string>();
  let flatCount = 0;
  let langFolderCount = 0;

  for (const path of normalized) {
    const match = path.match(LAYER_PREFIX);
    if (!match) continue;

    const segment = match[1]!;
    const remainder = match[2];
    if (!remainder) {
      if (segment.endsWith(".md")) flatCount += 1;
      continue;
    }

    if (LANG_CODE.test(segment)) {
      langs.add(segment.toLowerCase());
      langFolderCount += 1;
    } else if (segment.endsWith(".md")) {
      flatCount += 1;
    }
  }

  const detected = [...langs].sort();
  if (langFolderCount > 0 && flatCount > 0) {
    return { detected, strategy: "mixed" };
  }
  if (langFolderCount > 0) {
    return { detected, strategy: "per-lang-folders" };
  }
  return { detected: [], strategy: "flat" };
}

export function extractDomainIds(content: string): string[] {
  const seen = new Set<string>();
  const ids: string[] = [];
  for (const match of content.matchAll(DOMAIN_ID_RE)) {
    const id = `${match[1]!.toUpperCase()}-${match[2]}`;
    if (seen.has(id)) continue;
    seen.add(id);
    ids.push(id);
  }
  return ids;
}

function collectPrototypeFiles(root: string): Map<string, string[]> {
  const byRoot = new Map<string, string[]>();

  for (const relDir of PROTOTYPE_SOURCE_DIRS) {
    const absDir = join(root, relDir);
    const files: string[] = [];
    walkPrototypeDir(absDir, files);
    if (files.length > 0) byRoot.set(relDir, files);
  }

  return byRoot;
}

function walkPrototypeDir(currentDir: string, files: string[]): void {
  let entries;
  try {
    entries = readdirSync(currentDir, { withFileTypes: true });
  } catch {
    return;
  }

  for (const entry of entries) {
    if (entry.name.startsWith(".")) continue;
    const absPath = join(currentDir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "node_modules") continue;
      walkPrototypeDir(absPath, files);
      continue;
    }
    const ext = entry.name.slice(entry.name.lastIndexOf(".")).toLowerCase();
    if (PROTOTYPE_EXTENSIONS.has(ext)) {
      files.push(absPath);
    }
  }
}

function hasSpaDependency(packageJsonPath: string): boolean {
  try {
    const pkg = JSON.parse(readFileSync(packageJsonPath, "utf8")) as {
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
    };
    const deps = {
      ...pkg.dependencies,
      ...pkg.devDependencies,
    };
    return Object.keys(deps).some((name) =>
      SPA_FRAMEWORKS.some((framework) =>
        framework.endsWith("/") ? name.startsWith(framework) : name === framework,
      ),
    );
  } catch {
    return false;
  }
}

function classifyPrototypeFiles(
  filesByRoot: Map<string, string[]>,
  root: string,
): DocopsPrototypeClass {
  const prototypePkg = join(root, "prototype", "package.json");
  if (pathExistsSync(prototypePkg) && hasSpaDependency(prototypePkg)) {
    return "spa";
  }

  const allFiles = [...filesByRoot.values()].flat();
  const hasSpaSource = allFiles.some((file) => {
    const ext = file.slice(file.lastIndexOf(".")).toLowerCase();
    return ext === ".tsx" || ext === ".jsx" || ext === ".vue";
  });
  if (hasSpaSource) return "spa";

  const hasHtml = allFiles.some((file) => {
    const ext = file.slice(file.lastIndexOf(".")).toLowerCase();
    return ext === ".html" || ext === ".htm";
  });
  if (hasHtml) {
    const canonical = [
      ...(filesByRoot.get("prototype") ?? []),
      ...(filesByRoot.get("prototype/src") ?? []),
    ];
    const legacy = filesByRoot.get("docs/prototype") ?? [];
    if (legacy.length > 0 && canonical.length === 0) return "disconnected";
    return "static-html";
  }

  return "missing";
}

function pathExistsSync(path: string): boolean {
  try {
    statSync(path);
    return true;
  } catch {
    return false;
  }
}

export function classifyDataSource(
  srsMdCount: number,
  dataSourceMdCount: number,
): "present" | "partial" | "absent" {
  if (dataSourceMdCount === 0) return "absent";
  if (srsMdCount === 0) return "present";
  if (dataSourceMdCount >= srsMdCount) return "present";
  return "partial";
}

export async function classifyPrototype(root: string): Promise<DocopsPrototypeClass> {
  await Promise.all([loadDocumentsManifest(), loadBasicDesignListManifest()]);

  const filesByRoot = collectPrototypeFiles(root);
  if (filesByRoot.size === 0) return "missing";
  return classifyPrototypeFiles(filesByRoot, root);
}

/** Reset cached manifest entries — for tests only. */
export function resetLayoutClassifyCacheForTests(): void {
  srsManifestCache = null;
  basicDesignManifestCache = null;
  detailDesignManifestCache = null;
}
