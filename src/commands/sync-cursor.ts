import { join, resolve } from "node:path";
import { scaffoldCursorBundleRoot } from "../config/load.js";
import { pathExists } from "../util/fs.js";
import { copyCursorToProject } from "./init.js";

export interface SyncCursorOptions {
  targetDir: string;
}

/** Refresh `.cursor/` skills and WORKFLOW from bundled `scaffold/cursor/`. */
export async function runSyncCursor(opts: SyncCursorOptions): Promise<void> {
  const root = resolve(opts.targetDir);
  const marker = join(root, ".ai-spector", "docflow.config.json");
  if (!(await pathExists(marker))) {
    throw new Error(
      `Project not initialized (${marker}). Run: ai-spector init`,
    );
  }

  await copyCursorToProject(root);

  console.log(`Synced Cursor bundle at ${join(root, ".cursor")}`);
  console.log(`  source → ${scaffoldCursorBundleRoot()}`);
  console.log("");
  console.log("Reload Cursor skills if needed; see .cursor/WORKFLOW.md");
}
