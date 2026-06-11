import { join } from "node:path";

const REVIEWS_ROOT = "reviews";

/** Convert a logical path like "srs/01-overview" to a safe filename segment "srs--01-overview". */
export function safeFileName(logicalPath: string): string {
  return logicalPath.replace(/\//g, "--");
}

export function reviewsRoot(): string {
  return REVIEWS_ROOT;
}

export function approvalDir(logicalPath: string): string {
  return join(REVIEWS_ROOT, logicalPath).replace(/\\/g, "/");
}

export function approvalJsonPath(logicalPath: string): string {
  return `${approvalDir(logicalPath)}/approval.json`;
}

export function approvalSnapshotPath(logicalPath: string): string {
  return `${approvalDir(logicalPath)}/approval_snapshot.md`;
}

export function approvalHistoryPath(logicalPath: string): string {
  return `${approvalDir(logicalPath)}/approval_history.jsonl`;
}

export function internalQueueDir(): string {
  return `${REVIEWS_ROOT}/internal_queue`;
}

export function clientQueueDir(): string {
  return `${REVIEWS_ROOT}/client_queue`;
}

export function queuePendingPath(track: "internal" | "client"): string {
  return `${REVIEWS_ROOT}/${track}_queue/pending.json`;
}

export function queueResolvedPath(track: "internal" | "client"): string {
  return `${REVIEWS_ROOT}/${track}_queue/resolved.json`;
}

export function queueRejectedPath(track: "internal" | "client"): string {
  return `${REVIEWS_ROOT}/${track}_queue/rejected.json`;
}

export function queueFailedPath(): string {
  return `${REVIEWS_ROOT}/internal_queue/failed.json`;
}

export function diffFilePath(track: "internal" | "client", logicalPath: string): string {
  return `${REVIEWS_ROOT}/${track}_queue/diffs/${safeFileName(logicalPath)}.json`;
}
