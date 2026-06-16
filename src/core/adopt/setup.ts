import { mkdir } from "node:fs/promises";
import { adoptArtifactPaths } from "./paths.js";
import { pathExists, readJson, writeJson } from "../util/fs.js";
import type { AdoptSetupItem, AdoptSetupState } from "./types.js";
import { validateAdopt } from "./validate.js";

const DEFAULT_SETUP_ITEMS = [
  "plan.approved",
  "apply.done",
  "bootstrap.done",
  "migration.complete",
] as const;

export function emptyAdoptSetup(): AdoptSetupState {
  const items: Record<string, AdoptSetupItem> = {};
  for (const id of DEFAULT_SETUP_ITEMS) {
    items[id] = { done: false, at: null };
  }
  return { version: 1, items };
}

export async function loadAdoptContext(root: string): Promise<Record<string, string>> {
  const { context } = adoptArtifactPaths(root);
  if (!(await pathExists(context))) {
    return {};
  }
  return readJson<Record<string, string>>(context);
}

export async function recordAdoptAnswer(
  root: string,
  id: string,
  answer: string,
): Promise<void> {
  const { context, dir } = adoptArtifactPaths(root);
  await mkdir(dir, { recursive: true });
  const existing = await loadAdoptContext(root);
  existing[id] = answer;
  await writeJson(context, existing);
}

export async function loadAdoptSetup(root: string): Promise<AdoptSetupState> {
  const { setup } = adoptArtifactPaths(root);
  if (!(await pathExists(setup))) {
    return emptyAdoptSetup();
  }
  const state = await readJson<AdoptSetupState>(setup);
  const base = emptyAdoptSetup();
  return {
    version: 1,
    items: { ...base.items, ...state.items },
  };
}

export async function markAdoptSetupItem(
  root: string,
  itemId: string,
): Promise<AdoptSetupState> {
  if (itemId === "migration.complete") {
    const validation = await validateAdopt({ root });
    if (!validation.ready) {
      const lines = validation.gaps
        .filter((g) => g.severity === "blocking")
        .map((g) => `- ${g.id}: ${g.message}`);
      throw new Error(
        `Adopt migration not ready — ${validation.blockingCount} blocking gap(s):\n${lines.join("\n")}`,
      );
    }
  }

  const { setup, dir } = adoptArtifactPaths(root);
  await mkdir(dir, { recursive: true });
  const state = await loadAdoptSetup(root);
  if (!state.items[itemId]) {
    state.items[itemId] = { done: false, at: null };
  }
  state.items[itemId] = { done: true, at: new Date().toISOString() };
  await writeJson(setup, state);
  return state;
}
