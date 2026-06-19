import { join } from "node:path";
import { loadDocflowConfig } from "../config/load.js";
import { DESIGN_LAYERS } from "./constants.js";
import { loadBaseline, hashGraphFile } from "./baseline.js";
import { discoverDesignLayerFiles } from "./discover.js";
import { diffLayerFileMaps } from "./hash-diff.js";
import { gitDiffFromRef } from "./git-diff.js";
import type { DesignLayer, DriftFileEntry, SyncAuditResult } from "./types.js";

export interface SyncAuditOptions {
  root?: string;
  direction?: "downstream" | "upstream" | "both";
  failOnDrift?: boolean;
  verifyGitRef?: boolean;
}

export class SyncAuditError extends Error {
  constructor(
    message: string,
    readonly exitCode: number,
  ) {
    super(message);
  }
}

async function attachGitDiffs(
  root: string,
  gitRef: string | null,
  entries: DriftFileEntry[],
): Promise<void> {
  if (!gitRef) return;
  for (const entry of entries) {
    const { diff, linesAdded, linesRemoved } = await gitDiffFromRef(root, gitRef, entry.path);
    entry.diff = diff;
    entry.diffSource = "git";
    entry.linesAdded = linesAdded;
    entry.linesRemoved = linesRemoved;
  }
}

function defaultDirection(changedPaths: string[]): "downstream" | "both" {
  return changedPaths.some(
    (p) => p.startsWith("docs/basic-design/") || p.startsWith("docs/detail-design/"),
  )
    ? "both"
    : "downstream";
}

export async function runSyncAudit(opts: SyncAuditOptions = {}): Promise<SyncAuditResult> {
  const { root, config } = await loadDocflowConfig(opts.root);
  const baseline = await loadBaseline(root);
  if (!baseline) {
    throw new SyncAuditError("No sync baseline — run: npx ai-spector sync snapshot", 2);
  }

  const warnings: string[] = [];
  const currentLayers = await discoverDesignLayerFiles(root);
  const graphPath = join(root, config.paths.graph);
  const currentGraphHash = await hashGraphFile(graphPath).catch(() => "0000000000000000");
  const graphChanged = currentGraphHash !== baseline.graphHash;

  const byLayer = {} as SyncAuditResult["drift"]["byLayer"];
  const allChangedPaths: string[] = [];

  for (const layer of DESIGN_LAYERS) {
    const diff = diffLayerFileMaps(baseline.layers[layer].files, currentLayers[layer]);
    await attachGitDiffs(root, baseline.gitRef, diff.modified);
    await attachGitDiffs(root, baseline.gitRef, diff.added);
    byLayer[layer] = diff;
    allChangedPaths.push(
      ...diff.modified.map((f) => f.path),
      ...diff.added.map((f) => f.path),
      ...diff.deleted.map((f) => f.path),
    );
  }

  const hasFileDrift = allChangedPaths.length > 0;
  const hasDrift = hasFileDrift || graphChanged;

  const result: SyncAuditResult = {
    baseline: {
      createdAt: baseline.createdAt,
      label: baseline.label,
      gitRef: baseline.gitRef,
      totals: baseline.totals,
    },
    drift: { hasDrift, graphChanged, byLayer },
    traceabilityGaps: { missingDownstream: [], missingUpstream: [], orphanFiles: [] },
    impact: { regenerate: [], syncUpstream: [], review: [] },
    suggestedNext:
      "Review drift and impact buckets; run resolve-task or generate for affected paths; then sync snapshot",
    warnings,
  };

  if (opts.failOnDrift && hasDrift) {
    throw new SyncAuditError("Design layer drift detected", 1);
  }

  return result;
}

export { defaultDirection };
