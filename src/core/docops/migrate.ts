import { cp, mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { loadDocflowConfig } from "../config/load.js";
import type { DocflowConfig } from "../config/types.js";
import { defaultEngineConfig, writeEngineConfig } from "../engine/load.js";
import { pathExists, writeJson } from "../util/fs.js";
import {
  DOCOPS_CONFIG_REL,
  LEGACY_DOCFLOW_CONFIG_REL,
  LEGACY_DOCOPS_PATHS,
} from "./paths.js";
import {
  docopsConfigFromDocflow,
  inferDocTypesFromTree,
  readDocopsConfig,
  writeDocopsConfig,
} from "./config.js";
import { copyTemplates, resolveTemplateSourcesForLayer } from "./templates.js";
import type { DocopsConfig, DocopsDocTypeConfig } from "./types.js";

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

const LAYER_TEMPLATES_PATH: Record<string, string> = {
  srs: ".docops/templates/srs",
  basicDesign: ".docops/templates/basic-design",
  detailDesign: ".docops/templates/detail-design",
};

function enabledDocTypes(
  config: DocopsConfig,
): Array<[string, DocopsDocTypeConfig]> {
  if (!config.docTypes) return [];
  return Object.entries(config.docTypes).filter(([, v]) => v?.enabled !== false);
}

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

async function seedMissingReviewFiles(
  projectRoot: string,
  config: DocopsConfig,
  actions: string[],
  dryRun: boolean,
): Promise<void> {
  const reviewConfigRel = config.paths.reviewConfig;
  const registryRel = join(config.paths.reviewQueue, "registry.json").replace(/\\/g, "/");
  const pendingRel = join(config.paths.reviewQueue, "pending.json").replace(/\\/g, "/");

  for (const [rel, payload] of [
    [reviewConfigRel, { schemaVersion: "1.0", extends: "kaopiz-default", meta: { source: "docops-migrate" } }],
    [registryRel, { version: 3, documents: {} }],
    [pendingRel, { version: 2, jobs: [] }],
  ] as const) {
    const absPath = join(projectRoot, rel);
    if (!(await pathExists(absPath))) {
      actions.push(`${dryRun ? "would write" : "write"} ${rel}`);
      if (!dryRun) {
        await mkdir(dirname(absPath), { recursive: true });
        await writeJson(absPath, payload);
      }
    }
  }
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
    const defaultPath = LAYER_TEMPLATES_PATH[key];
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
  for (const [key, dt] of enabledDocTypes(config)) {
    if (!dt.templatesPath) {
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

async function repairDocopsGaps(
  projectRoot: string,
  config: DocopsConfig,
  actions: string[],
  dryRun: boolean,
): Promise<DocopsConfig> {
  await copyLegacyArtifacts(projectRoot, actions, dryRun);
  await seedMissingReviewFiles(projectRoot, config, actions, dryRun);

  const readmePath = join(projectRoot, ".docops/guide/README.md");
  if (!(await pathExists(readmePath))) {
    const {
      copyBootstrapContractAssets,
      copyBootstrapDocs,
      resolveBootstrapRoot,
    } = await import("./bootstrap.js");
    const bundleRoot = resolveBootstrapRoot();
    const copyOpts = {
      projectRoot,
      bundleRoot,
      dryRun,
      skipExisting: true,
      actions,
    };
    await copyBootstrapDocs(copyOpts);
    await copyBootstrapContractAssets(copyOpts);
  }

  let next = await patchMissingTemplatesPaths(projectRoot, config, actions, dryRun);
  const docflow = await loadDocflowIfPresent(projectRoot);
  await copyTemplatesForEnabledDocTypes(projectRoot, next, docflow, actions, dryRun);

  return next;
}

export interface MigrateFromDocflowResult {
  migrated: boolean;
  reason?: string;
  docopsPath: string;
  enginePath: string;
}

export async function migrateFromDocflow(
  projectRoot: string,
  opts: { write?: boolean; dryRun?: boolean } = {},
): Promise<MigrateFromDocflowResult> {
  const write = opts.write !== false && !opts.dryRun;
  const docflowPath = join(projectRoot, LEGACY_DOCFLOW_CONFIG_REL);
  const docopsPath = join(projectRoot, DOCOPS_CONFIG_REL).replace(/\\/g, "/");
  const enginePath = join(projectRoot, ".ai-spector/engine.json").replace(/\\/g, "/");

  if (!(await pathExists(docflowPath))) {
    return { migrated: false, reason: "docflow.config.json missing", docopsPath, enginePath };
  }

  const { config: docflow } = await loadDocflowConfig(projectRoot);
  const docTypes = await inferDocTypesFromTree(projectRoot);
  const docops = docopsConfigFromDocflow(docflow, Object.keys(docTypes).length ? docTypes : undefined);

  const engine = defaultEngineConfig();
  if (docflow.scaffoldVersion) engine.scaffoldVersion = docflow.scaffoldVersion;
  if (docflow.readiness) engine.readiness = { ...engine.readiness, ...docflow.readiness };
  if (docflow.paths?.graph) engine.artifacts.graph = docflow.paths.graph;
  if (docflow.paths?.registry) engine.artifacts.registry = docflow.paths.registry;

  if (write) {
    await writeDocopsConfig(projectRoot, docops);
    await writeEngineConfig(projectRoot, engine);
  }

  return { migrated: true, docopsPath, enginePath };
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
  const docTypes = await inferDocTypesFromTree(projectRoot);
  const docops = docopsConfigFromDocflow(
    docflow,
    Object.keys(docTypes).length ? docTypes : undefined,
  );

  actions.push(`${dryRun ? "would write" : "write"} ${DOCOPS_CONFIG_REL}`);
  if (!dryRun) {
    await mkdir(join(projectRoot, ".docops/prototype"), { recursive: true });
    await mkdir(join(projectRoot, ".docops/templates/srs"), { recursive: true });
    await mkdir(join(projectRoot, ".docops/templates/basic-design"), { recursive: true });
    await writeDocopsConfig(projectRoot, docops);
  }

  await copyTemplatesForEnabledDocTypes(projectRoot, docops, docflow, actions, dryRun);

  return {
    migrated: true,
    dryRun,
    actions,
    configPath,
    config: docops,
  };
}
