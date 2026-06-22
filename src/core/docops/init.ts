import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { pathExists, writeJson } from "../util/fs.js";
import { DOCOPS_CONFIG_REL } from "./paths.js";
import {
  inferDocTypesFromTree,
  mergeDocopsDefaults,
  readDocopsConfig,
  writeDocopsConfig,
} from "./config.js";
import {
  copyBootstrapConfig,
  copyBootstrapDocs,
  copyBootstrapTemplates,
  resolveBootstrapRoot,
} from "./bootstrap.js";
import type { DocopsConfig, DocopsDocTypeConfig } from "./types.js";

const LAYER_DEFAULTS: Record<string, Omit<DocopsDocTypeConfig, "enabled">> = {
  srs: { path: "srs", label: "SRS", templatesPath: ".docops/templates/srs" },
  basicDesign: {
    path: "basic-design",
    label: "Basic Design",
    templatesPath: ".docops/templates/basic-design",
  },
  detailDesign: {
    path: "detail-design",
    label: "Detail Design",
    templatesPath: ".docops/templates/detail-design",
  },
};

function parseLanguages(codes?: string[]): Array<{ code: string; label: string; path: string }> {
  const list = (codes?.length ? codes : ["en"]).map((c) => c.trim().toLowerCase()).filter(Boolean);
  return list.map((code) => ({
    code,
    label: code.toUpperCase(),
    path: code,
  }));
}

function buildDocTypes(
  layers: string[] | undefined,
  inferred: Record<string, DocopsDocTypeConfig>,
): Record<string, DocopsDocTypeConfig> {
  const layerKeys = layers?.length
    ? layers
    : Object.keys(inferred).length
      ? Object.keys(inferred)
      : ["srs", "basicDesign"];

  const out: Record<string, DocopsDocTypeConfig> = {};
  for (const key of layerKeys) {
    const base = LAYER_DEFAULTS[key];
    if (!base) continue;
    const inferredLayer = inferred[key];
    out[key] = {
      ...base,
      ...inferredLayer,
      enabled: inferredLayer?.enabled ?? true,
    };
  }
  return out;
}

export async function initDocopsContract(opts: {
  projectRoot: string;
  languages?: string[];
  layers?: string[];
  dryRun?: boolean;
  force?: boolean;
}): Promise<{
  initialized: boolean;
  dryRun: boolean;
  actions: string[];
  configPath: string;
  config?: DocopsConfig;
}> {
  const { projectRoot, dryRun = false, force = false } = opts;
  const actions: string[] = [];
  const configPath = join(projectRoot, DOCOPS_CONFIG_REL).replace(/\\/g, "/");
  const skipExisting = !force;

  const existing = await readDocopsConfig(projectRoot);
  if (existing && !force) {
    return {
      initialized: false,
      dryRun,
      actions: [`skip — ${DOCOPS_CONFIG_REL} already exists (use --force or docops migrate --repair)`],
      configPath,
      config: existing,
    };
  }

  const languages = parseLanguages(opts.languages);
  const inferred = await inferDocTypesFromTree(projectRoot);
  const docTypes = buildDocTypes(opts.layers, inferred);

  const config = mergeDocopsDefaults({
    languages,
    primaryLanguage: languages[0]?.code,
    docTypes,
  });

  if (!existing) {
    actions.push(`${dryRun ? "would write" : "write"} ${DOCOPS_CONFIG_REL}`);
    if (!dryRun) {
      await writeDocopsConfig(projectRoot, config);
    }
  }

  const bundleRoot = resolveBootstrapRoot();
  const copyOpts = { projectRoot, bundleRoot, dryRun, skipExisting, actions };

  await copyBootstrapConfig({ ...copyOpts, config });
  await copyBootstrapDocs(copyOpts);
  await copyBootstrapTemplates({ ...copyOpts, docTypes });

  for (const dir of [
    config.paths.comments,
    config.paths.reviewQueue,
    ".docops/prototype",
    ...Object.values(docTypes).map((d) => d.templatesPath),
  ]) {
    if (!dir) continue;
    actions.push(`${dryRun ? "would mkdir" : "mkdir"} ${dir}`);
    if (!dryRun) await mkdir(join(projectRoot, dir), { recursive: true });
  }

  for (const dt of Object.values(docTypes)) {
    for (const lang of languages) {
      const docsDir = join(projectRoot, config.docsRoot, dt.path, lang.path);
      const gitkeep = join(docsDir, ".gitkeep");
      if (!(await pathExists(gitkeep))) {
        const relGitkeep = join(config.docsRoot, dt.path, lang.path, ".gitkeep");
        actions.push(`${dryRun ? "would write" : "write"} ${relGitkeep}`);
        if (!dryRun) {
          await mkdir(docsDir, { recursive: true });
          await writeFile(gitkeep, "");
        }
      }
    }
  }

  return { initialized: true, dryRun, actions, configPath, config };
}
