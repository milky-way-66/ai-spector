import { createHash } from "node:crypto";
import { readdir, readFile, stat } from "node:fs/promises";
import { extname, join, relative, resolve } from "node:path";
import { pathExists } from "../util/fs.js";

const SKIP_DIRS = new Set(["node_modules", ".git", "graphify-out", ".ai-spector"]);

/**
 * Extensions Graphify `update` / `watch` index via AST (graphify.detect.CODE_EXTENSIONS).
 * Markdown-only doc trees (docs/srs, docs/basic-design) have no matches → skip before spawn.
 */
export const GRAPHIFY_CODE_EXTENSIONS = new Set([
  ".py",
  ".ts",
  ".js",
  ".jsx",
  ".tsx",
  ".mjs",
  ".ejs",
  ".go",
  ".rs",
  ".java",
  ".groovy",
  ".gradle",
  ".cpp",
  ".cc",
  ".cxx",
  ".c",
  ".h",
  ".hpp",
  ".rb",
  ".swift",
  ".kt",
  ".kts",
  ".cs",
  ".scala",
  ".php",
  ".lua",
  ".luau",
  ".toc",
  ".zig",
  ".ps1",
  ".ex",
  ".exs",
  ".m",
  ".mm",
  ".jl",
  ".vue",
  ".svelte",
  ".astro",
  ".dart",
  ".v",
  ".sv",
  ".sql",
  ".r",
  ".f",
  ".F",
  ".f90",
  ".F90",
  ".f95",
  ".F95",
  ".f03",
  ".F03",
  ".f08",
  ".F08",
  ".pas",
  ".pp",
  ".dpr",
  ".dpk",
  ".lpr",
  ".inc",
  ".dfm",
  ".lfm",
  ".lpk",
  ".sh",
  ".bash",
  ".json",
]);

export type GraphifySourceSkipReason = "empty" | "no-code-files";

export interface SourceFileFingerprint {
  relativePath: string;
  contentHash: string;
}

export async function discoverSourceFingerprints(
  projectRoot: string,
  sourceRoot: string,
): Promise<SourceFileFingerprint[]> {
  const rootAbs = resolve(projectRoot, sourceRoot);
  const files: SourceFileFingerprint[] = [];

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
        if (ent.name.startsWith(".") || SKIP_DIRS.has(ent.name)) {
          continue;
        }
        await walk(abs);
        continue;
      }
      if (!ent.isFile()) {
        continue;
      }
      const rel = relative(projectRoot, abs).replace(/\\/g, "/");
      const raw = await readFile(abs);
      const contentHash = createHash("sha256").update(raw).digest("hex").slice(0, 16);
      files.push({ relativePath: rel, contentHash });
    }
  }

  await walk(rootAbs);
  files.sort((a, b) => a.relativePath.localeCompare(b.relativePath));
  return files;
}

export interface GraphifySourceSpec {
  /** CLI path relative to project root */
  path: string;
  /** Key for state.graphify.sourceHashes */
  key: string;
}

export interface GraphifySourcesConfig {
  defaultDataSource?: string;
  include?: string[];
  docSources?: string[];
}

/** Central graphify-out under project root (absolute path for GRAPHIFY_OUT). */
export function resolveGraphifyOutputPath(
  projectRoot: string,
  outputPathRel?: string,
): string {
  const rel =
    outputPathRel ?? ".ai-spector/.docflow/graph/graphify-out";
  return resolve(projectRoot, rel);
}

/** True when the source dir exists but has no files to fingerprint (empty tree). */
export async function isGraphifySourceEmpty(
  projectRoot: string,
  sourceRel: string,
): Promise<boolean> {
  return (await getGraphifySourceSkipReason(projectRoot, sourceRel)) === "empty";
}

/** True when Graphify `update` would find no AST-indexable code files under the source. */
export async function hasGraphifyCodeFiles(
  projectRoot: string,
  sourceRel: string,
): Promise<boolean> {
  const files = await discoverSourceFingerprints(projectRoot, sourceRel);
  return files.some((f) =>
    GRAPHIFY_CODE_EXTENSIONS.has(extname(f.relativePath).toLowerCase()),
  );
}

/**
 * Why a source should not run `graphify update` (empty dir or markdown/docs only).
 * Returns null when the path is missing, not a directory, or has code files to index.
 */
export async function getGraphifySourceSkipReason(
  projectRoot: string,
  sourceRel: string,
): Promise<GraphifySourceSkipReason | null> {
  const abs = resolve(projectRoot, sourceRel);
  if (!(await pathExists(abs))) {
    return null;
  }
  const st = await stat(abs).catch(() => null);
  if (!st?.isDirectory()) {
    return null;
  }
  const files = await discoverSourceFingerprints(projectRoot, sourceRel);
  if (files.length === 0) {
    return "empty";
  }
  const hasCode = files.some((f) =>
    GRAPHIFY_CODE_EXTENSIONS.has(extname(f.relativePath).toLowerCase()),
  );
  return hasCode ? null : "no-code-files";
}

/** Pre-check before spawning Graphify CLI (empty tree or no code extensions). */
export async function isGraphifySourceSkippable(
  projectRoot: string,
  sourceRel: string,
): Promise<{ skip: true; reason: GraphifySourceSkipReason } | { skip: false }> {
  const reason = await getGraphifySourceSkipReason(projectRoot, sourceRel);
  if (reason) {
    return { skip: true, reason };
  }
  return { skip: false };
}

const GRAPHIFY_NO_CODE_FILES_RE = /no code files found/i;

/** Graphify watch/update exit 1 when the tree has nothing to rebuild. */
export function isGraphifyNoCodeFilesOutput(
  stdout: string,
  stderr: string,
  exitCode: number,
): boolean {
  return exitCode !== 0 && GRAPHIFY_NO_CODE_FILES_RE.test(`${stdout}\n${stderr}`);
}

export function resolveGraphifySources(
  config: GraphifySourcesConfig,
): GraphifySourceSpec[] {
  const seen = new Set<string>();
  const out: GraphifySourceSpec[] = [];

  const add = (path: string) => {
    const norm = path.replace(/\\/g, "/").replace(/\/$/, "");
    if (seen.has(norm)) {
      return;
    }
    seen.add(norm);
    out.push({ path: norm, key: norm });
  };

  const primary = config.defaultDataSource ?? "docs/data-source";
  add(primary);

  for (const p of config.include ?? []) {
    add(p);
  }
  for (const p of config.docSources ?? []) {
    add(p);
  }

  return out;
}

export async function computeSourceContentHash(
  projectRoot: string,
  sourceRel: string,
): Promise<string | undefined> {
  const abs = resolve(projectRoot, sourceRel);
  if (!(await pathExists(abs))) {
    return undefined;
  }
  const files = await discoverSourceFingerprints(projectRoot, sourceRel);
  if (files.length === 0) {
    return createHash("sha256").update(`empty:${sourceRel}`).digest("hex").slice(0, 16);
  }
  const payload = files.map((f) => `${f.relativePath}:${f.contentHash}`).join("\n");
  return createHash("sha256").update(payload).digest("hex").slice(0, 16);
}

export async function filterSourcesByHashChange(
  projectRoot: string,
  specs: GraphifySourceSpec[],
  storedHashes: Record<string, string> | undefined,
  force: boolean,
): Promise<{ toRun: GraphifySourceSpec[]; hashes: Record<string, string> }> {
  const hashes: Record<string, string> = { ...storedHashes };
  const toRun: GraphifySourceSpec[] = [];

  for (const spec of specs) {
    const hash = await computeSourceContentHash(projectRoot, spec.path);
    if (hash === undefined) {
      continue;
    }
    hashes[spec.key] = hash;
    if (force || storedHashes?.[spec.key] !== hash) {
      toRun.push(spec);
    }
  }

  return { toRun, hashes };
}
