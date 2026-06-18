import { join } from "node:path";
import semver from "semver";
import { HOOK_MARKER } from "../operations/hooks-constants.js";
import { pathExists, readJson } from "../util/fs.js";
import type { UpgradeEditor, UpgradeFinding } from "./types.js";

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

export function scanScaffoldVersion(
  fromVersion: string,
  toVersion: string,
): UpgradeFinding | null {
  const from = semver.coerce(fromVersion)?.version ?? fromVersion;
  const to = semver.coerce(toVersion)?.version ?? toVersion;
  if (!semver.lt(from, to)) {
    return null;
  }
  return {
    id: "SCAN-scaffold-version",
    status: "stale",
    severity: "required",
    message: `Scaffold ${fromVersion} is behind installed package ${toVersion}`,
    fix: "auto",
    detail: "Run upgrade apply to sync scaffold",
  };
}

export async function scanConfigSchema(root: string): Promise<UpgradeFinding[]> {
  const configPath = join(root, ".ai-spector", "docflow.config.json");
  if (!(await pathExists(configPath))) {
    return [];
  }
  const raw = await readJson<Record<string, unknown>>(configPath);
  const findings: UpgradeFinding[] = [];
  const packs = raw.packs as Record<string, unknown> | undefined;
  if (!packs?.basicDesign) {
    findings.push({
      id: "SCAN-config-schema-packs.basicDesign",
      status: "missing",
      severity: "required",
      message: "docflow.config.json is missing packs.basicDesign",
      fix: "auto",
    });
  }
  if (!packs?.srs && !packs?.active) {
    findings.push({
      id: "SCAN-config-schema-packs.srs",
      status: "missing",
      severity: "required",
      message: "docflow.config.json is missing packs.srs",
      fix: "auto",
    });
  }
  const paths = raw.paths as Record<string, unknown> | undefined;
  if (!paths?.templates) {
    findings.push({
      id: "SCAN-config-schema-paths.templates",
      status: "missing",
      severity: "recommended",
      message: "docflow.config.json is missing paths.templates",
      fix: "auto",
    });
  }
  return findings;
}

export async function scanConfigDrift(root: string): Promise<UpgradeFinding[]> {
  const configPath = join(root, ".ai-spector", "docflow.config.json");
  if (!(await pathExists(configPath))) {
    return [];
  }
  const raw = await readJson<Record<string, unknown>>(configPath);
  const packs = raw.packs as Record<string, unknown> | undefined;
  if (packs?.active !== undefined) {
    return [
      {
        id: "SCAN-config-drift-packs.active",
        status: "warning",
        severity: "required",
        message: "Deprecated config key packs.active — rename to packs.srs",
        fix: "auto",
      },
    ];
  }
  return [];
}

export async function scanScaffoldPresence(
  root: string,
  editors: UpgradeEditor[],
): Promise<UpgradeFinding[]> {
  const findings: UpgradeFinding[] = [];
  if (editors.includes("cursor")) {
    const skill = join(root, ".cursor/skills/ai-spector/SKILL.md");
    if (!(await pathExists(skill))) {
      findings.push({
        id: "SCAN-scaffold-presence-cursor",
        status: "missing",
        severity: "required",
        message: "Missing .cursor/skills/ai-spector/SKILL.md",
        fix: "auto",
      });
    }
  }
  if (editors.includes("claude")) {
    const skill = join(root, ".claude/skills/ai-spector/skill.md");
    if (!(await pathExists(skill)) && !(await pathExists(join(root, "CLAUDE.md")))) {
      findings.push({
        id: "SCAN-scaffold-presence-claude",
        status: "missing",
        severity: "required",
        message: "Missing Claude scaffold (.claude/skills/ai-spector/ or CLAUDE.md)",
        fix: "auto",
      });
    }
  }
  return findings;
}

export async function scanHook(root: string): Promise<UpgradeFinding[]> {
  const ok = await hookInstalled(root);
  if (ok) {
    return [];
  }
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
  if (!gitOk) {
    return [];
  }
  return [
    {
      id: "SCAN-hook",
      status: "missing",
      severity: "recommended",
      message: "Pre-commit hook missing or stale",
      fix: "auto",
    },
  ];
}

export async function scanMcpConfig(
  root: string,
  editors: UpgradeEditor[],
): Promise<UpgradeFinding[]> {
  const findings: UpgradeFinding[] = [];
  if (editors.includes("cursor")) {
    const mcpPath = join(root, ".cursor/mcp.json");
    if (!(await pathExists(mcpPath))) {
      findings.push({
        id: "SCAN-mcp-config-cursor",
        status: "warning",
        severity: "recommended",
        message: "Missing .cursor/mcp.json",
        fix: "manual",
      });
    }
  }
  if (editors.includes("claude")) {
    const mcpPath = join(root, ".mcp.json");
    if (!(await pathExists(mcpPath))) {
      findings.push({
        id: "SCAN-mcp-config-claude",
        status: "warning",
        severity: "recommended",
        message: "Missing .mcp.json",
        fix: "manual",
      });
    }
  }
  return findings;
}
