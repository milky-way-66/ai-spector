import { createRequire } from "node:module";
import semver from "semver";
import type { UpgradeChecklist, UpgradeChecklistItem, UpgradeEditor } from "./types.js";

const require = createRequire(import.meta.url);

export function loadUpgradeChecklist(): UpgradeChecklist {
  const data = require("./checklist.json") as UpgradeChecklist;
  if (data.version !== 1) {
    throw new Error(`Unsupported upgrade checklist version: ${data.version}`);
  }
  return data;
}

export function filterApplicableItems(
  items: UpgradeChecklistItem[],
  opts: { fromVersion: string; toVersion: string; editors: UpgradeEditor[] },
): UpgradeChecklistItem[] {
  const from = semver.coerce(opts.fromVersion)?.version ?? "0.0.0";
  const to = semver.coerce(opts.toVersion)?.version ?? opts.toVersion;

  if (!semver.gt(to, from)) {
    return [];
  }

  return items.filter((item) => {
    const since = semver.coerce(item.since)?.version ?? item.since;
    if (since !== "0.0.0" && !semver.lt(from, since)) {
      return false;
    }
    if (item.until) {
      const until = semver.coerce(item.until)?.version ?? item.until;
      if (!semver.lt(from, until)) {
        return false;
      }
    }
    if (item.editors && item.editors.length > 0) {
      return item.editors.some((e) => opts.editors.includes(e));
    }
    return true;
  });
}
