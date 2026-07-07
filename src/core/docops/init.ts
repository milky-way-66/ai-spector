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
import { buildDocTypesFromLayers } from "./layer-defaults.js";

function parseLanguages(codes?: string[]): Array<{ code: string; label: string; path: string }> {
  const list = (codes?.length ? codes : ["en"]).map((c) => c.trim().toLowerCase()).filter(Boolean);
  return list.map((code) => ({
    code,
    label: code.toUpperCase(),
    path: code,
  }));
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
  const docTypes = buildDocTypesFromLayers(opts.layers, inferred);

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
