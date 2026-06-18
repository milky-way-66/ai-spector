import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { upgradeArtifactPaths } from "./paths.js";
import { pathExists, readJson, writeJson } from "../util/fs.js";
import type { UpgradeSetupItem, UpgradeSetupState } from "./types.js";
import { UPGRADE_GATE_ITEMS } from "./types.js";

export function emptyUpgradeSetup(): UpgradeSetupState {
  const items: Record<string, UpgradeSetupItem> = {};
  for (const id of UPGRADE_GATE_ITEMS) {
    items[id] = { done: false, at: null };
  }
  return {
    version: 1,
    fromVersion: null,
    toVersion: null,
    startedAt: null,
    completedAt: null,
    items,
  };
}

export async function loadUpgradeSetup(root: string): Promise<UpgradeSetupState> {
  const { setup } = upgradeArtifactPaths(root);
  if (!(await pathExists(setup))) {
    return emptyUpgradeSetup();
  }
  const state = await readJson<UpgradeSetupState>(setup);
  const base = emptyUpgradeSetup();
  return {
    version: 1,
    fromVersion: state.fromVersion ?? null,
    toVersion: state.toVersion ?? null,
    startedAt: state.startedAt ?? null,
    completedAt: state.completedAt ?? null,
    items: { ...base.items, ...state.items },
  };
}

async function saveUpgradeSetup(root: string, state: UpgradeSetupState): Promise<void> {
  const { dir, setup } = upgradeArtifactPaths(root);
  await mkdir(dir, { recursive: true });
  await writeJson(setup, state);
}

export async function completeUpgradeSession(root: string): Promise<UpgradeSetupState> {
  const state = await loadUpgradeSetup(root);
  const now = new Date().toISOString();
  state.completedAt = now;
  state.items["upgrade.complete"] = { done: true, at: now };
  await saveUpgradeSetup(root, state);
  return state;
}

export async function markUpgradeSetupItem(
  root: string,
  itemId: string,
  note?: string,
): Promise<UpgradeSetupState> {
  if (itemId === "upgrade.complete") {
    const { validateUpgrade } = await import("./validate.js");
    const validation = await validateUpgrade({ root });
    if (!validation.ready) {
      throw new Error(
        "Cannot mark upgrade.complete — required upgrade items are still open. Run upgrade validate for details.",
      );
    }
    return validation.setup;
  }

  const state = await loadUpgradeSetup(root);
  const now = new Date().toISOString();
  if (!state.startedAt) {
    state.startedAt = now;
  }
  state.items[itemId] = {
    done: true,
    at: now,
    ...(note ? { note } : {}),
  };
  if (itemId === "upgrade.complete") {
    state.completedAt = now;
  }
  await saveUpgradeSetup(root, state);
  return state;
}

export async function initUpgradeSession(
  root: string,
  fromVersion: string,
  toVersion: string,
): Promise<UpgradeSetupState> {
  const state = await loadUpgradeSetup(root);
  state.fromVersion = fromVersion;
  state.toVersion = toVersion;
  if (!state.startedAt) {
    state.startedAt = new Date().toISOString();
  }
  await saveUpgradeSetup(root, state);
  return state;
}

export async function readProjectConfigRaw(root: string): Promise<Record<string, unknown>> {
  const configPath = join(root, ".ai-spector", "docflow.config.json");
  return readJson<Record<string, unknown>>(configPath);
}

export async function writeProjectConfigRaw(
  root: string,
  config: Record<string, unknown>,
): Promise<void> {
  const configPath = join(root, ".ai-spector", "docflow.config.json");
  await writeJson(configPath, config);
}
