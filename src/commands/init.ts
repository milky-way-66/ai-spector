import { mkdir, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { scaffoldBundleRoot } from "../config/load.js";
import { copyTree, pathExists, writeJson } from "../util/fs.js";

export interface InitOptions {
  targetDir: string;
  force?: boolean;
}

export async function runInit(opts: InitOptions): Promise<void> {
  const root = resolve(opts.targetDir);
  const marker = join(root, ".ai-spector", "docflow.config.json");

  if (await pathExists(marker) && !opts.force) {
    throw new Error(
      `Project already initialized (${marker}). Use --force to overwrite scaffold files.`,
    );
  }

  const scaffold = scaffoldBundleRoot();
  await copyTree(scaffold, root);

  const dirs = [
    ".ai-spector/graph",
    ".ai-spector/registry",
    ".ai-spector/.docflow/analysis",
    ".ai-spector/.docflow/extract",
    ".ai-spector/views",
    "docs/srs",
    "docs/basic-design",
    "docs/detail-design",
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

  console.log(`Initialized AI Spector project at ${root}`);
  console.log("");
  console.log("Next steps (Cursor):");
  console.log("  1. Open this folder in Cursor");
  console.log("  2. Enable the ai-spector skill (.cursor/skills/ai-spector/)");
  console.log("  3. Add files under docs/data-source/");
  console.log("  4. Run /analyze  →  /validate-graph  →  /generate-srs");
  console.log("");
  console.log("See .cursor/commands/_workflow.md — you do not need other CLI commands.");
}
