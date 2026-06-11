import { mkdir, readdir, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import {
  packageBundleRoot,
  scaffoldBundleRoot,
  scaffoldClaudeBundleRoot,
  scaffoldCursorBundleRoot,
} from "../config/load.js";
import { copyTree, pathExists, readJson, writeJson } from "../util/fs.js";
import { ensureGitRepository, installGitHooks } from "./hooks.js";
import { ensureAiSpectorGitignore } from "../util/gitignore.js";
import { isInteractive, promptLine, promptSelect, promptYesNo } from "../util/prompt.js";
import { checkCocoindexReadiness, runCocoindexSetup } from "./cocoindex.js";
import type { CocoindexInstallMode } from "./cocoindex.js";
import type { LanguageConfig, SupportedLanguageCode } from "../config/types.js";
import { assertSupportedLanguageCode } from "../config/types.js";

const MCP_SERVER_ENTRY = {
  command: "npx",
  args: ["ai-spector-mcp"],
};

async function writeMcpConfig(projectRoot: string): Promise<string> {
  const mcpPath = join(projectRoot, ".mcp.json");
  const existing = (await pathExists(mcpPath))
    ? await readJson<{ mcpServers?: Record<string, unknown> }>(mcpPath)
    : {};
  const merged = {
    ...existing,
    mcpServers: { ...(existing.mcpServers ?? {}), "ai-spector": MCP_SERVER_ENTRY },
  };
  await writeJson(mcpPath, merged);
  return mcpPath;
}

export type AgentTarget = "cursor" | "claude" | "both";

export interface InitOptions {
  targetDir: string;
  force?: boolean;
  /** Language codes to set up, e.g. ["en", "jp"]. Defaults to ["en"]. */
  languages?: string[];
  /** Client-preferred language code — must be one of `languages`. */
  clientLanguage?: string;
  /** Which AI agent scaffold to install. Prompted interactively when not set. */
  target?: AgentTarget;
  /** Skip all prompts and use defaults / provided flags. */
  yes?: boolean;
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

const LANGUAGE_LIST = Object.entries(LANGUAGE_LABELS)
  .filter(([code]) => !["ja"].includes(code)) // dedupe ja/jp
  .map(([code, label]) => `${code} (${label})`)
  .join(", ");

function buildLanguageConfigs(codes: string[]): LanguageConfig[] {
  return codes.map((code) => ({
    code: assertSupportedLanguageCode(code),
    label: LANGUAGE_LABELS[code] ?? code,
  }));
}

/** Copy bundled scaffold/cursor/ -> project .cursor/. */
export async function copyCursorToProject(projectRoot: string): Promise<void> {
  await copyTree(scaffoldCursorBundleRoot(), join(projectRoot, ".cursor"));
}

/** Copy bundled scaffold/claude/ -> project root (CLAUDE.md + .claude/). */
export async function copyClaudeToProject(projectRoot: string): Promise<void> {
  await copyTree(scaffoldClaudeBundleRoot(), projectRoot);
}

/** Copy scaffold into project. cursor/ and claude/ are handled via target. */
export async function copyScaffoldToProject(
  projectRoot: string,
  target: AgentTarget = "cursor",
): Promise<void> {
  const scaffold = scaffoldBundleRoot();
  const entries = await readdir(scaffold, { withFileTypes: true });
  const skipDirs = new Set(["cursor", "claude", "cocoindex"]);
  for (const ent of entries) {
    if (skipDirs.has(ent.name)) {
      continue;
    }
    await copyTree(join(scaffold, ent.name), join(projectRoot, ent.name));
  }
  if (target === "cursor" || target === "both") {
    await copyCursorToProject(projectRoot);
  }
  if (target === "claude" || target === "both") {
    await copyClaudeToProject(projectRoot);
  }
}

// ---------------------------------------------------------------------------
// Interactive wizard
// ---------------------------------------------------------------------------

interface WizardAnswers {
  target: AgentTarget;
  langCodes: string[];
  clientLanguageCode: string | undefined;
  installHook: boolean;
  cocoindexMode: CocoindexInstallMode | "skip";
}

async function runWizard(opts: InitOptions, alreadyInitialized: boolean): Promise<WizardAnswers> {
  const interactive = isInteractive() && !opts.yes;

  // --- Target ---
  let target: AgentTarget = opts.target ?? "cursor";
  if (!opts.target && interactive) {
    target = await promptSelect<AgentTarget>(
      "Which AI editor(s) should be set up?",
      [
        { value: "cursor", label: "Cursor", hint: "rules + skills in .cursor/" },
        { value: "claude", label: "Claude Code", hint: "CLAUDE.md + .claude/skills/" },
        { value: "both", label: "Both Cursor and Claude Code" },
      ],
      "cursor",
    );
  }

  // --- Languages ---
  let langCodes: string[] = opts.languages && opts.languages.length > 0 ? opts.languages : [];
  if (langCodes.length === 0 && interactive) {
    process.stdout.write(`\nAvailable language codes: ${LANGUAGE_LIST}\n`);
    const raw = await promptLine(
      "Languages (comma-separated, e.g. en,jp,vi) — press Enter to skip and configure later",
      "en",
    );
    langCodes = raw.split(",").map((c) => c.trim()).filter(Boolean);
  }
  if (langCodes.length === 0) {
    langCodes = ["en"];
  }

  // --- Client language preference ---
  let clientLanguageCode: SupportedLanguageCode | undefined = opts.clientLanguage
    ? assertSupportedLanguageCode(opts.clientLanguage)
    : undefined;
  if (!clientLanguageCode && langCodes.length > 1 && interactive) {
    const languageOptions = langCodes.map((code) => ({
      value: code,
      label: `${LANGUAGE_LABELS[code] ?? code} (${code})`,
      hint: code === langCodes[0] ? "primary — generation language" : "secondary",
    }));
    const picked = await promptSelect<string>(
      "\nWhich language does the client prefer for document review?",
      languageOptions,
      langCodes[langCodes.length - 1]!,
    );
    clientLanguageCode = assertSupportedLanguageCode(picked);
  }
  if (clientLanguageCode && !langCodes.includes(clientLanguageCode)) {
    throw new Error(
      `Client language "${clientLanguageCode}" must be one of the configured languages: ${langCodes.join(", ")}`,
    );
  }

  // --- Git hook ---
  let installHook = false;
  if (interactive) {
    installHook = await promptYesNo(
      "\nInstall git pre-commit hook? (runs validate + translation + impact on commit)",
      true,
    );
  } else {
    installHook = true; // non-interactive: always attempt
  }

  // --- CocoIndex ---
  let cocoindexMode: CocoindexInstallMode | "skip" = "skip";
  if (interactive) {
    cocoindexMode = await promptSelect<CocoindexInstallMode | "skip">(
      "\nEnable CocoIndex for semantic doc search? (requires Python 3.11+)",
      [
        { value: "skip", label: "Skip", hint: "set up later with: npx ai-spector cocoindex setup" },
        { value: "venv", label: "Yes — install in venv", hint: "recommended: isolated .venv inside cocoindex dir" },
        { value: "global", label: "Yes — install globally", hint: "uses system pip3; may need --break-system-packages on macOS" },
      ],
      "skip",
    );
  }

  return { target, langCodes, clientLanguageCode, installHook, cocoindexMode };
}

// ---------------------------------------------------------------------------
// Core init
// ---------------------------------------------------------------------------

export async function runInit(opts: InitOptions): Promise<void> {
  const root = resolve(opts.targetDir);
  const marker = join(root, ".ai-spector", "docflow.config.json");
  const alreadyInitialized = await pathExists(marker);

  if (alreadyInitialized && !opts.force) {
    throw new Error(
      `Project already initialized (${marker}). Use --force to overwrite scaffold files.`,
    );
  }

  // Header
  process.stdout.write("\nAI Spector — init\n");
  process.stdout.write("=================\n");
  if (alreadyInitialized) {
    process.stdout.write("Re-initializing (--force). Existing scaffold files will be overwritten.\n");
  }

  const { target, langCodes, clientLanguageCode, installHook, cocoindexMode } = await runWizard(opts, alreadyInitialized);
  const languages = buildLanguageConfigs(langCodes);

  process.stdout.write("\nSetting up…\n");

  await copyScaffoldToProject(root, target);

  // Patch languages into config
  const configPath = join(root, ".ai-spector", "docflow.config.json");
  const existingConfig = await readJson<Record<string, unknown>>(configPath);
  await writeJson(configPath, {
    ...existingConfig,
    languages,
    ...(clientLanguageCode ? { clientLanguage: clientLanguageCode } : {}),
    packs: (existingConfig.packs as Record<string, unknown>) ?? { srs: "builtin", basicDesign: "builtin" },
  });

  // Templates
  const projectTemplates = join(root, ".ai-spector", "templates");
  await mkdir(projectTemplates, { recursive: true });
  await copyTree(join(packageBundleRoot(), "templates"), projectTemplates);

  // Base directories
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

  // Per-language doc folders
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
  if (installHook) {
    try {
      gitInitialized = await ensureGitRepository(root);
      hookPath = await installGitHooks(root);
    } catch {
      hookPath = undefined;
    }
  }

  // CocoIndex setup
  let cocoSetupResult: Awaited<ReturnType<typeof runCocoindexSetup>> | undefined;
  if (cocoindexMode !== "skip") {
    process.stdout.write("\nSetting up CocoIndex…\n");
    cocoSetupResult = await runCocoindexSetup({
      root,
      installMode: cocoindexMode,
      installDeps: true,
    });
    if (cocoSetupResult.installError) {
      process.stdout.write(`  Warning: dependency install failed — ${cocoSetupResult.installError}\n`);
      process.stdout.write("  You can retry manually: npx ai-spector cocoindex setup\n");
    }
  }

  // Write .mcp.json for Claude target
  let claudeMcpPath: string | undefined;
  if (target === "claude" || target === "both") {
    claudeMcpPath = await writeMcpConfig(root);
  }

  // CocoIndex status
  const cocoReadiness = await checkCocoindexReadiness(root);

  // ---------------------------------------------------------------------------
  // Summary
  // ---------------------------------------------------------------------------
  process.stdout.write("\n");
  process.stdout.write(`Initialized at ${root}\n`);
  process.stdout.write("\n");
  process.stdout.write(`  editor    -> ${target}\n`);
  process.stdout.write(`  languages -> ${langCodes.join(", ")}\n`);
  process.stdout.write(`  gitignore -> ${gitignorePath}\n`);
  if (gitInitialized) {
    process.stdout.write(`  git       -> initialized new repository\n`);
  }
  if (hookPath) {
    process.stdout.write(`  git hook  -> ${hookPath}\n`);
  } else if (installHook) {
    process.stdout.write(`  git hook  -> not installed (run: npx ai-spector hooks install)\n`);
  } else {
    process.stdout.write(`  git hook  -> skipped  (run later: npx ai-spector hooks install)\n`);
  }
  if (target === "cursor" || target === "both") {
    process.stdout.write(`  cursor    -> .cursor/ (rules + skills + mcp.json)\n`);
  }
  if (target === "claude" || target === "both") {
    process.stdout.write(`  claude    -> CLAUDE.md + .claude/skills/\n`);
    process.stdout.write(`  mcp       -> ${claudeMcpPath} (ai-spector MCP server registered)\n`);
  }
  if (cocoReadiness.configured) {
    if (cocoReadiness.depsInstalled) {
      process.stdout.write(`  cocoindex -> ready ✓ (${cocoindexMode === "venv" ? "venv" : "global"}, run: npx ai-spector cocoindex update to build index)\n`);
    } else {
      process.stdout.write(`  cocoindex -> scaffolded only — deps not installed\n`);
      process.stdout.write(`      fix: npx ai-spector cocoindex setup\n`);
    }
  } else {
    process.stdout.write(`  cocoindex -> not configured (run: npx ai-spector cocoindex setup)\n`);
  }

  process.stdout.write("\n");
  process.stdout.write("What you can change later:\n");
  process.stdout.write("  Add a language:       npx ai-spector lang add <code>\n");
  process.stdout.write("  Add Cursor support:   npx ai-spector sync-cursor\n");
  process.stdout.write("  Add Claude support:   npx ai-spector init --target claude --force\n");
  process.stdout.write("  Install git hook:     npx ai-spector hooks install\n");
  process.stdout.write("  Re-audit setup:       npx ai-spector setup --check\n");
  process.stdout.write("\n");

  if (target === "cursor" || target === "both") {
    process.stdout.write("Cursor — next steps:\n");
    process.stdout.write("  1. Open this folder in Cursor\n");
    process.stdout.write("  2. Enable all skills under .cursor/skills/ (see .cursor/skills/README.md)\n");
    process.stdout.write("  3. Add files under docs/data-source/\n");
    process.stdout.write('  4. Ask: "analyze data source"  →  "generate SRS"\n');
    process.stdout.write("\n");
  }
  if (target === "claude" || target === "both") {
    process.stdout.write("Claude Code — next steps:\n");
    process.stdout.write("  1. Open this folder in Claude Code\n");
    process.stdout.write("  2. Skills load automatically from .claude/skills/\n");
    process.stdout.write("  3. Add files under docs/data-source/\n");
    process.stdout.write('  4. Ask: "analyze data source"  →  "generate SRS"\n');
    process.stdout.write("\n");
  }
}
