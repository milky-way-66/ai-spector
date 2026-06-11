import type {
  ReviewApproveResult,
  ReviewStatusResult,
  ReviewQueueResult,
  ReviewCheckResult,
  ReviewRejectResult,
} from "../../../core/operations/review.js";
import type { DiffFile, QueueEntry } from "../../../core/reviews/types.js";

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
  const { approval, diff } = result;
  const lines: string[] = [];
  lines.push(`${approval.logicalPath}`);
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
