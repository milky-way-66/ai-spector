import { resolve } from "node:path";
import { findProjectRoot } from "../config/load.js";
import { assessDocopsProject } from "../docops/assess.js";
import { initDocopsContract } from "../docops/init.js";
import { migrateDocopsLayout, migrateFromDocflow } from "../docops/migrate.js";
import { syncDocopsRegistry } from "../docops/registry/index.js";
import { migrateCommentsToTargetIds } from "../comments/migrate.js";
import { WRITER_LIFECYCLE_HANDOFF } from "../docops/lifecycle.js";
import { lifecycleSyncResult } from "./lifecycle.js";

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
    if (assessment.entityRegistry) {
      const er = assessment.entityRegistry;
      if (er.keying === "logicalPath") {
        console.log(`Entity registry: legacy path-keyed (migrate to entityId)`);
      } else if (er.expectedCount === 0 && er.documentCount === 0) {
        console.log(`Entity registry: empty (no design docs yet)`);
      } else if (er.synced) {
        console.log(`Entity registry: synced — ${er.documentCount} document(s) (entityId)`);
      } else {
        console.log(
          `Entity registry: stale — ${er.documentCount}/${er.expectedCount} document(s) — run docops registry sync`,
        );
      }
    }
    for (const gap of assessment.gaps) {
      console.log(`  [${gap.severity}] ${gap.id}: ${gap.message}`);
      if (gap.fix) console.log(`    fix: ${gap.fix}`);
    }
    console.log("");
    console.log(WRITER_LIFECYCLE_HANDOFF);
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
  if (result.initialized && !opts.dryRun) {
    try {
      await lifecycleSyncResult({ root: projectRoot, dryRun: false });
    } catch {
      // lifecycle sync is best-effort after docops init
    }
    console.log("");
    console.log(WRITER_LIFECYCLE_HANDOFF);
  }
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

export async function runDocopsRegistrySync(opts: {
  root?: string;
  dryRun?: boolean;
  skipScreenMap?: boolean;
  json?: boolean;
}): Promise<number> {
  const projectRoot = resolve(opts.root ?? findProjectRoot());
  const result = await syncDocopsRegistry({
    projectRoot,
    dryRun: opts.dryRun,
    importScreenMap: !opts.skipScreenMap,
  });

  if (opts.json) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    if (opts.dryRun) {
      console.log("Dry run — no files written.");
    }
    for (const action of result.actions) {
      console.log(`  ${action}`);
    }
    for (const warning of result.warnings) {
      console.log(`  warn: ${warning}`);
    }
    console.log(
      `\nDocuments: +${result.documentsCreated} ~${result.documentsUpdated} | ` +
        `Screens: +${result.screensCreated} ~${result.screensUpdated}` +
        (result.manifestWritten ? " | manifest written" : ""),
    );
  }

  return result.warnings.length > 0 ? 1 : 0;
}

export async function runDocopsCommentsMigrate(opts: {
  root?: string;
  dryRun?: boolean;
  json?: boolean;
}): Promise<number> {
  const projectRoot = resolve(opts.root ?? findProjectRoot());
  const result = await migrateCommentsToTargetIds({
    projectRoot,
    dryRun: opts.dryRun,
  });

  if (opts.json) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    if (opts.dryRun) {
      console.log("Dry run — no files written.");
    }
    for (const action of result.actions) {
      console.log(`  ${action}`);
    }
    for (const warning of result.warnings) {
      console.log(`  warn: ${warning}`);
    }
    console.log(`\nMoved: ${result.moved} | Skipped: ${result.skipped}`);
  }

  return result.warnings.length > 0 ? 1 : 0;
}

export async function runDocopsReviewRegistryMigrate(opts: {
  root?: string;
  dryRun?: boolean;
  json?: boolean;
}): Promise<number> {
  const { migrateReviewRegistryToV4 } = await import("../reviews/registry-v4.js");
  const projectRoot = resolve(opts.root ?? findProjectRoot());
  const result = await migrateReviewRegistryToV4(projectRoot, { dryRun: opts.dryRun });

  if (opts.json) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    if (opts.dryRun) {
      console.log("Dry run — no files written.");
    }
    if (!result.migrated) {
      console.log("Review registry already v4 (entityId keys).");
    } else {
      console.log(`Rekeyed ${result.rekeyed} document(s) to entityId.`);
    }
    for (const warning of result.warnings) {
      console.log(`  warn: ${warning}`);
    }
  }

  return result.warnings.length > 0 ? 1 : 0;
}
