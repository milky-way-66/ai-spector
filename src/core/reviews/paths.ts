import { join } from "node:path";
import { DEFAULT_DOCOPS_PATHS, LEGACY_DOCOPS_PATHS } from "../docops/paths.js";

const LEGACY_REVIEWS_ROOT = "reviews";

/** Convert a logical path like "srs/01-overview" to a safe filename segment "srs__01-overview". */
export function safeFileName(logicalPath: string): string {
  return logicalPath.replace(/\//g, "__");
}

/** @deprecated Use reviewQueuePaths().dir */
export function reviewsRoot(): string {
  return LEGACY_REVIEWS_ROOT;
}

export interface ReviewQueuePaths {
  dir: string;
  fingerprints: string;
  registry: string;
  pending: string;
  history: string;
  snapshots: string;
  changes: string;
  session: string;
  internalResolved: string;
  internalRejected: string;
  internalFailed: string;
  clientResolved: string;
  clientRejected: string;
}

function buildReviewQueuePaths(dir: string): ReviewQueuePaths {
  const normalized = dir.replace(/\\/g, "/");
  return {
    dir: normalized,
    fingerprints: join(normalized, "fingerprints.json").replace(/\\/g, "/"),
    registry: join(normalized, "registry.json").replace(/\\/g, "/"),
    pending: join(normalized, "pending.json").replace(/\\/g, "/"),
    history: join(normalized, "history.jsonl").replace(/\\/g, "/"),
    snapshots: join(normalized, "snapshots").replace(/\\/g, "/"),
    changes: join(normalized, "changes").replace(/\\/g, "/"),
    session: join(normalized, ".session.json").replace(/\\/g, "/"),
    internalResolved: join(normalized, "internal-resolved.json").replace(/\\/g, "/"),
    internalRejected: join(normalized, "internal-rejected.json").replace(/\\/g, "/"),
    internalFailed: join(normalized, "internal-failed.json").replace(/\\/g, "/"),
    clientResolved: join(normalized, "client-resolved.json").replace(/\\/g, "/"),
    clientRejected: join(normalized, "client-rejected.json").replace(/\\/g, "/"),
  };
}

export function reviewQueuePathsFromRel(queueRootRel: string, projectRoot: string): ReviewQueuePaths {
  return buildReviewQueuePaths(join(projectRoot, queueRootRel).replace(/\\/g, "/"));
}

/** Primary review queue paths — `.docops/review-queue/` by default. */
export function reviewQueuePaths(projectRoot: string): ReviewQueuePaths {
  return reviewQueuePathsFromRel(DEFAULT_DOCOPS_PATHS.reviewQueue, projectRoot);
}

/** Legacy review queue paths for dual-read/write during migration. */
export function legacyReviewQueuePaths(projectRoot: string): ReviewQueuePaths {
  return reviewQueuePathsFromRel(LEGACY_DOCOPS_PATHS.reviewQueue, projectRoot);
}

export function resolveReviewQueueWriteRoots(): { primary: string } {
  return { primary: DEFAULT_DOCOPS_PATHS.reviewQueue };
}

export function legacyReviewsRoot(projectRoot: string): string {
  return join(projectRoot, LEGACY_REVIEWS_ROOT).replace(/\\/g, "/");
}

export function snapshotFileName(logicalPath: string): string {
  return `${safeFileName(logicalPath)}.md`;
}

export function snapshotPath(paths: ReviewQueuePaths, logicalPath: string): string {
  return join(paths.snapshots, snapshotFileName(logicalPath)).replace(/\\/g, "/");
}

export function changeFileName(logicalPath: string): string {
  return `${safeFileName(logicalPath)}.json`;
}

export function changePath(paths: ReviewQueuePaths, logicalPath: string): string {
  return join(paths.changes, changeFileName(logicalPath)).replace(/\\/g, "/");
}

// Legacy path helpers — used only by migrate.ts
export function legacyApprovalJsonPath(logicalPath: string): string {
  return join(LEGACY_REVIEWS_ROOT, logicalPath, "approval.json").replace(/\\/g, "/");
}

export function legacyApprovalSnapshotPath(logicalPath: string): string {
  return join(LEGACY_REVIEWS_ROOT, logicalPath, "approval_snapshot.md").replace(/\\/g, "/");
}

export function legacyApprovalHistoryPath(logicalPath: string): string {
  return join(LEGACY_REVIEWS_ROOT, logicalPath, "approval_history.jsonl").replace(/\\/g, "/");
}

export function legacyQueuePendingPath(track: "internal" | "client"): string {
  return `${LEGACY_REVIEWS_ROOT}/${track}_queue/pending.json`;
}

export function legacyQueueResolvedPath(track: "internal" | "client"): string {
  return `${LEGACY_REVIEWS_ROOT}/${track}_queue/resolved.json`;
}

export function legacyQueueRejectedPath(track: "internal" | "client"): string {
  return `${LEGACY_REVIEWS_ROOT}/${track}_queue/rejected.json`;
}

export function legacyQueueFailedPath(): string {
  return `${LEGACY_REVIEWS_ROOT}/internal_queue/failed.json`;
}

export function legacyDiffFilePath(track: "internal" | "client", logicalPath: string): string {
  const legacySafe = logicalPath.replace(/\//g, "--");
  return `${LEGACY_REVIEWS_ROOT}/${track}_queue/diffs/${legacySafe}.json`;
}
