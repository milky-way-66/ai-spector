import { cp, mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { loadDocflowConfig } from "../config/load.js";
import { pathExists, readJson } from "../util/fs.js";
import {
  DOCOPS_CONFIG_REL,
  LEGACY_DOCFLOW_CONFIG_REL,
  LEGACY_DOCOPS_PATHS,
} from "./paths.js";
import {
  docopsConfigFromDocflow,
  inferDocTypesFromTree,
  writeDocopsConfig,
} from "./config.js";
import type { DocopsConfig } from "./types.js";

export interface MigrateDocopsOptions {
  projectRoot: string;
  dryRun?: boolean;
}

export interface MigrateDocopsResult {
  migrated: boolean;
  dryRun: boolean;
  actions: string[];
  configPath: string;
  config?: DocopsConfig;
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

export async function migrateDocopsLayout(
  opts: MigrateDocopsOptions,
): Promise<MigrateDocopsResult> {
  const { projectRoot, dryRun = false } = opts;
  const actions: string[] = [];
  const configPath = join(projectRoot, DOCOPS_CONFIG_REL).replace(/\\/g, "/");

  if (await pathExists(configPath)) {
    const existing = await readJson<DocopsConfig>(configPath);
    return {
      migrated: false,
      dryRun,
      actions: [`skip — ${DOCOPS_CONFIG_REL} already exists`],
      configPath,
      config: existing,
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

  const prototypeConfigSrc = join(projectRoot, LEGACY_DOCOPS_PATHS.prototypeConfig);
  const prototypeConfigDest = join(projectRoot, ".docops/prototype/config.json");
  if ((await pathExists(prototypeConfigSrc)) && !(await pathExists(prototypeConfigDest))) {
    actions.push(
      `${dryRun ? "would copy" : "copy"} ${LEGACY_DOCOPS_PATHS.prototypeConfig} → .docops/prototype/config.json`,
    );
    if (!dryRun) {
      await mkdir(dirname(prototypeConfigDest), { recursive: true });
      await cp(prototypeConfigSrc, prototypeConfigDest);
    }
  }

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

  return {
    migrated: true,
    dryRun,
    actions,
    configPath,
    config: docops,
  };
}
