import { cp, mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { loadDocflowConfig } from "../config/load.js";
import type { DocflowConfig } from "../config/types.js";
import { defaultEngineConfig, writeEngineConfig } from "../engine/load.js";
import { pathExists } from "../util/fs.js";
import {
  DOCOPS_CONFIG_REL,
  LEGACY_DOCFLOW_CONFIG_REL,
  LEGACY_DOCOPS_PATHS,
  normalizeDocTypePath,
} from "./paths.js";
import {
  docopsConfigFromDocflow,
  inferDocTypesFromTree,
  mergeDocopsDefaults,
  readDocopsConfig,
  writeDocopsConfig,
} from "./config.js";
import { applyDocopsBootstrap } from "./bootstrap.js";
import { bootstrapEntityRegistry } from "./entity-keying.js";
import {
  buildDocTypesFromLayers,
  ensureOptionalDocTypes,
  LAYER_TEMPLATES_PATH,
  templateLayerKeys,
} from "./layer-defaults.js";
import { copyTemplates, resolveTemplateSourcesForLayer } from "./templates.js";
import type { DocopsConfig } from "./types.js";

export interface MigrateDocopsOptions {
  projectRoot: string;
  dryRun?: boolean;
  repair?: boolean;
  templatesOnly?: boolean;
}

export interface MigrateDocopsResult {
  migrated: boolean;
  dryRun: boolean;
  actions: string[];
  configPath: string;
  config?: DocopsConfig;
}

const LAYER_TEMPLATES_PATH_LEGACY = LAYER_TEMPLATES_PATH;

async function loadDocflowIfPresent(projectRoot: string): Promise<DocflowConfig | null> {
  const docflowPath = join(projectRoot, LEGACY_DOCFLOW_CONFIG_REL);
  if (!(await pathExists(docflowPath))) {
    return null;
  }
  const { config } = await loadDocflowConfig(projectRoot);
  return config;
}

async function copyIfExists(
  srcAbs: string,
  destAbs: string,
  label: string,
  actions: string[],
  dryRun: boolean,
): Promise<void> {
  if (!(await pathExists(srcAbs))) {
    return;
  }
  if (await pathExists(destAbs)) {
    actions.push(`skip ${label} (destination exists)`);
    return;
  }
  actions.push(`${dryRun ? "would copy" : "copy"} ${label}`);
  if (!dryRun) {
    await mkdir(dirname(destAbs), { recursive: true });
    await cp(srcAbs, destAbs, { recursive: true, force: true });
  }
}

async function copyLegacyArtifacts(
  projectRoot: string,
  actions: string[],
  dryRun: boolean,
): Promise<void> {
  await copyIfExists(
    join(projectRoot, "comments"),
    join(projectRoot, ".docops/comments"),
    "comments/ → .docops/comments/",
    actions,
    dryRun,
  );

  await copyIfExists(
    join(projectRoot, LEGACY_DOCOPS_PATHS.reviewConfig),
    join(projectRoot, ".docops/review.config.json"),
    `${LEGACY_DOCOPS_PATHS.reviewConfig} → .docops/review.config.json`,
    actions,
    dryRun,
  );

  await copyIfExists(
    join(projectRoot, LEGACY_DOCOPS_PATHS.reviewQueue),
    join(projectRoot, ".docops/review-queue"),
    `${LEGACY_DOCOPS_PATHS.reviewQueue} → .docops/review-queue/`,
    actions,
    dryRun,
  );

  await copyIfExists(
    join(projectRoot, LEGACY_DOCOPS_PATHS.prototypeScreenMap),
    join(projectRoot, ".docops/prototype/screen-map.json"),
    `${LEGACY_DOCOPS_PATHS.prototypeScreenMap} → .docops/prototype/screen-map.json`,
    actions,
    dryRun,
  );

  const prototypeConfigDest = join(projectRoot, ".docops/prototype/config.json");
  for (const rel of [
    LEGACY_DOCOPS_PATHS.prototypeConfig,
    "prototype/config.json",
  ]) {
    const prototypeConfigSrc = join(projectRoot, rel);
    if ((await pathExists(prototypeConfigSrc)) && !(await pathExists(prototypeConfigDest))) {
      actions.push(
        `${dryRun ? "would copy" : "copy"} ${rel} → .docops/prototype/config.json`,
      );
      if (!dryRun) {
        await mkdir(dirname(prototypeConfigDest), { recursive: true });
        await cp(prototypeConfigSrc, prototypeConfigDest);
      }
      break;
    }
  }
}

async function bootstrapDocopsContract(
  projectRoot: string,
  config: DocopsConfig,
  docflow: DocflowConfig | null,
  actions: string[],
  dryRun: boolean,
): Promise<void> {
  await applyDocopsBootstrap({
    projectRoot,
    config,
    dryRun,
    skipExisting: true,
    actions,
  });
  await copyTemplatesForEnabledDocTypes(projectRoot, config, docflow, actions, dryRun);
}

async function syncDocopsConfigSchema(
  projectRoot: string,
  config: DocopsConfig,
  actions: string[],
  dryRun: boolean,
): Promise<DocopsConfig> {
  const merged = mergeDocopsDefaults(config);
  const withOptional = {
    ...merged,
    docTypes: ensureOptionalDocTypes(merged.docTypes ?? {}),
  };
  const before = JSON.stringify(mergeDocopsDefaults(config));
  const after = JSON.stringify(withOptional);
  if (before === after) {
    return config;
  }
  actions.push(`${dryRun ? "would sync" : "sync"} ${DOCOPS_CONFIG_REL} to latest contract defaults`);
  if (!dryRun) {
    await writeDocopsConfig(projectRoot, withOptional);
  }
  return withOptional;
}

/** Gap-fill an existing docops contract (config patches + bootstrap files). */
export async function repairDocopsContract(
  projectRoot: string,
  config: DocopsConfig,
  actions: string[],
  dryRun: boolean,
): Promise<DocopsConfig> {
  return repairDocopsGaps(projectRoot, config, actions, dryRun);
}

async function repairDocopsGaps(
  projectRoot: string,
  config: DocopsConfig,
  actions: string[],
  dryRun: boolean,
): Promise<DocopsConfig> {
  await copyLegacyArtifacts(projectRoot, actions, dryRun);

  const synced = await syncDocopsConfigSchema(projectRoot, config, actions, dryRun);
  const withPaths = await patchCanonicalDocTypePaths(projectRoot, synced, actions, dryRun);
  const withOptional = await patchMissingOptionalDocTypes(projectRoot, withPaths, actions, dryRun);
  const next = await patchMissingTemplatesPaths(projectRoot, withOptional, actions, dryRun);
  const docflow = await loadDocflowIfPresent(projectRoot);
  await bootstrapDocopsContract(projectRoot, next, docflow, actions, dryRun);

  if (!dryRun) {
    await bootstrapEntityRegistry(projectRoot, { actions });
  }

  return next;
}

async function patchCanonicalDocTypePaths(
  projectRoot: string,
  config: DocopsConfig,
  actions: string[],
  dryRun: boolean,
): Promise<DocopsConfig> {
  if (!config.docTypes) {
    return config;
  }

  const docsRoot = config.docsRoot?.trim() || "docs";
  const docTypes = { ...config.docTypes };
  let patched = false;

  for (const [key, dt] of Object.entries(docTypes)) {
    if (dt?.enabled === false || !dt?.path?.trim()) {
      continue;
    }
    const canonical = normalizeDocTypePath(key, dt.path, docsRoot);
    if (canonical === dt.path.trim()) {
      continue;
    }
    docTypes[key] = { ...dt, path: canonical };
    patched = true;
    actions.push(
      `${dryRun ? "would patch" : "patch"} docTypes.${key}.path → ${canonical}`,
    );
  }

  if (!patched) {
    return config;
  }

  const next = { ...config, docTypes };
  if (!dryRun) {
    await writeDocopsConfig(projectRoot, next);
  }
  return next;
}

async function patchMissingOptionalDocTypes(
  projectRoot: string,
  config: DocopsConfig,
  actions: string[],
  dryRun: boolean,
): Promise<DocopsConfig> {
  const docTypes = ensureOptionalDocTypes(config.docTypes ?? {});
  if (docTypes === config.docTypes) {
    return config;
  }

  for (const key of ["detailDesign", "otherDocument"] as const) {
    if (!config.docTypes?.[key] && docTypes[key]) {
      actions.push(
        `${dryRun ? "would patch" : "patch"} docTypes.${key} (enabled: false, path: ${docTypes[key].path})`,
      );
    }
  }

  const next = { ...config, docTypes };
  if (!dryRun) {
    await writeDocopsConfig(projectRoot, next);
  }
  return next;
}

async function patchMissingTemplatesPaths(
  projectRoot: string,
  config: DocopsConfig,
  actions: string[],
  dryRun: boolean,
): Promise<DocopsConfig> {
  if (!config.docTypes) {
    return config;
  }

  const docTypes = { ...config.docTypes };
  let patched = false;
  for (const [key, dt] of Object.entries(docTypes)) {
    if (dt?.enabled === false || dt.templatesPath) {
      continue;
    }
    const defaultPath = LAYER_TEMPLATES_PATH_LEGACY[key];
    if (!defaultPath) {
      continue;
    }
    docTypes[key] = { ...dt, templatesPath: defaultPath };
    patched = true;
    actions.push(
      `${dryRun ? "would patch" : "patch"} docTypes.${key}.templatesPath → ${defaultPath}`,
    );
  }

  if (!patched) {
    return config;
  }

  const next = { ...config, docTypes };
  if (!dryRun) {
    await writeDocopsConfig(projectRoot, next);
  }
  return next;
}

async function copyTemplatesForEnabledDocTypes(
  projectRoot: string,
  config: DocopsConfig,
  docflow: DocflowConfig | null,
  actions: string[],
  dryRun: boolean,
): Promise<void> {
  for (const key of templateLayerKeys(config)) {
    const dt = config.docTypes?.[key];
    if (!dt?.templatesPath) {
      continue;
    }
    if (!dryRun) {
      await mkdir(join(projectRoot, dt.templatesPath), { recursive: true });
    }
    const sources = await resolveTemplateSourcesForLayer(projectRoot, key, docflow);
    const result = await copyTemplates({
      projectRoot,
      layerKey: key,
      destRel: dt.templatesPath,
      sources,
      dryRun,
    });
    actions.push(...result.actions);
  }
}

export interface MigrateFromDocflowResult {
  migrated: boolean;
  reason?: string;
  docopsPath: string;
  enginePath: string;
  actions: string[];
}

export async function migrateFromDocflow(
  projectRoot: string,
  opts: { write?: boolean; dryRun?: boolean } = {},
): Promise<MigrateFromDocflowResult> {
  const dryRun = opts.dryRun === true;
  const write = opts.write !== false && !dryRun;
  const actions: string[] = [];
  const docflowPath = join(projectRoot, LEGACY_DOCFLOW_CONFIG_REL);
  const docopsPath = join(projectRoot, DOCOPS_CONFIG_REL).replace(/\\/g, "/");
  const enginePath = join(projectRoot, ".ai-spector/engine.json").replace(/\\/g, "/");

  if (!(await pathExists(docflowPath))) {
    return { migrated: false, reason: "docflow.config.json missing", docopsPath, enginePath, actions };
  }

  const { config: docflow } = await loadDocflowConfig(projectRoot);
  const docTypes = buildDocTypesFromLayers(undefined, await inferDocTypesFromTree(projectRoot));
  const docops = docopsConfigFromDocflow(docflow, docTypes);

  const engine = defaultEngineConfig();
  if (docflow.scaffoldVersion) engine.scaffoldVersion = docflow.scaffoldVersion;
  if (docflow.readiness) engine.readiness = { ...engine.readiness, ...docflow.readiness };
  if (docflow.paths?.graph) engine.artifacts.graph = docflow.paths.graph;
  if (docflow.paths?.registry) engine.artifacts.registry = docflow.paths.registry;

  await copyLegacyArtifacts(projectRoot, actions, dryRun);

  actions.push(`${dryRun ? "would write" : "write"} ${DOCOPS_CONFIG_REL}`);
  actions.push(`${dryRun ? "would write" : "write"} .ai-spector/engine.json`);
  if (write) {
    await writeDocopsConfig(projectRoot, docops);
    await writeEngineConfig(projectRoot, engine);
  }

  await bootstrapDocopsContract(projectRoot, docops, docflow, actions, dryRun);

  if (!dryRun) {
    await bootstrapEntityRegistry(projectRoot, { actions });
  }

  return { migrated: true, docopsPath, enginePath, actions };
}

export async function migrateDocopsLayout(
  opts: MigrateDocopsOptions,
): Promise<MigrateDocopsResult> {
  const { projectRoot, dryRun = false, repair = false, templatesOnly = false } = opts;
  const actions: string[] = [];
  const configPath = join(projectRoot, DOCOPS_CONFIG_REL).replace(/\\/g, "/");

  const existingConfig = await readDocopsConfig(projectRoot);

  if (templatesOnly) {
    if (!existingConfig) {
      return {
        migrated: false,
        dryRun,
        actions: [`error — ${DOCOPS_CONFIG_REL} not found (required for templates-only)`],
        configPath,
      };
    }

    const docflow = await loadDocflowIfPresent(projectRoot);
    await copyTemplatesForEnabledDocTypes(
      projectRoot,
      existingConfig,
      docflow,
      actions,
      dryRun,
    );

    return {
      migrated: true,
      dryRun,
      actions,
      configPath,
      config: existingConfig,
    };
  }

  if (existingConfig && repair) {
    const config = await repairDocopsGaps(projectRoot, existingConfig, actions, dryRun);
    return {
      migrated: true,
      dryRun,
      actions,
      configPath,
      config,
    };
  }

  if (existingConfig) {
    return {
      migrated: false,
      dryRun,
      actions: [`skip — ${DOCOPS_CONFIG_REL} already exists`],
      configPath,
      config: existingConfig,
    };
  }

  const docflowPath = join(projectRoot, LEGACY_DOCFLOW_CONFIG_REL);
  if (!(await pathExists(docflowPath))) {
    return {
      migrated: false,
      dryRun,
      actions: [`skip — missing ${LEGACY_DOCFLOW_CONFIG_REL}`],
      configPath,
    };
  }

  await copyLegacyArtifacts(projectRoot, actions, dryRun);

  const { config: docflow } = await loadDocflowConfig(projectRoot);
  const docTypes = buildDocTypesFromLayers(undefined, await inferDocTypesFromTree(projectRoot));
  const docops = docopsConfigFromDocflow(docflow, docTypes);

  actions.push(`${dryRun ? "would write" : "write"} ${DOCOPS_CONFIG_REL}`);
  if (!dryRun) {
    await writeDocopsConfig(projectRoot, docops);
  }

  await bootstrapDocopsContract(projectRoot, docops, docflow, actions, dryRun);

  return {
    migrated: true,
    dryRun,
    actions,
    configPath,
    config: docops,
  };
}
