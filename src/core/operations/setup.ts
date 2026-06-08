import { mkdir } from "node:fs/promises";
import { join, resolve } from "node:path";
import { createRequire } from "node:module";
import { loadDocflowConfig } from "../config/load.js";
import { runInit } from "./init.js";
import { ensureGitRepository, installGitHooks } from "./hooks.js";
import { isCocoindexConfigured, runCocoindexSetup } from "./cocoindex.js";
import { runSyncCursor } from "./sync-cursor.js";
import { pathExists, readJson } from "../util/fs.js";
import { ensureAiSpectorGitignore } from "../util/gitignore.js";
import { isInteractive, promptLine, promptYesNo } from "../util/prompt.js";
import { HOOK_MARKER } from "./hooks-constants.js";

const require = createRequire(import.meta.url);
const packageJson = require("../../../package.json") as { version: string; engines?: { node?: string } };

export type SetupStepStatus = "ok" | "missing" | "warning";

export interface SetupStep {
  id: string;
  label: string;
  status: SetupStepStatus;
  detail?: string;
  fix?: string;
}

export interface SetupAudit {
  projectRoot: string;
  ready: boolean;
  steps: SetupStep[];
}

export interface SetupOptions {
  root?: string;
  languages?: string[];
  yes?: boolean;
  force?: boolean;
  installDep?: boolean;
  skipInit?: boolean;
  json?: boolean;
}

function parseNodeMajor(): number {
  const match = /^v(\d+)/.exec(process.version);
  return match ? Number(match[1]) : 0;
}

function requiredNodeMajor(): number {
  const spec = packageJson.engines?.node ?? ">=20";
  const m = /(\d+)/.exec(spec);
  return m ? Number(m[1]) : 20;
}

async function hookInstalled(projectRoot: string): Promise<boolean> {
  try {
    const { execFile } = await import("node:child_process");
    const { promisify } = await import("node:util");
    const exec = promisify(execFile);
    const { stdout: gitDirRaw } = await exec("git", ["rev-parse", "--absolute-git-dir"], {
      cwd: projectRoot,
    });
    const hookPath = join(gitDirRaw.trim(), "hooks", "pre-commit");
    if (!(await pathExists(hookPath))) {
      return false;
    }
    const { readFile } = await import("node:fs/promises");
    const content = await readFile(hookPath, "utf8");
    return content.includes(HOOK_MARKER);
  } catch {
    return false;
  }
}

export async function auditSetup(projectRoot: string): Promise<SetupAudit> {
  const root = resolve(projectRoot);
  const steps: SetupStep[] = [];

  const nodeMajor = parseNodeMajor();
  const needNode = requiredNodeMajor();
  steps.push({
    id: "node",
    label: `Node.js ${needNode}+`,
    status: nodeMajor >= needNode ? "ok" : "missing",
    detail: `current: ${process.version}`,
    fix: nodeMajor < needNode ? `Install Node ${needNode}+` : undefined,
  });

  const configPath = join(root, ".ai-spector/docflow.config.json");
  const initialized = await pathExists(configPath);
  steps.push({
    id: "init",
    label: "AI Spector project scaffold",
    status: initialized ? "ok" : "missing",
    detail: initialized ? configPath : undefined,
    fix: initialized ? undefined : "npx ai-spector init",
  });

  const skillsPath = join(root, ".cursor/skills/ai-spector/SKILL.md");
  steps.push({
    id: "cursor-skills",
    label: "Cursor agent skills",
    status: (await pathExists(skillsPath)) ? "ok" : "missing",
    fix: (await pathExists(skillsPath)) ? undefined : "npx ai-spector init",
  });

  const dataSource = join(root, "docs/data-source");
  const hasDataSource = await pathExists(dataSource);
  steps.push({
    id: "data-source",
    label: "docs/data-source/ folder",
    status: hasDataSource ? "ok" : "warning",
    fix: hasDataSource ? undefined : "mkdir -p docs/data-source",
  });

  let gitOk = false;
  try {
    const { execFile } = await import("node:child_process");
    const { promisify } = await import("node:util");
    const exec = promisify(execFile);
    const { stdout } = await exec("git", ["rev-parse", "--is-inside-work-tree"], { cwd: root });
    gitOk = stdout.trim() === "true";
  } catch {
    gitOk = false;
  }
  steps.push({
    id: "git",
    label: "Git repository",
    status: gitOk ? "ok" : "warning",
    fix: gitOk ? undefined : "git init",
  });

  const hookOk = await hookInstalled(root);
  steps.push({
    id: "pre-commit",
    label: "Pre-commit hook (validate + translation + impact)",
    status: hookOk ? "ok" : gitOk ? "missing" : "warning",
    fix: hookOk ? undefined : "npx ai-spector hooks install",
  });

  if (initialized) {
    try {
      const { config } = await loadDocflowConfig(root);
      const langs = config.languages.map((l) => l.code).join(", ");
      steps.push({
        id: "languages",
        label: "Configured languages",
        status: config.languages.length > 0 ? "ok" : "warning",
        detail: langs,
        fix: config.languages.length === 0 ? "npx ai-spector lang add jp" : undefined,
      });
      for (const lang of config.languages) {
        const srsDir = join(root, `docs/srs/${lang.code}`);
        steps.push({
          id: `docs-srs-${lang.code}`,
          label: `docs/srs/${lang.code}/`,
          status: (await pathExists(srsDir)) ? "ok" : "missing",
        });
      }
    } catch {
      steps.push({
        id: "languages",
        label: "Configured languages",
        status: "warning",
        detail: "Could not read docflow.config.json",
      });
    }

    const protoConfigPath = join(root, ".ai-spector/.docflow/config/prototype.config.json");
    if (await pathExists(protoConfigPath)) {
      const protoConfig = await readJson<{ prototypeDir?: string }>(protoConfigPath);
      const protoDir = protoConfig.prototypeDir?.trim() || "prototype";
      const manifestPath = join(root, protoDir, "manifest.json");
      const screenMapPath = join(root, protoDir, "screen-map.json");
      if (await pathExists(manifestPath)) {
        const screenMapExists = await pathExists(screenMapPath);
        steps.push({
          id: "prototype-screen-map",
          label: `${protoDir}/screen-map.json`,
          status: screenMapExists ? "ok" : "missing",
          fix: screenMapExists ? undefined : "npx ai-spector prototype manifest",
        });
      }
    }
  }

  const pkgPath = join(root, "package.json");
  if (await pathExists(pkgPath)) {
    const pkg = await readJson<{ devDependencies?: Record<string, string>; dependencies?: Record<string, string> }>(
      pkgPath,
    );
    const hasDep =
      pkg.devDependencies?.["ai-spector"] !== undefined ||
      pkg.dependencies?.["ai-spector"] !== undefined;
    steps.push({
      id: "npm-dep",
      label: "ai-spector npm dependency",
      status: hasDep ? "ok" : "warning",
      fix: hasDep ? undefined : "npm install -D ai-spector",
    });
  }

  const required = ["node", "init", "cursor-skills"];
  const ready = required.every((id) => steps.find((s) => s.id === id)?.status === "ok");

  return { projectRoot: root, ready, steps };
}

function formatAuditTable(audit: SetupAudit): string {
  const lines = ["Setup checklist", ""];
  for (const step of audit.steps) {
    const icon = step.status === "ok" ? "✓" : step.status === "warning" ? "!" : "✗";
    const detail = step.detail ? ` — ${step.detail}` : "";
    lines.push(`  ${icon} ${step.label}${detail}`);
    if (step.status !== "ok" && step.fix) {
      lines.push(`      fix: ${step.fix}`);
    }
  }
  lines.push("");
  lines.push(audit.ready ? "Project is ready for the docflow pipeline." : "Some required steps are missing.");
  return lines.join("\n");
}

async function maybeInstallDependency(root: string, installDep: boolean): Promise<void> {
  const pkgPath = join(root, "package.json");
  if (!installDep || !(await pathExists(pkgPath))) {
    return;
  }
  const pkg = await readJson<{ devDependencies?: Record<string, string>; dependencies?: Record<string, string> }>(
    pkgPath,
  );
  if (pkg.devDependencies?.["ai-spector"] || pkg.dependencies?.["ai-spector"]) {
    return;
  }
  console.log("Installing ai-spector as dev dependency…");
  const { spawn } = await import("node:child_process");
  await new Promise<void>((resolvePromise, reject) => {
    const child = spawn("npm", ["install", "-D", "ai-spector"], {
      cwd: root,
      stdio: "inherit",
      shell: process.platform === "win32",
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) {
        resolvePromise();
      } else {
        reject(new Error(`npm install exited with code ${code}`));
      }
    });
  });
}

export async function runSetupCheck(opts: SetupOptions = {}): Promise<SetupAudit> {
  const root = resolve(opts.root ?? process.cwd());
  return auditSetup(root);
}

export async function runSetup(opts: SetupOptions = {}): Promise<SetupAudit> {
  const root = resolve(opts.root ?? process.cwd());
  const interactive = isInteractive() && !opts.yes;

  let audit = await auditSetup(root);

  if (interactive && !audit.ready) {
    const cont = await promptYesNo("Run setup to fix missing required steps?", true);
    if (!cont) return audit;
  }

  let langCodes = opts.languages;
  if (!langCodes || langCodes.length === 0) {
    if (interactive) {
      const raw = await promptLine("Languages (comma-separated codes, e.g. en,jp,vi)", "en");
      langCodes = raw.split(",").map((c) => c.trim()).filter(Boolean);
    } else {
      langCodes = ["en"];
    }
  }
  if (langCodes.length === 0) langCodes = ["en"];

  const configExists = await pathExists(join(root, ".ai-spector/docflow.config.json"));
  const shouldInit = !opts.skipInit && (!configExists || opts.force);

  if (shouldInit) {
    await runInit({ targetDir: root, force: opts.force, languages: langCodes, yes: true });
  } else if (configExists) {
    await runSyncCursor({ targetDir: root });
    await ensureAiSpectorGitignore(root);
    try {
      await ensureGitRepository(root);
      await installGitHooks(root);
    } catch {
      // git hook skipped — not a hard error
    }
  }

  await mkdir(join(root, "docs/data-source"), { recursive: true });

  // Offer CocoIndex setup when interactive and not yet configured
  if (interactive && !(await isCocoindexConfigured(root))) {
    const setupCoco = await promptYesNo(
      "Enable CocoIndex for semantic doc search? (requires Python 3.11+)",
      false,
    );
    if (setupCoco) {
      await runCocoindexSetup({ root });
    }
  }

  if (opts.installDep) {
    try {
      await maybeInstallDependency(root, true);
    } catch {
      // non-fatal
    }
  }

  audit = await auditSetup(root);
  return audit;
}
