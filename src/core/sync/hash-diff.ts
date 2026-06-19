import type { BaselineFileEntry, DriftFileEntry } from "./types.js";

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
