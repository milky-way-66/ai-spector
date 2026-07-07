import { join, resolve } from "node:path";
import { ensureGitRepository, installGitHooks } from "../operations/hooks.js";
import { runSyncClaude } from "../operations/sync-claude.js";
import { runSyncCursor } from "../operations/sync-cursor.js";
import { renameByPath, setByPath } from "./config-path.js";
import { loadUpgradeChecklist } from "./checklist.js";
import { runUpgradeScan } from "./scan.js";
import {
  markUpgradeSetupItem,
  readProjectConfigRaw,
  writeProjectConfigRaw,
} from "./setup.js";
import type { UpgradeApplyRule, UpgradeChecklistItem } from "./types.js";

async function applyUpgradeItem(root: string, item: UpgradeChecklistItem): Promise<void> {
  const apply = item.apply;
  if (!apply) {
    throw new Error(`Checklist item ${item.id} has no apply rule`);
  }

  if (apply.command) {
    switch (apply.command) {
      case "sync-cursor":
        await runSyncCursor({ targetDir: root });
        return;
      case "sync-claude":
        await runSyncClaude({ targetDir: root });
        return;
      case "hooks install":
        await ensureGitRepository(root);
        await installGitHooks(root);
        return;
      case "docops-repair": {
        const { readDocopsConfig } = await import("../docops/config.js");
        const { repairDocopsContract } = await import("../docops/migrate.js");
        const config = await readDocopsConfig(root);
        if (!config) {
          return;
        }
        const actions: string[] = [];
        await repairDocopsContract(root, config, actions, false);
        return;
      }
      default:
        throw new Error(`Unknown upgrade command: ${apply.command}`);
    }
  }

  await applyConfigPatch(root, apply);
}

async function applyConfigPatch(root: string, apply: UpgradeApplyRule): Promise<void> {
  const config = await readProjectConfigRaw(root);
  if (apply.type === "config-set") {
    if (!apply.key) {
      throw new Error("config-set apply rule requires key");
    }
    await writeProjectConfigRaw(root, setByPath(config, apply.key, apply.value));
    return;
  }
  if (apply.type === "config-rename") {
    if (!apply.from || !apply.to) {
      throw new Error("config-rename apply rule requires from and to");
    }
    await writeProjectConfigRaw(root, renameByPath(config, apply.from, apply.to));
    return;
  }
  throw new Error(`Unknown config apply type: ${apply.type}`);
}

export async function runUpgradeApply(opts: {
  root: string;
  auto?: boolean;
  items?: string[];
}): Promise<{ applied: string[]; failed: Array<{ id: string; error: string }> }> {
  const root = resolve(opts.root);
  const scan = await runUpgradeScan({ root });
  const setup = await (await import("./setup.js")).loadUpgradeSetup(root);
  const checklist = loadUpgradeChecklist();
  const byId = new Map(checklist.items.map((i) => [i.id, i]));

  const targetIds =
    opts.items ??
    (opts.auto !== false
      ? scan.autoFixable.filter((id) => !setup.items[id]?.done)
      : []);

  const applied: string[] = [];
  const failed: Array<{ id: string; error: string }> = [];

  for (const id of targetIds) {
    const item = byId.get(id);
    if (!item || (item.kind !== "auto" && item.kind !== "config")) {
      continue;
    }
    if (setup.items[id]?.done) {
      continue;
    }
    try {
      await applyUpgradeItem(root, item);
      await markUpgradeSetupItem(root, id);
      applied.push(id);
    } catch (err) {
      failed.push({ id, error: err instanceof Error ? err.message : String(err) });
    }
  }

  if (applied.length > 0 && failed.length === 0) {
    await markUpgradeSetupItem(root, "upgrade.auto-applied");
  }

  return { applied, failed };
}
