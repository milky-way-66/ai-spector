import { join } from "node:path";
import { loadDocflowConfig } from "../config/load.js";
import { pathExists } from "../util/fs.js";
import { DESIGN_LAYER_ROOTS } from "./constants.js";
import { loadBaseline, saveBaseline, hashGraphFile } from "./baseline.js";
import { discoverDesignLayerFiles, totalsForLayers } from "./discover.js";
import { resolveGitRef } from "./git-diff.js";
import type { SyncBaseline } from "./types.js";

export interface SyncSnapshotOptions {
  root?: string;
  label?: string;
  gitRef?: string;
  force?: boolean;
}

export interface SyncSnapshotResult {
  createdAt: string;
  label?: string;
  gitRef: string | null;
  graphHash: string;
  totals: { files: number; bytes: number };
  warnings: string[];
}

export async function runSyncSnapshot(
  opts: SyncSnapshotOptions = {},
): Promise<SyncSnapshotResult> {
  const { root, config } = await loadDocflowConfig(opts.root);
  const warnings: string[] = [];

  if (!opts.force && (await loadBaseline(root))) {
    throw new Error(
      "Sync baseline already exists — use --force to overwrite or run sync audit first",
    );
  }

  const graphPath = join(root, config.paths.graph);
  if (!(await pathExists(graphPath))) {
    warnings.push("Traceability graph missing — run index before snapshot");
  }
  const graphHash = (await pathExists(graphPath))
    ? await hashGraphFile(graphPath)
    : "0000000000000000";

  const layerFiles = await discoverDesignLayerFiles(root);
  const totals = totalsForLayers(layerFiles);
  const gitRef = await resolveGitRef(root, opts.gitRef ?? "HEAD");

  if (!gitRef) {
    warnings.push(
      "Not a git repo — baseline saved without gitRef; audit will not include content diffs",
    );
  }

  const baseline: SyncBaseline = {
    version: 1,
    createdAt: new Date().toISOString(),
    label: opts.label,
    gitRef,
    gitRefType: gitRef ? "commit" : null,
    graphHash,
    layers: {
      srs: { root: DESIGN_LAYER_ROOTS.srs, files: layerFiles.srs },
      "basic-design": {
        root: DESIGN_LAYER_ROOTS["basic-design"],
        files: layerFiles["basic-design"],
      },
      "detail-design": {
        root: DESIGN_LAYER_ROOTS["detail-design"],
        files: layerFiles["detail-design"],
      },
    },
    totals,
  };

  await saveBaseline(root, baseline);

  return {
    createdAt: baseline.createdAt,
    label: baseline.label,
    gitRef: baseline.gitRef,
    graphHash: baseline.graphHash,
    totals,
    warnings,
  };
}
