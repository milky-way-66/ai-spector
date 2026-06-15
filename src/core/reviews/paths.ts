import { join } from "node:path";

const LEGACY_REVIEWS_ROOT = "reviews";
const REVIEW_QUEUE_REL = ".ai-spector/.docflow/review-queue";

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

export function reviewQueuePaths(projectRoot: string): ReviewQueuePaths {
  const dir = join(projectRoot, REVIEW_QUEUE_REL).replace(/\\/g, "/");
  return {
    dir,
    fingerprints: join(dir, "fingerprints.json").replace(/\\/g, "/"),
    registry: join(dir, "registry.json").replace(/\\/g, "/"),
    pending: join(dir, "pending.json").replace(/\\/g, "/"),
    history: join(dir, "history.jsonl").replace(/\\/g, "/"),
    snapshots: join(dir, "snapshots").replace(/\\/g, "/"),
    changes: join(dir, "changes").replace(/\\/g, "/"),
    session: join(dir, ".session.json").replace(/\\/g, "/"),
    internalResolved: join(dir, "internal-resolved.json").replace(/\\/g, "/"),
    internalRejected: join(dir, "internal-rejected.json").replace(/\\/g, "/"),
    internalFailed: join(dir, "internal-failed.json").replace(/\\/g, "/"),
    clientResolved: join(dir, "client-resolved.json").replace(/\\/g, "/"),
    clientRejected: join(dir, "client-rejected.json").replace(/\\/g, "/"),
  };
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
