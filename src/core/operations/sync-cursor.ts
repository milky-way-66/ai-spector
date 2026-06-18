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
  const marker = join(root, ".ai-spector", "docflow.config.json");
  if (!(await pathExists(marker))) {
    throw new Error(`Project not initialized (${marker}). Run: npx ai-spector init`);
  }

  await copyCursorToProject(root);
  await stampScaffoldVersion(root, installedPackageVersion());

  return {
    targetDir: root,
    cursorDir: join(root, ".cursor"),
    sourceDir: scaffoldCursorBundleRoot(),
  };
}
