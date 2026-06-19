import { DESIGN_LAYERS } from "./constants.js";
import type { BaselineFileEntry, DesignLayer, DriftFileEntry, SyncBaseline } from "./types.js";

export interface HashDiffResult {
  modified: DriftFileEntry[];
  added: DriftFileEntry[];
  deleted: DriftFileEntry[];
  unchanged: number;
}

export function diffLayerFileMaps(
  baseline: Record<string, BaselineFileEntry>,
  current: Record<string, BaselineFileEntry>,
): HashDiffResult {
  const modified: DriftFileEntry[] = [];
  const added: DriftFileEntry[] = [];
  const deleted: DriftFileEntry[] = [];
  let unchanged = 0;

  for (const [path, cur] of Object.entries(current)) {
    const base = baseline[path];
    if (!base) {
      added.push({ path, currentHash: cur.hash, diffSource: "none" });
    } else if (base.hash !== cur.hash) {
      modified.push({
        path,
        baselineHash: base.hash,
        currentHash: cur.hash,
        diffSource: "none",
      });
    } else {
      unchanged++;
    }
  }

  for (const path of Object.keys(baseline)) {
    if (!current[path]) {
      deleted.push({ path, baselineHash: baseline[path].hash, diffSource: "none" });
    }
  }

  modified.sort((a, b) => a.path.localeCompare(b.path));
  added.sort((a, b) => a.path.localeCompare(b.path));
  deleted.sort((a, b) => a.path.localeCompare(b.path));

  return { modified, added, deleted, unchanged };
}

/** Lightweight drift probe for workspace_check — no git diffs or graph impact. */
export function quickHasDesignLayerDrift(
  baseline: SyncBaseline,
  current: Record<DesignLayer, Record<string, BaselineFileEntry>>,
): boolean {
  let fileCount = 0;
  for (const layer of DESIGN_LAYERS) {
    const currentMap = current[layer];
    const baselineMap = baseline.layers[layer].files;
    fileCount += Object.keys(currentMap).length;
    if (Object.keys(currentMap).length !== Object.keys(baselineMap).length) {
      return true;
    }
    for (const [path, entry] of Object.entries(currentMap)) {
      const base = baselineMap[path];
      if (!base || base.hash !== entry.hash) {
        return true;
      }
    }
  }
  return fileCount !== baseline.totals.files;
}
