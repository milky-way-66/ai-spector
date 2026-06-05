import { mkdir, readdir, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import {
  packageBundleRoot,
  scaffoldBundleRoot,
  scaffoldCursorBundleRoot,
} from "../config/load.js";
import { copyTree, pathExists, readJson, writeJson } from "../util/fs.js";
import { ensureGitRepository, installGitHooks } from "./hooks.js";
import { ensureAiSpectorGitignore } from "../util/gitignore.js";
import type { LanguageConfig } from "../config/types.js";

export interface InitOptions {
  targetDir: string;
  force?: boolean;
  /** Language codes to set up, e.g. ["en", "jp"]. Defaults to ["en"]. */
  languages?: string[];
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

const LANGUAGE_LABELS: Record<string, string> = {
  en: "English",
  jp: "Japanese",
  ja: "Japanese",
  vi: "Vietnamese",
  zh: "Chinese",
  ko: "Korean",
  fr: "French",
  de: "German",
  es: "Spanish",
  pt: "Portuguese",
};

function buildLanguageConfigs(codes: string[]): LanguageConfig[] {
  return codes.map((code) => ({
    code,
    label: LANGUAGE_LABELS[code] ?? code,
  }));
}

export async function runInit(opts: InitOptions): Promise<void> {
  const root = resolve(opts.targetDir);
  const marker = join(root, ".ai-spector", "docflow.config.json");

  if (await pathExists(marker) && !opts.force) {
    throw new Error(
      `Project already initialized (${marker}). Use --force to overwrite scaffold files.`,
    );
  }

  const langCodes = opts.languages && opts.languages.length > 0 ? opts.languages : ["en"];
  const languages = buildLanguageConfigs(langCodes);

  await copyScaffoldToProject(root);

  // Patch languages into the scaffold-copied config (which must exist at this point)
  const configPath = join(root, ".ai-spector", "docflow.config.json");
  const existingConfig = await readJson<Record<string, unknown>>(configPath);
  await writeJson(configPath, { ...existingConfig, languages });

  const projectTemplates = join(root, ".ai-spector", "templates");
  await mkdir(projectTemplates, { recursive: true });
  await copyTree(join(packageBundleRoot(), "templates"), projectTemplates);

  const baseDirs = [
    ".ai-spector/graph",
    ".ai-spector/registry",
    ".ai-spector/.docflow/analysis",
    ".ai-spector/.docflow/extract",
    ".ai-spector/.docflow/graph",
    ".ai-spector/views",
    "docs/detail-design",
    "prototype",
    "prototype/src",
  ];
  for (const d of baseDirs) {
    await mkdir(join(root, d), { recursive: true });
  }

  // Create per-language doc folders
  for (const lang of languages) {
    await mkdir(join(root, `docs/srs/${lang.code}`), { recursive: true });
    await mkdir(join(root, `docs/basic-design/${lang.code}`), { recursive: true });
    const gitkeep = join(root, `docs/srs/${lang.code}/.gitkeep`);
    if (!(await pathExists(gitkeep))) {
      await writeFile(gitkeep, "");
    }
  }

  const statePath = join(root, ".ai-spector/.docflow/state.json");
  await writeJson(statePath, {
    version: 1,
    initializedAt: new Date().toISOString(),
    analysis: { lastRunAt: null, graphPreparedAt: null },
    index: { lastRunAt: null },
  });

  const gitignorePath = await ensureAiSpectorGitignore(root);

  let gitInitialized = false;
  let hookPath: string | undefined;
  try {
    gitInitialized = await ensureGitRepository(root);
    hookPath = await installGitHooks(root);
  } catch {
    hookPath = undefined;
  }

  console.log(`Initialized AI Spector project at ${root}`);
  console.log("");
  console.log(`  languages -> ${langCodes.join(", ")}`);
  console.log(`  gitignore -> ${gitignorePath} (npx ai-spector block added/updated)`);
  if (gitInitialized) {
    console.log(`  git       -> initialized new repository at ${root}`);
  }
  if (hookPath) {
    console.log(`  git hook  -> ${hookPath} (pre-commit: validate + translation + impact)`);
  } else {
    console.log("  git hook  -> not installed (run: npx ai-spector hooks install)");
  }
  console.log(`  templates -> ${projectTemplates} (SRS / basic / detail design)`);
  console.log(`  cursor    -> ${join(root, ".cursor")} (from scaffold/cursor/)`);
  console.log("");
  console.log("Next steps (Cursor):");
  console.log("  0. Re-audit setup: npx ai-spector setup --check");
  console.log("  1. Open this folder in Cursor");
  console.log("  2. Enable all npx ai-spector skills (.cursor/skills/ -- see README.md)");
  console.log("  3. Add files under docs/data-source/");
  console.log('  4. In Cursor: ask e.g. "analyze data source", "generate SRS"');
  console.log("     Workflow: .cursor/WORKFLOW.md");
  console.log('  5. Prototype: npx ai-spector prototype setup --theme vercel -> "generate HTML prototype"');
  console.log('  6. Add languages: npx ai-spector lang add <code>  (e.g. jp, vi)');
  console.log("");
  console.log("See .cursor/WORKFLOW.md -- agents use skills + CLI; you rarely run CLI yourself.");
}
