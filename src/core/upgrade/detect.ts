import { join } from "node:path";
import semver from "semver";
import { pathExists, readJson } from "../util/fs.js";
import { getByPath } from "./config-path.js";
import type {
  UpgradeChecklistItem,
  UpgradeDetectRule,
  UpgradeEditor,
  UpgradeFinding,
} from "./types.js";

export interface DetectContext {
  root: string;
  fromVersion: string;
  toVersion: string;
  editors: UpgradeEditor[];
}

function semverJump(
  fromVersion: string,
  toVersion: string,
): "patch" | "minor" | "major" | null {
  const from = semver.coerce(fromVersion)?.version;
  const to = semver.coerce(toVersion)?.version;
  if (!from || !to) {
    return null;
  }
  return semver.diff(from, to) as "patch" | "minor" | "major" | null;
}

function jumpMeetsMin(
  jump: "patch" | "minor" | "major" | null,
  minJump?: "patch" | "minor" | "major",
): boolean {
  if (!minJump) {
    return true;
  }
  if (!jump) {
    return false;
  }
  const order = { patch: 1, minor: 2, major: 3 };
  return order[jump] >= order[minJump];
}

async function readProjectConfig(
  root: string,
  relativePath?: string,
): Promise<Record<string, unknown>> {
  const configPath = join(root, relativePath ?? ".ai-spector/docflow.config.json");
  if (!(await pathExists(configPath))) {
    return {};
  }
  return readJson<Record<string, unknown>>(configPath);
}

export async function evaluateItemDetect(
  item: UpgradeChecklistItem,
  ctx: DetectContext,
): Promise<UpgradeFinding | null> {
  const detect = item.detect;
  const fix =
    item.kind === "auto" || item.kind === "config"
      ? "auto"
      : item.kind === "agent"
        ? "agent"
        : "manual";

  switch (detect.type) {
    case "scaffold-stale": {
      const from = semver.coerce(ctx.fromVersion)?.version ?? ctx.fromVersion;
      const to = semver.coerce(ctx.toVersion)?.version ?? ctx.toVersion;
      if (!semver.lt(from, to)) {
        return null;
      }
      if (detect.target && !ctx.editors.includes(detect.target as UpgradeEditor)) {
        return null;
      }
      const jump = semverJump(ctx.fromVersion, ctx.toVersion);
      if (!jumpMeetsMin(jump, detect.minJump)) {
        return null;
      }
      return {
        id: item.id,
        status: "stale",
        severity: item.severity,
        message: item.title,
        fix,
      };
    }
    case "always-when-upgrading": {
      const from = semver.coerce(ctx.fromVersion)?.version ?? ctx.fromVersion;
      const to = semver.coerce(ctx.toVersion)?.version ?? ctx.toVersion;
      if (!semver.lt(from, to)) {
        return null;
      }
      return {
        id: item.id,
        status: "missing",
        severity: item.severity,
        message: item.title,
        fix,
        detail: item.userGuide ?? item.agentGuide,
      };
    }
    case "config-missing-key":
      return evaluateConfigMissingKey(item.id, detect, ctx, fix, item.severity, item.title, detect.path);
    case "config-deprecated-key":
      return evaluateConfigDeprecatedKey(item.id, detect, ctx, fix, item.severity, item.title, detect.path);
    case "hook-stale": {
      const { scanHook } = await import("./detectors.js");
      const hooks = await scanHook(ctx.root);
      if (hooks.length === 0) {
        return null;
      }
      return {
        id: item.id,
        status: "missing",
        severity: item.severity,
        message: item.title,
        fix,
      };
    }
    case "file-missing": {
      if (!detect.path) {
        return null;
      }
      const exists = await pathExists(join(ctx.root, detect.path));
      if (exists) {
        return null;
      }
      return {
        id: item.id,
        status: "missing",
        severity: item.severity,
        message: item.title,
        fix,
      };
    }
    default:
      return null;
  }
}

async function evaluateConfigMissingKey(
  id: string,
  detect: UpgradeDetectRule,
  ctx: DetectContext,
  fix: UpgradeFinding["fix"],
  severity: UpgradeFinding["severity"],
  title: string,
  configPath?: string,
): Promise<UpgradeFinding | null> {
  if (!detect.key) {
    return null;
  }
  const config = await readProjectConfig(ctx.root, configPath);
  const value = getByPath(config, detect.key);
  if (value !== undefined && value !== null) {
    return null;
  }
  return {
    id,
    status: "missing",
    severity,
    message: title,
    fix,
    detail: `Missing config key: ${detect.key}`,
  };
}

async function evaluateConfigDeprecatedKey(
  id: string,
  detect: UpgradeDetectRule,
  ctx: DetectContext,
  fix: UpgradeFinding["fix"],
  severity: UpgradeFinding["severity"],
  title: string,
  configPath?: string,
): Promise<UpgradeFinding | null> {
  if (!detect.key) {
    return null;
  }
  const config = await readProjectConfig(ctx.root, configPath);
  const value = getByPath(config, detect.key);
  if (value === undefined) {
    return null;
  }
  return {
    id,
    status: "warning",
    severity,
    message: title,
    fix,
    detail: `Deprecated config key: ${detect.key}`,
  };
}
