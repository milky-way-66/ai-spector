import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type { TranslationJob } from "../lang/queue-types.js";
import { loadFingerprints, queuePaths } from "../lang/queue-store.js";
import { readSnapshot } from "../reviews/storage.js";
import type { ApprovalRecord, ReviewJob } from "../reviews/types.js";
import { resolveReviewDocPath } from "../reviews/doc-resolve.js";
import { computeLineDiff } from "../util/diff.js";
import { loadBaseline } from "./baseline.js";
import { DESIGN_LAYERS } from "./constants.js";
import type { DocAnchor, DiffSource, EnrichmentCache, LayerDriftSummary } from "./drift-types.js";
import { discoverDesignLayerFiles } from "./discover.js";
import { gitDiffFromRef, resolveGitRefForPath } from "./git-diff.js";
import { diffLayerFileMaps } from "./hash-diff.js";
import { computeAuditImpact } from "./impact.js";

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

function countInlineDiffLines(inlineDiff: string): { linesAdded: number; linesRemoved: number } {
  let linesAdded = 0;
  let linesRemoved = 0;
  for (const line of inlineDiff.split("\n")) {
    if (/^\{\d+\} \+/.test(line)) linesAdded++;
    else if (/^\{\d+\} -/.test(line)) linesRemoved++;
  }
  return { linesAdded, linesRemoved };
}

function hasGitDiff(diff: string, linesAdded: number, linesRemoved: number): boolean {
  return diff.trim().length > 0 || linesAdded > 0 || linesRemoved > 0;
}

async function resolveLegacyDiff(
  projectRoot: string,
  anchor: DocAnchor,
  legacy?: LegacyDiffOptions,
): Promise<ResolveDiffResult> {
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
    const { linesAdded, linesRemoved } = countInlineDiffLines(legacy.inlineDiff);
    return {
      diff: legacy.inlineDiff,
      linesAdded,
      linesRemoved,
      diffSource: "legacy_content",
    };
  }

  return { diff: "", linesAdded: 0, linesRemoved: 0, diffSource: "none" };
}

export async function resolveDiffFromAnchor(
  projectRoot: string,
  anchor: DocAnchor,
  legacy?: LegacyDiffOptions,
): Promise<ResolveDiffResult> {
  const gitRef = anchor.gitRef ?? (await resolveGitRefForPath(projectRoot, anchor.path));

  if (gitRef) {
    const { diff, linesAdded, linesRemoved } = await gitDiffFromRef(projectRoot, gitRef, anchor.path);
    if (hasGitDiff(diff, linesAdded, linesRemoved)) {
      return { diff, linesAdded, linesRemoved, diffSource: "git" };
    }
  }

  return resolveLegacyDiff(projectRoot, anchor, legacy);
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

export async function loadLegacyFingerprintContent(
  projectRoot: string,
  originPath: string,
): Promise<LegacyDiffOptions | undefined> {
  const paths = queuePaths(projectRoot);
  const fp = await loadFingerprints(paths.fingerprints);
  const content = fp.files[originPath]?.content;
  if (content === undefined) {
    return undefined;
  }
  return { legacyContent: content };
}

export async function enrichTranslationJob(
  projectRoot: string,
  job: TranslationJob,
  opts: { graphPath: string; rulesPath: string; persist?: boolean },
): Promise<EnrichmentCache> {
  const originPath = job.origin.path;
  const currentHash = job.origin.hash;

  if (job.enrichment) {
    const valid = invalidateEnrichmentIfStale(job.enrichment, currentHash);
    if (valid) {
      return valid;
    }
  }

  const latestChange = job.changes[job.changes.length - 1];
  const anchor = latestChange?.anchor ?? {
    path: originPath,
    hash: latestChange?.previousHash ?? "",
    gitRef: null,
    anchoredAt: latestChange?.changedAt ?? "",
  };

  const legacy = latestChange?.diff
    ? { legacyContent: undefined, inlineDiff: latestChange.diff }
    : await loadLegacyFingerprintContent(projectRoot, originPath);

  const diffResult = await resolveDiffFromAnchor(projectRoot, anchor, legacy);

  const changedPaths = [originPath];
  const impactRaw = await computeAuditImpact({
    graphPath: opts.graphPath,
    rulesPath: opts.rulesPath,
    changedPaths,
    direction: "both",
  });

  const enrichment: EnrichmentCache = {
    ...diffResult,
    impact: {
      intraDocTargets: job.targets.filter((t) => t.status === "pending").map((t) => t.path),
      regenerate: impactRaw.regenerate,
      syncUpstream: impactRaw.syncUpstream ?? [],
      review: impactRaw.review,
    },
    layerDrift: await linkLayerDrift(projectRoot, changedPaths),
    computedAt: new Date().toISOString(),
    anchorHash: currentHash,
  };

  return enrichment;
}

export async function enrichReviewJob(
  projectRoot: string,
  logicalPath: string,
  opts: {
    approval: ApprovalRecord;
    job?: ReviewJob | null;
    graphPath: string;
    rulesPath: string;
  },
): Promise<EnrichmentCache> {
  const { approval, job } = opts;
  const currentHash = job?.currentHash ?? approval.contentHash;

  if (job?.enrichment) {
    const valid = invalidateEnrichmentIfStale(job.enrichment, currentHash);
    if (valid) {
      return valid;
    }
  }

  let docPath = approval.docPath;
  if (!docPath) {
    ({ docPath } = await resolveReviewDocPath(projectRoot, logicalPath));
  }

  const baselineAnchor =
    job?.baselineAnchor ??
    approval.baselineAnchor ?? {
      path: docPath,
      hash: job?.baselineHash ?? approval.contentHash,
      gitRef: null,
      anchoredAt: approval.lastEventAt ?? "",
    };

  const legacySnapshot = approval.snapshotRef
    ? await readSnapshot(projectRoot, logicalPath)
    : null;
  const legacy =
    legacySnapshot != null
      ? { legacySnapshot }
      : undefined;

  const diffResult = await resolveDiffFromAnchor(projectRoot, baselineAnchor, legacy);

  const changedPaths = [docPath];
  const impactRaw = await computeAuditImpact({
    graphPath: opts.graphPath,
    rulesPath: opts.rulesPath,
    changedPaths,
    direction: "downstream",
  });

  const enrichment: EnrichmentCache = {
    ...diffResult,
    impact: {
      regenerate: impactRaw.regenerate,
      syncUpstream: impactRaw.syncUpstream ?? [],
      review: impactRaw.review,
    },
    layerDrift: await linkLayerDrift(projectRoot, changedPaths),
    computedAt: new Date().toISOString(),
    anchorHash: currentHash,
  };

  return enrichment;
}
