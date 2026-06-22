import { copyFile, mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { existsSync, readdirSync, statSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { packageBundleRoot } from "../config/load.js";
import { pathExists, writeJson } from "../util/fs.js";
import type { DocopsConfig, DocopsDocTypeConfig } from "./types.js";

const LAYER_TEMPLATE_SUBDIR: Record<string, string> = {
  srs: "srs",
  basicDesign: "basic-design",
  detailDesign: "detail-design",
};

/** Writer-owned bootstrap bundle (monorepo or packaged fallback). */
export function resolveBootstrapRoot(): string {
  const env = process.env.DOCOPS_BOOTSTRAP_ROOT?.trim();
  if (env && existsSync(env)) return resolve(env);

  const monorepo = resolve(packageBundleRoot(), "../../kari-writer/contracts/bootstrap");
  if (existsSync(monorepo)) return monorepo;

  const packaged = join(packageBundleRoot(), "contracts/bootstrap");
  if (existsSync(packaged)) return packaged;

  throw new Error(
    "docops bootstrap bundle not found — set DOCOPS_BOOTSTRAP_ROOT or install kari-writer/contracts/bootstrap",
  );
}

export function listBootstrapDocDestinations(bundleRoot: string): string[] {
  const docsRoot = join(bundleRoot, "docs");
  if (!existsSync(docsRoot)) return [];
  const out: string[] = [];
  const walk = (dir: string) => {
    for (const name of existsSync(dir) ? readdirSync(dir) : []) {
      const full = join(dir, name);
      if (statSync(full).isDirectory()) walk(full);
      else out.push(".docops/" + relative(docsRoot, full).replace(/\\/g, "/"));
    }
  };
  walk(docsRoot);
  return out;
}

async function copyTreeFiles(
  srcDir: string,
  destDir: string,
  mapDest: (rel: string) => string,
  opts: { projectRoot: string; dryRun: boolean; skipExisting: boolean; actions: string[] },
): Promise<void> {
  if (!existsSync(srcDir)) return;

  async function walk(current: string): Promise<void> {
    const entries = await readdir(current, { withFileTypes: true });
    for (const entry of entries) {
      const srcPath = join(current, entry.name);
      if (entry.isDirectory()) {
        await walk(srcPath);
        continue;
      }
      const relFromSrc = relative(srcDir, srcPath).replace(/\\/g, "/");
      const destRel = mapDest(relFromSrc);
      const absDest = join(opts.projectRoot, destRel);
      if (opts.skipExisting && (await pathExists(absDest))) {
        opts.actions.push(`skip — ${destRel} exists`);
        continue;
      }
      opts.actions.push(`${opts.dryRun ? "would write" : "write"} ${destRel}`);
      if (!opts.dryRun) {
        await mkdir(dirname(absDest), { recursive: true });
        await copyFile(srcPath, absDest);
      }
    }
  }

  await walk(srcDir);
}

export async function copyBootstrapDocs(opts: {
  projectRoot: string;
  bundleRoot: string;
  dryRun: boolean;
  skipExisting: boolean;
  actions: string[];
}): Promise<void> {
  const docsSrc = join(opts.bundleRoot, "docs");
  await copyTreeFiles(docsSrc, join(opts.projectRoot, ".docops"), (rel) => `.docops/${rel}`, opts);
}

export async function copyBootstrapConfig(opts: {
  projectRoot: string;
  bundleRoot: string;
  config: DocopsConfig;
  dryRun: boolean;
  skipExisting: boolean;
  actions: string[];
}): Promise<void> {
  const mapping: Array<[string, string]> = [
    ["config/review.config.json", opts.config.paths.reviewConfig],
    [
      "config/review-queue-registry.json",
      join(opts.config.paths.reviewQueue, "registry.json").replace(/\\/g, "/"),
    ],
    [
      "config/review-queue-pending.json",
      join(opts.config.paths.reviewQueue, "pending.json").replace(/\\/g, "/"),
    ],
  ];

  for (const [srcRel, destRel] of mapping) {
    const absDest = join(opts.projectRoot, destRel);
    if (opts.skipExisting && (await pathExists(absDest))) {
      opts.actions.push(`skip — ${destRel} exists`);
      continue;
    }
    const content = await readFile(join(opts.bundleRoot, srcRel), "utf8");
    opts.actions.push(`${opts.dryRun ? "would write" : "write"} ${destRel}`);
    if (!opts.dryRun) {
      await mkdir(dirname(absDest), { recursive: true });
      if (destRel.endsWith(".json") && srcRel.includes("registry")) {
        await writeJson(absDest, JSON.parse(content));
      } else if (destRel.endsWith(".json") && srcRel.includes("pending")) {
        await writeJson(absDest, JSON.parse(content));
      } else if (destRel.endsWith(".json")) {
        await writeJson(absDest, JSON.parse(content));
      } else {
        await writeFile(absDest, content, "utf8");
      }
    }
  }
}

export async function copyBootstrapTemplates(opts: {
  projectRoot: string;
  bundleRoot: string;
  docTypes: Record<string, DocopsDocTypeConfig>;
  dryRun: boolean;
  skipExisting: boolean;
  actions: string[];
}): Promise<void> {
  for (const [key, dt] of Object.entries(opts.docTypes)) {
    const sub = LAYER_TEMPLATE_SUBDIR[key];
    const templatesPath = dt.templatesPath?.trim();
    if (!sub || !templatesPath) continue;
    const srcDir = join(opts.bundleRoot, "templates", sub);
    await copyTreeFiles(srcDir, join(opts.projectRoot, templatesPath), (rel) => `${templatesPath}/${rel}`, opts);
  }
}
