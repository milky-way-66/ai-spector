import { randomUUID } from "node:crypto";

/** Compact UTC timestamp for folder/file names (`20260530T143022Z`). */
export function compactIsoTimestamp(date: Date = new Date()): string {
  const iso = date.toISOString();
  return iso.replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}

/** Return `{iso8601_compact}_{uuid}` thread or comment id. */
export function generateTimestampUuid(now: Date = new Date()): string {
  return `${compactIsoTimestamp(now)}_${randomUUID()}`;
}

/** Root comment id — first non-deleted comment with null parent. */
export function threadRootCommentId(comments: Array<{ commentId: string; parentCommentId: string | null; deletedAt: string | null }>): string | null {
  for (const comment of comments) {
    if (comment.deletedAt) {
      continue;
    }
    if (comment.parentCommentId == null) {
      return comment.commentId;
    }
  }
  return null;
}
