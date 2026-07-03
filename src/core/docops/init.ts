import { join } from "node:path";
import { DOCOPS_CONFIG_REL } from "./paths.js";
import {
  inferDocTypesFromTree,
  mergeDocopsDefaults,
  readDocopsConfig,
  writeDocopsConfig,
} from "./config.js";
import { applyDocopsBootstrap } from "./bootstrap.js";
import { migrateRootDataSourceToCanonical } from "./data-source-path.js";
import { bootstrapEntityRegistry } from "./entity-keying.js";
import type { DocopsConfig, DocopsDocTypeConfig } from "./types.js";

const LAYER_DEFAULTS: Record<string, Omit<DocopsDocTypeConfig, "enabled">> = {
  srs: { path: "docs/srs", label: "SRS", templatesPath: ".docops/templates/srs" },
  basicDesign: {
    path: "docs/basic-design",
    label: "Basic Design",
    templatesPath: ".docops/templates/basic-design",
  },
  detailDesign: {
    path: "docs/detail-design",
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
      // Keep an explicit configured path; defaults only fill gaps.
      path: inferredLayer?.path?.trim() || base.path,
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

  if (!dryRun) {
    const migration = await migrateRootDataSourceToCanonical(projectRoot);
    for (const line of migration.migrated) {
      actions.push(`migrate — ${line}`);
    }
  }

  await applyDocopsBootstrap({
    projectRoot,
    config,
    dryRun,
    skipExisting,
    actions,
  });

  if (!dryRun) {
    await bootstrapEntityRegistry(projectRoot, { actions });
  }

  return { initialized: true, dryRun, actions, configPath, config };
}
