import { mkdir, readdir, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import {
  packageBundleRoot,
  scaffoldBundleRoot,
  scaffoldCursorBundleRoot,
} from "../config/load.js";
import { copyTree, pathExists, writeJson } from "../util/fs.js";
import { ensureAiSpectorGitignore } from "../util/gitignore.js";

export interface InitOptions {
  targetDir: string;
  force?: boolean;
}

/** Copy bundled scaffold/cursor/ -> project .cursor/. */
export async function copyCursorToProject(projectRoot: string): Promise<void> {
  await copyTree(scaffoldCursorBundleRoot(), join(projectRoot, ".cursor"));
}

/** Copy scaffold into project; scaffold/cursor/ -> .cursor/ at project root. */
export async function copyScaffoldToProject(projectRoot: string): Promise<void> {
  const scaffold = scaffoldBundleRoot();
  const entries = await readdir(scaffold, { withFileTypes: true });
  for (const ent of entries) {
    if (ent.name === "cursor") {
      continue;
    }
    await copyTree(join(scaffold, ent.name), join(projectRoot, ent.name));
  }
  await copyCursorToProject(projectRoot);
}

export async function runInit(opts: InitOptions): Promise<void> {
  const root = resolve(opts.targetDir);
  const marker = join(root, ".ai-spector", "docflow.config.json");

  if (await pathExists(marker) && !opts.force) {
    throw new Error(
      `Project already initialized (${marker}). Use --force to overwrite scaffold files.`,
    );
  }

  await copyScaffoldToProject(root);

  const projectTemplates = join(root, ".ai-spector", "templates");
  await mkdir(projectTemplates, { recursive: true });
  await copyTree(join(packageBundleRoot(), "templates"), projectTemplates);

  const dirs = [
    ".ai-spector/graph",
    ".ai-spector/registry",
    ".ai-spector/.docflow/analysis",
    ".ai-spector/.docflow/extract",
    ".ai-spector/.docflow/graph",
    ".ai-spector/views",
    "docs/srs",
    "docs/basic-design",
    "docs/detail-design",
    "prototype",
    "prototype/src",
  ];
  for (const d of dirs) {
    await mkdir(join(root, d), { recursive: true });
  }

  const statePath = join(root, ".ai-spector/.docflow/state.json");
  await writeJson(statePath, {
    version: 1,
    initializedAt: new Date().toISOString(),
    analysis: { lastRunAt: null, graphPreparedAt: null },
    index: { lastRunAt: null },
  });

  const gitkeep = join(root, "docs/srs/.gitkeep");
  if (!(await pathExists(gitkeep))) {
    await writeFile(gitkeep, "");
  }

  const gitignorePath = await ensureAiSpectorGitignore(root);

  console.log(`Initialized AI Spector project at ${root}`);
  console.log("");
  console.log(`  gitignore -> ${gitignorePath} (ai-spector block added/updated)`);
  console.log(`  templates -> ${projectTemplates} (SRS / basic / detail design)`);
  console.log(`  cursor    -> ${join(root, ".cursor")} (from scaffold/cursor/)`);
  console.log("");
  console.log("Next steps (Cursor):");
  console.log("  1. Open this folder in Cursor");
  console.log("  2. Enable all ai-spector skills (.cursor/skills/ -- see README.md)");
  console.log("  3. Add files under docs/data-source/");
  console.log('  4. In Cursor: ask e.g. "analyze data source", "generate SRS"');
  console.log("     Workflow: .cursor/WORKFLOW.md");
  console.log('  5. Prototype: ai-spector prototype setup --theme vercel -> "generate HTML prototype"');
  console.log("");
  console.log("See .cursor/WORKFLOW.md -- agents use skills + CLI; you rarely run CLI yourself.");
}
