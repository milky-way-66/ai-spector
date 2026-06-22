import { resolve } from "node:path";
import { findProjectRoot } from "../config/load.js";
import { migrateDocopsLayout } from "../docops/migrate.js";

export interface DocopsMigrateOptions {
  root?: string;
  dryRun?: boolean;
}

export async function runDocopsMigrate(opts: DocopsMigrateOptions = {}): Promise<void> {
  const projectRoot = resolve(opts.root ?? findProjectRoot());
  const result = await migrateDocopsLayout({ projectRoot, dryRun: opts.dryRun });
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
