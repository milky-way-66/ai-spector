import { join, resolve } from "node:path";
import { scaffoldCursorBundleRoot } from "../config/load.js";
import { pathExists } from "../util/fs.js";
import { copyCursorToProject } from "./init.js";
import { installedPackageVersion } from "../upgrade/package-version.js";
import { stampScaffoldVersion } from "../upgrade/stamp.js";

export interface SyncCursorOptions {
  targetDir: string;
}

export interface SyncCursorResult {
  targetDir: string;
  cursorDir: string;
  sourceDir: string;
}

export async function runSyncCursor(opts: SyncCursorOptions): Promise<SyncCursorResult> {
  const root = resolve(opts.targetDir);
  const markerPaths = [
    join(root, ".ai-spector", "engine.json"),
    join(root, ".docops", "docops.config.json"),
    join(root, ".ai-spector", "docflow.config.json"),
  ];
  const initialized = await Promise.all(markerPaths.map((m) => pathExists(m)));
  if (!initialized.some(Boolean)) {
    throw new Error(`Project not initialized. Run: npx ai-spector init`);
  }

  await copyCursorToProject(root);
  await stampScaffoldVersion(root, installedPackageVersion());

  return {
    targetDir: root,
    cursorDir: join(root, ".cursor"),
    sourceDir: scaffoldCursorBundleRoot(),
  };
}
