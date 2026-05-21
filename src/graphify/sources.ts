import { createHash } from "node:crypto";
import { readdir, readFile, stat } from "node:fs/promises";
import { join, relative, resolve } from "node:path";
import { pathExists } from "../util/fs.js";

const SKIP_DIRS = new Set(["node_modules", ".git", "graphify-out", ".ai-spector"]);

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
