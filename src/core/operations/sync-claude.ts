import { join, resolve } from "node:path";
import { scaffoldClaudeBundleRoot } from "../config/load.js";
import { pathExists } from "../util/fs.js";
import { copyClaudeToProject } from "./init.js";
import { installedPackageVersion } from "../upgrade/package-version.js";
import { stampScaffoldVersion } from "../upgrade/stamp.js";

export interface SyncClaudeOptions {
  targetDir: string;
}

export interface SyncClaudeResult {
  targetDir: string;
  claudeMd: string;
  claudeSkillsDir: string;
  sourceDir: string;
}

export async function runSyncClaude(opts: SyncClaudeOptions): Promise<SyncClaudeResult> {
  const root = resolve(opts.targetDir);
  const marker = join(root, ".ai-spector", "docflow.config.json");
  if (!(await pathExists(marker))) {
    throw new Error(`Project not initialized (${marker}). Run: npx ai-spector init`);
  }

  await copyClaudeToProject(root);
  await stampScaffoldVersion(root, installedPackageVersion());

  return {
    targetDir: root,
    claudeMd: join(root, "CLAUDE.md"),
    claudeSkillsDir: join(root, ".claude", "skills"),
    sourceDir: scaffoldClaudeBundleRoot(),
  };
}
