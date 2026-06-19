import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { computeLineDiff } from "../util/diff.js";
import { loadBaseline } from "./baseline.js";
import { DESIGN_LAYERS } from "./constants.js";
import type { DocAnchor, DiffSource, EnrichmentCache, LayerDriftSummary } from "./drift-types.js";
import { discoverDesignLayerFiles } from "./discover.js";
import { gitDiffFromRef } from "./git-diff.js";
import { diffLayerFileMaps } from "./hash-diff.js";

export interface ResolveDiffResult {
  diff: string;
  linesAdded: number;
  linesRemoved: number;
  diffSource: DiffSource;
}

export interface LegacyDiffOptions {
  legacyContent?: string;
  legacySnapshot?: string;
  inlineDiff?: string;
}

async function readCurrentContent(projectRoot: string, relativePath: string): Promise<string> {
  try {
    return await readFile(join(projectRoot, relativePath), "utf8");
  } catch {
    return "";
  }
}

export async function resolveDiffFromAnchor(
  projectRoot: string,
  anchor: DocAnchor,
  legacy?: LegacyDiffOptions,
): Promise<ResolveDiffResult> {
  if (anchor.gitRef) {
    const { diff, linesAdded, linesRemoved } = await gitDiffFromRef(
      projectRoot,
      anchor.gitRef,
      anchor.path,
    );
    return { diff, linesAdded, linesRemoved, diffSource: "git" };
  }

  const currentContent = await readCurrentContent(projectRoot, anchor.path);

  if (legacy?.legacySnapshot !== undefined) {
    const { diff, linesAdded, linesRemoved } = computeLineDiff(legacy.legacySnapshot, currentContent);
    return { diff, linesAdded, linesRemoved, diffSource: "legacy_snapshot" };
  }

  if (legacy?.legacyContent !== undefined) {
    const { diff, linesAdded, linesRemoved } = computeLineDiff(legacy.legacyContent, currentContent);
    return { diff, linesAdded, linesRemoved, diffSource: "legacy_content" };
  }

  if (legacy?.inlineDiff) {
    return {
      diff: legacy.inlineDiff,
      linesAdded: 0,
      linesRemoved: 0,
      diffSource: "legacy_content",
    };
  }

  return { diff: "", linesAdded: 0, linesRemoved: 0, diffSource: "none" };
}

export function invalidateEnrichmentIfStale(
  cache: EnrichmentCache,
  currentHash: string,
): EnrichmentCache | null {
  if (cache.anchorHash !== currentHash) return null;
  return cache;
}

export async function linkLayerDrift(
  projectRoot: string,
  changedPaths: string[],
): Promise<LayerDriftSummary | undefined> {
  const baseline = await loadBaseline(projectRoot);
  if (!baseline) return undefined;

  const currentLayers = await discoverDesignLayerFiles(projectRoot);
  const changedSet = new Set(changedPaths);
  const modified: string[] = [];

  for (const layer of DESIGN_LAYERS) {
    const diff = diffLayerFileMaps(baseline.layers[layer].files, currentLayers[layer]);
    for (const entry of diff.modified) {
      if (changedSet.has(entry.path)) {
        modified.push(entry.path);
      }
    }
  }

  modified.sort((a, b) => a.localeCompare(b));

  return {
    baselineLabel: baseline.label,
    baselineCreatedAt: baseline.createdAt,
    modified,
  };
}
