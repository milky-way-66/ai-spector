import { resolve } from "node:path";
import { findProjectRoot } from "../config/load.js";
import { assessDocopsProject } from "../docops/assess.js";
import { initDocopsContract } from "../docops/init.js";
import { migrateDocopsLayout, migrateFromDocflow } from "../docops/migrate.js";

export interface DocopsMigrateOptions {
  root?: string;
  dryRun?: boolean;
  repair?: boolean;
  templatesOnly?: boolean;
  fromDocflow?: boolean;
}

export async function runDocopsStatus(opts: { root?: string; json?: boolean } = {}): Promise<number> {
  const projectRoot = resolve(opts.root ?? findProjectRoot());
  const assessment = await assessDocopsProject(projectRoot);
  if (opts.json) {
    console.log(JSON.stringify(assessment, null, 2));
  } else {
    console.log(`Layout: ${assessment.layout}`);
    console.log(`Writer ready: ${assessment.writerReady}`);
    console.log(`Recommended: ${assessment.recommendedAction}`);
    for (const gap of assessment.gaps) {
      console.log(`  [${gap.severity}] ${gap.id}: ${gap.message}`);
      if (gap.fix) console.log(`    fix: ${gap.fix}`);
    }
  }
  return assessment.writerReady ? 0 : 2;
}

export async function runDocopsInit(opts: {
  root?: string;
  lang?: string;
  layers?: string;
  dryRun?: boolean;
  force?: boolean;
}): Promise<void> {
  const projectRoot = resolve(opts.root ?? findProjectRoot());
  const languages = opts.lang?.split(",").map((s) => s.trim()).filter(Boolean);
  const layers = opts.layers?.split(",").map((s) => s.trim()).filter(Boolean);
  const result = await initDocopsContract({
    projectRoot,
    languages,
    layers,
    dryRun: opts.dryRun,
    force: opts.force,
  });
  for (const action of result.actions) console.log(`  ${action}`);
  if (!result.initialized && !opts.dryRun) {
    process.exitCode = 1;
  }
  console.log(result.initialized ? `\nInitialized → ${result.configPath}` : `\nNo init performed.`);
}

export async function runDocopsMigrate(opts: DocopsMigrateOptions = {}): Promise<void> {
  const projectRoot = resolve(opts.root ?? findProjectRoot());

  if (opts.fromDocflow) {
    const result = await migrateFromDocflow(projectRoot, {
      write: !opts.dryRun,
      dryRun: opts.dryRun,
    });
    if (opts.dryRun) {
      console.log("Dry run — no files written.");
    }
    for (const action of result.actions) {
      console.log(`  ${action}`);
    }
    if (!result.migrated) {
      console.log(`\nNo migration performed. ${result.reason ?? ""}`);
      return;
    }
    console.log(`\nMigrated docops → ${result.docopsPath}`);
    console.log(`Migrated engine  → ${result.enginePath}`);
    return;
  }

  const result = await migrateDocopsLayout({
    projectRoot,
    dryRun: opts.dryRun,
    repair: opts.repair,
    templatesOnly: opts.templatesOnly,
  });
  if (opts.dryRun) {
    console.log("Dry run — no files written.");
  }
  for (const action of result.actions) {
    console.log(`  ${action}`);
  }
  if (result.config?.primaryLanguage) {
    console.log(`  primaryLanguage: ${result.config.primaryLanguage}`);
  }
  console.log(result.migrated ? `\nMigrated → ${result.configPath}` : `\nNo migration performed.`);
}
