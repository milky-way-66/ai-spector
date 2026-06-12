import type {
  ReviewApproveResult,
  ReviewStatusResult,
  ReviewQueueResult,
  ReviewCheckResult,
  ReviewRejectResult,
  ReviewListResult,
  ReviewMigrateResult,
} from "@/core/operations/review.js";
import type { DiffFile, QueueEntry } from "@/core/reviews/types.js";

function formatDiff(diff: DiffFile): string {
  const lines: string[] = [];
  lines.push(`  +${diff.linesAdded} line(s) / -${diff.linesRemoved} line(s) since last approval`);
  if (diff.diff) {
    for (const line of diff.diff.split("\n").slice(0, 20)) {
      lines.push(`  ${line}`);
    }
    const total = diff.diff.split("\n").filter(Boolean).length;
    if (total > 20) lines.push(`  … (${total - 20} more lines)`);
  }
  return lines.join("\n");
}

function formatQueueEntry(entry: QueueEntry, diff: DiffFile | null | undefined): string {
  const lines: string[] = [];
  lines.push(`${entry.logicalPath}  [${entry.reason}]  queued ${entry.queuedAt.slice(0, 10)}`);
  if (entry.approvedHash) lines.push(`  hash: ${entry.approvedHash} → ${entry.currentHash}`);
  if (diff) lines.push(formatDiff(diff));
  return lines.join("\n");
}

export function formatApproveResult(result: ReviewApproveResult): string {
  const lines: string[] = [];
  lines.push(`Approved: ${result.logicalPath}`);
  lines.push(`  by: ${result.approvedBy}`);
  lines.push(`  hash: ${result.contentHash}`);
  if (result.movedToClientQueue) lines.push("  moved to client review queue");
  if (result.openThreadWarning) lines.push(`  warning: ${result.openThreadWarning}`);
  return lines.join("\n");
}

export function formatReviewStatus(result: ReviewStatusResult): string {
  const { approval, diff, history, stale, approvedContentHash } = result;
  const lines: string[] = [];
  lines.push(`${approval.logicalPath}`);
  if (stale) {
    lines.push(`  ⚠ content changed since last approval (hash ${approvedContentHash} → ${approval.contentHash})`);
  }
  lines.push(`  overall:  ${approval.overallStatus}`);
  lines.push(
    approval.internal.status === "approved"
      ? `  internal: approved by ${approval.internal.approvedBy} on ${approval.internal.approvedAt?.slice(0, 10)}`
      : `  internal: ${approval.internal.status}${approval.internal.invalidatedAt ? ` (invalidated ${approval.internal.invalidatedAt.slice(0, 10)})` : ""}`,
  );
  lines.push(
    approval.client.status === "approved"
      ? `  client:   approved on ${approval.client.approvedAt?.slice(0, 10)}`
      : `  client:   ${approval.client.status}${approval.client.comment ? ` — ${approval.client.comment}` : ""}`,
  );
  if (diff) {
    lines.push("");
    lines.push(formatDiff(diff));
  }
  if (history && history.length > 0) {
    lines.push("");
    lines.push(`History (${history.length} event(s)):`);
    for (const h of history) {
      const parts = [h.at.slice(0, 19), h.event];
      if (h.track) parts.push(`[${h.track}]`);
      if (h.by) parts.push(`by ${h.by}`);
      if (h.hash) parts.push(`hash ${h.hash}`);
      lines.push(`  ${parts.join(" ")}`);
    }
  }
  return lines.join("\n");
}

export function formatReviewQueue(result: ReviewQueueResult): string {
  const lines: string[] = [];

  const iPending = result.internal.pending;
  const cPending = result.client.pending;

  if (iPending.length === 0 && cPending.length === 0) {
    lines.push("No documents pending review.");
  }

  if (iPending.length > 0) {
    lines.push(`Internal queue (${iPending.length} pending):`);
    for (const e of iPending) {
      lines.push(formatQueueEntry(e, result.diffs[e.logicalPath]));
    }
  }

  if (cPending.length > 0) {
    if (iPending.length > 0) lines.push("");
    lines.push(`Client queue (${cPending.length} pending):`);
    for (const e of cPending) {
      lines.push(formatQueueEntry(e, result.diffs[e.logicalPath]));
    }
  }

  const iResolved = result.internal.resolved.length;
  const iRejected = result.internal.rejected.length;
  const iFailed = result.internal.failed.length;
  const cResolved = result.client.resolved.length;
  const cRejected = result.client.rejected.length;

  lines.push("");
  lines.push(
    `Archive — internal: ${iResolved} resolved, ${iRejected} rejected, ${iFailed} failed` +
      ` | client: ${cResolved} resolved, ${cRejected} rejected`,
  );

  return lines.join("\n");
}

export function formatReviewCheck(result: ReviewCheckResult): string {
  const lines: string[] = [];
  if (result.migrated) lines.push("Migrated legacy reviews/ to .ai-spector/.docflow/review-queue/");
  lines.push(`Scanned ${result.scanned} approval(s)`);
  if (result.invalidated > 0) lines.push(`  ${result.invalidated} invalidated (content changed)`);
  if (result.alreadyPending > 0) lines.push(`  ${result.alreadyPending} already pending`);
  if (result.errors.length > 0) {
    lines.push(`  ${result.errors.length} error(s):`);
    for (const e of result.errors) lines.push(`    ${e.logicalPath}: ${e.error}`);
  }
  if (result.invalidated === 0 && result.errors.length === 0) {
    lines.push("  all approved documents are up to date");
  }
  return lines.join("\n");
}

export function formatReviewReject(result: ReviewRejectResult): string {
  return result.message;
}

export function formatReviewList(result: ReviewListResult): string {
  if (result.entries.length === 0) {
    return "No documents with approval records.";
  }
  const lines: string[] = [`${result.total} document(s):`];
  for (const e of result.entries) {
    const staleNote = e.stale ? "  ⚠ changed since review" : "";
    lines.push(`  ${e.logicalPath}  [${e.overallStatus}]  hash ${e.contentHash}${staleNote}`);
  }
  return lines.join("\n");
}

export function formatReviewMigrate(result: ReviewMigrateResult): string {
  return result.message;
}
