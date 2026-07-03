import { copyFile, mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { existsSync, readdirSync, statSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { packageBundleRoot } from "../config/load.js";
import { pathExists, writeJson } from "../util/fs.js";
import { resolveDocTypeRepoPath } from "./paths.js";
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

  const monorepo = resolve(packageBundleRoot(), "../kari-writer/contracts/bootstrap");
  if (existsSync(monorepo)) return monorepo;

  const monorepoLegacy = resolve(packageBundleRoot(), "../../kari-writer/contracts/bootstrap");
  if (existsSync(monorepoLegacy)) return monorepoLegacy;

  const packaged = join(packageBundleRoot(), "contracts/bootstrap");
  if (existsSync(packaged)) return packaged;

  throw new Error(
    "docops bootstrap bundle not found — set DOCOPS_BOOTSTRAP_ROOT or install kari-writer/contracts/bootstrap",
  );
}

export function resolveContractsRoot(bundleRoot: string): string {
  const env = process.env.DOCOPS_CONTRACTS_ROOT?.trim();
  if (env && existsSync(env)) return resolve(env);
  const sibling = resolve(bundleRoot, "..");
  if (existsSync(join(sibling, "schemas"))) return sibling;
  const bundled = join(bundleRoot, "schemas");
  if (existsSync(bundled)) return bundleRoot;
  const monorepo = resolve(packageBundleRoot(), "../kari-writer/contracts");
  if (existsSync(join(monorepo, "schemas"))) return monorepo;
  const monorepoLegacy = resolve(packageBundleRoot(), "../../kari-writer/contracts");
  if (existsSync(join(monorepoLegacy, "schemas"))) return monorepoLegacy;
  const siblingRepo = resolve(packageBundleRoot(), "../kari-writer/contracts");
  if (existsSync(join(siblingRepo, "schemas"))) return siblingRepo;
  throw new Error("docops contracts root not found — set DOCOPS_CONTRACTS_ROOT");
}

export function listBootstrapDocDestinations(bundleRoot: string): string[] {
  const docsRoot = join(bundleRoot, "docs");
  if (!existsSync(docsRoot)) return [];
  const out: string[] = [];
  const walk = (dir: string) => {
    for (const name of existsSync(dir) ? readdirSync(dir) : []) {
      const full = join(dir, name);
      if (statSync(full).isDirectory()) walk(full);
      else out.push(".docops/guide/" + relative(docsRoot, full).replace(/\\/g, "/"));
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
  await copyTreeFiles(
    docsSrc,
    join(opts.projectRoot, ".docops/guide"),
    (rel) => `.docops/guide/${rel}`,
    opts,
  );
}

export async function copyBootstrapContractAssets(opts: {
  projectRoot: string;
  bundleRoot: string;
  dryRun: boolean;
  skipExisting: boolean;
  actions: string[];
}): Promise<void> {
  const contractsRoot = resolveContractsRoot(opts.bundleRoot);
  const modulesSrc = join(contractsRoot, "modules");
  await copyTreeFiles(
    modulesSrc,
    join(opts.projectRoot, ".docops/guide/modules"),
    (rel) => `.docops/guide/modules/${rel}`,
    opts,
  );
  const schemasSrc = existsSync(join(contractsRoot, "schemas"))
    ? join(contractsRoot, "schemas")
    : join(opts.bundleRoot, "schemas");
  await copyTreeFiles(
    schemasSrc,
    join(opts.projectRoot, ".docops/guide/schemas"),
    (rel) => `.docops/guide/schemas/${rel}`,
    opts,
  );
  const examplesSrc = existsSync(join(contractsRoot, "examples"))
    ? join(contractsRoot, "examples")
    : join(opts.bundleRoot, "examples");
  await copyTreeFiles(
    examplesSrc,
    join(opts.projectRoot, ".docops/guide/examples"),
    (rel) => `.docops/guide/examples/${rel}`,
    opts,
  );
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
    ["config/prototype.config.json", opts.config.paths.prototypeConfig],
    ["config/prototype-screen-map.json", opts.config.paths.prototypeScreenMap],
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

/** Scaffold Writer contract files from the bootstrap bundle (shared by init and migrate). */
export async function applyDocopsBootstrap(opts: {
  projectRoot: string;
  config: DocopsConfig;
  dryRun: boolean;
  skipExisting: boolean;
  actions: string[];
}): Promise<void> {
  const bundleRoot = resolveBootstrapRoot();
  const docTypes = opts.config.docTypes ?? {};
  const copyOpts = {
    projectRoot: opts.projectRoot,
    bundleRoot,
    dryRun: opts.dryRun,
    skipExisting: opts.skipExisting,
    actions: opts.actions,
  };

  await copyBootstrapConfig({ ...copyOpts, config: opts.config });
  await copyBootstrapDocs(copyOpts);
  await copyBootstrapContractAssets(copyOpts);
  await copyBootstrapTemplates({ ...copyOpts, docTypes });

  const dirs = new Set<string>([
    opts.config.paths.registry,
    opts.config.paths.comments,
    opts.config.paths.reviewQueue,
    ".docops/prototype",
    ...Object.values(docTypes)
      .filter((d) => d?.enabled !== false)
      .map((d) => d.templatesPath)
      .filter((p): p is string => Boolean(p?.trim())),
  ]);

  for (const dir of dirs) {
    opts.actions.push(`${opts.dryRun ? "would mkdir" : "mkdir"} ${dir}`);
    if (!opts.dryRun) {
      await mkdir(join(opts.projectRoot, dir), { recursive: true });
    }
  }

  const languages = opts.config.languages ?? [];
  for (const dt of Object.values(docTypes)) {
    if (dt?.enabled === false || !dt?.path) continue;
    const repoFolder = resolveDocTypeRepoPath(dt.path);
    for (const lang of languages) {
      const langPath = lang.path ?? lang.code;
      const relGitkeep = join(repoFolder, langPath, ".gitkeep").replace(/\\/g, "/");
      const absGitkeep = join(opts.projectRoot, relGitkeep);
      if (opts.skipExisting && (await pathExists(absGitkeep))) {
        opts.actions.push(`skip — ${relGitkeep} exists`);
        continue;
      }
      opts.actions.push(`${opts.dryRun ? "would write" : "write"} ${relGitkeep}`);
      if (!opts.dryRun) {
        await mkdir(dirname(absGitkeep), { recursive: true });
        await writeFile(absGitkeep, "");
      }
    }
  }
}
