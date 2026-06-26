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
  const markerPaths = [
    join(root, ".ai-spector", "engine.json"),
    join(root, ".docops", "docops.config.json"),
    join(root, ".ai-spector", "docflow.config.json"),
  ];
  const initialized = await Promise.all(markerPaths.map((m) => pathExists(m)));
  if (!initialized.some(Boolean)) {
    throw new Error(`Project not initialized. Run: npx ai-spector init`);
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
