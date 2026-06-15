import type {
  ReviewApproveResult,
  ReviewStatusResult,
  ReviewQueueResult,
  ReviewCheckResult,
  ReviewBeginResult,
  ReviewRejectResult,
  ReviewListResult,
  ReviewMigrateResult,
  ReviewSessionStartResult,
  ReviewSessionAckReviewResult,
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
  lines.push(`Vote recorded (approve): ${result.logicalPath}`);
  lines.push(`  by: ${result.approvedByUsername} <${result.approvedBy}> (${result.approvedByRole})`);
  lines.push(`  hash: ${result.contentHash}`);
  lines.push(
    `  quorum: ${result.quorum.approveCount}/${result.quorum.required} approvals (${result.quorum.voterCount} voter(s))`,
  );
  if (result.note) lines.push(`  note: ${result.note}`);
  if (result.quorumMet && result.movedToClientQueue) lines.push("  internal quorum met — moved to client review queue");
  else if (!result.quorumMet) lines.push("  awaiting more internal approvals");
  if (result.openThreadWarning) lines.push(`  warning: ${result.openThreadWarning}`);
  return lines.join("\n");
}

export function formatDeclineResult(result: import("@/core/operations/review.js").ReviewDeclineResult): string {
  const lines: string[] = [];
  lines.push(`Vote recorded (decline): ${result.logicalPath}`);
  lines.push(`  by: ${result.declinedByUsername} <${result.declinedBy}> (${result.declinedByRole})`);
  lines.push(
    `  quorum: ${result.quorum.approveCount}/${result.quorum.required} approvals (${result.quorum.voterCount} voter(s))`,
  );
  if (result.note) lines.push(`  note: ${result.note}`);
  if (result.quorumMet) lines.push("  internal quorum met — moved to client review queue");
  else lines.push("  track still pending");
  return lines.join("\n");
}

export function formatCloseResult(result: import("@/core/operations/review.js").ReviewCloseResult): string {
  return (
    `Closed internal review: ${result.logicalPath}\n` +
    `  by: ${result.closedByUsername} <${result.closedBy}>\n` +
    `  reason: ${result.reason}\n` +
    `  quorum at close: ${result.quorum.approveCount}/${result.quorum.required} (${result.quorum.voterCount} voter(s))`
  );
}

export function formatReviewStatus(result: ReviewStatusResult): string {
  const { approval, diff, history, stale, approvedContentHash } = result;
  const lines: string[] = [];
  lines.push(`${approval.logicalPath}`);
  if (stale) {
    lines.push(`  ⚠ content changed since last approval (hash ${approvedContentHash} → ${approval.contentHash})`);
  }
  lines.push(`  overall:  ${approval.overallStatus}`);
  const iQuorum = result.internalQuorum;
  lines.push(
    approval.internal.status === "approved"
      ? `  internal: approved (quorum ${iQuorum.approveCount}/${iQuorum.required}, ${iQuorum.voterCount} voter(s))`
      : `  internal: ${approval.internal.status}${approval.internal.invalidatedAt ? ` (invalidated ${approval.internal.invalidatedAt.slice(0, 10)})` : ""} — quorum ${iQuorum.approveCount}/${iQuorum.required} (${iQuorum.voterCount} voter(s))`,
  );
  const cQuorum = result.clientQuorum;
  lines.push(
    approval.client.status === "approved"
      ? `  client:   approved (quorum ${cQuorum.approveCount}/${cQuorum.required})`
      : `  client:   ${approval.client.status} — quorum ${cQuorum.approveCount}/${cQuorum.required} (${cQuorum.voterCount} voter(s))`,
  );
  if (approval.internal.votes.length > 0) {
    lines.push("  internal votes:");
    for (const v of approval.internal.votes) {
      lines.push(`    ${v.decision} — ${v.username ?? v.by} <${v.by}>`);
    }
  }
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
      if (h.by) parts.push(`by ${h.username ?? "unknown"} <${h.by}>`);
      if (h.role) parts.push(`role ${h.role}`);
      if (h.hash) parts.push(`hash ${h.hash}`);
      if (h.note) parts.push(`note "${h.note}"`);
      if (h.reason) parts.push(`reason "${h.reason}"`);
      lines.push(`  ${parts.join(" ")}`);
    }
  }
  if (result.session) {
    lines.push("");
    lines.push(
      `Session: phase ${result.session.phase}` +
        (result.session.activeLogicalPath ? ` → ${result.session.activeLogicalPath}` : ""),
    );
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
  lines.push(
    `Discovered ${result.discovered} document(s) on disk — ${result.queued} newly queued for first review`,
  );
  if (result.updated > 0) lines.push(`  ${result.updated} pending doc(s) updated from disk`);
  lines.push(`Scanned ${result.scanned} existing approval(s)`);
  if (result.invalidated > 0) lines.push(`  ${result.invalidated} invalidated (content changed)`);
  if (result.alreadyPending > 0) lines.push(`  ${result.alreadyPending} already pending`);
  if (result.alreadyQueued > 0) lines.push(`  ${result.alreadyQueued} already queued`);
  if (result.errors.length > 0) {
    lines.push(`  ${result.errors.length} error(s):`);
    for (const e of result.errors) lines.push(`    ${e.logicalPath}: ${e.error}`);
  }
  if (
    result.discovered === 0 &&
    result.invalidated === 0 &&
    result.queued === 0 &&
    result.errors.length === 0
  ) {
    lines.push("  no reviewable documents on disk — generate or add docs first");
  } else if (result.invalidated === 0 && result.errors.length === 0 && result.queued === 0) {
    lines.push("  all known documents are up to date");
  }
  return lines.join("\n");
}

export function formatReviewBegin(result: ReviewBeginResult): string {
  if ("approval" in result) {
    const lines = [formatReviewStatus(result)];
    lines.push("");
    lines.push(
      `Discovery: ${result.discovery.discovered} on disk, ${result.discovery.queued} newly queued` +
        (result.discovery.updated > 0 ? `, ${result.discovery.updated} pending updated` : ""),
    );
    if (result.reviewKind) {
      lines.push(`Review kind: ${result.reviewKind} (template: ${result.reviewTemplate ?? result.reviewKind})`);
    }
    return lines.join("\n");
  }

  const lines: string[] = [];
  lines.push(
    `Discovered ${result.discovery.discovered} document(s) — ${result.queue.internal.pending.length} pending internal review`,
  );
  if (result.workflowGuidance?.message) {
    lines.push(result.workflowGuidance.message);
  }
  lines.push("");
  lines.push(formatReviewQueue(result.queue));
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

export function formatReviewSessionStart(result: ReviewSessionStartResult): string {
  return `${result.message}\n  phase: ${result.session.phase}`;
}

export function formatReviewSessionAckReview(result: ReviewSessionAckReviewResult): string {
  return (
    `Review acknowledged: ${result.logicalPath}\n` +
    `  session phase: ${result.session.phase}\n` +
    `  review_approve unlocked: ${result.canReviewApprove ? "yes" : "no"}`
  );
}
