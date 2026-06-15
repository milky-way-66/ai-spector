import type { ApprovalRecord } from "./types.js";

export type ReviewApproveBlockReason =
  | "already_pending_client"
  | "fully_approved"
  | "client_rejected"
  | "invalid_state"
  | "session_not_ready"
  | "session_content_changed";

export interface ReviewPreconditionPayload {
  error: "PRECONDITION_FAILED";
  reason: ReviewApproveBlockReason;
  message: string;
  hint: string;
  /** Plain-language explanation for the user (shown in chat). */
  userMessage: string;
  suggestedTools: string[];
  logicalPath?: string;
  overallStatus?: string;
  sessionPhase?: string;
}

const DEFAULT_USER_MESSAGES: Record<ReviewApproveBlockReason, (logicalPath?: string) => string> = {
  already_pending_client: (lp) =>
    lp
      ? `${lp} is already signed off internally and is waiting for client approval in the web app.`
      : "This document is already signed off internally and is waiting for client approval in the web app.",
  fully_approved: (lp) =>
    lp
      ? `${lp} is already fully approved. If the content changed, run a review check first.`
      : "This document is already fully approved. If the content changed, run a review check first.",
  client_rejected: (lp) =>
    lp
      ? `The client rejected ${lp}. Update the document from their feedback, then start the review flow again.`
      : "The client rejected this document. Update it from their feedback, then start the review flow again.",
  invalid_state: (lp) =>
    lp
      ? `${lp} is not ready for sign-off yet — I'll check its review status first.`
      : "This document is not ready for sign-off yet — I'll check its review status first.",
  session_not_ready: (lp) =>
    lp
      ? `I need to finish the written review summary for ${lp} before you can approve it.`
      : "I need to finish the written review summary before you can approve this document.",
  session_content_changed: (lp) =>
    lp
      ? `${lp} changed since we loaded it for review. I'll re-read it and update my summary before you can approve.`
      : "The document changed since we loaded it for review. I'll re-read it and update my summary before you can approve.",
};

export function defaultReviewPreconditionUserMessage(
  reason: ReviewApproveBlockReason,
  logicalPath?: string,
): string {
  return DEFAULT_USER_MESSAGES[reason](logicalPath);
}

/** Thrown when `review_approve` / runApprove cannot run in the current approval state. */
export class ReviewPreconditionError extends Error {
  readonly code = "PRECONDITION_FAILED" as const;

  constructor(
    public readonly reason: ReviewApproveBlockReason,
    message: string,
    public readonly hint: string,
    public readonly suggestedTools: string[] = [],
    public readonly logicalPath?: string,
    public readonly overallStatus?: string,
    public readonly sessionPhase?: string,
    userMessage?: string,
  ) {
    super(message);
    this.name = "ReviewPreconditionError";
    this.userMessage =
      userMessage ?? defaultReviewPreconditionUserMessage(reason, logicalPath);
  }

  readonly userMessage: string;

  toPayload(): ReviewPreconditionPayload {
    return {
      error: this.code,
      reason: this.reason,
      message: this.message,
      hint: this.hint,
      userMessage: this.userMessage,
      suggestedTools: this.suggestedTools,
      ...(this.logicalPath ? { logicalPath: this.logicalPath } : {}),
      ...(this.overallStatus ? { overallStatus: this.overallStatus } : {}),
      ...(this.sessionPhase ? { sessionPhase: this.sessionPhase } : {}),
    };
  }
}

export function canInternalApprove(approval: ApprovalRecord): boolean {
  return (
    approval.internal.status === "pending" ||
    approval.internal.status === "needs_review"
  );
}

export function canInternalClose(approval: ApprovalRecord): boolean {
  return canInternalApprove(approval);
}

export function assertCanInternalClose(
  approval: ApprovalRecord,
  logicalPath: string,
): void {
  if (canInternalClose(approval)) {
    return;
  }

  const { overallStatus } = approval;
  const notThese = ["spec_approve", "task_approve_plan", "comments_resolve"];

  throw new ReviewPreconditionError(
    "invalid_state",
    `Cannot close internal review for ${logicalPath}: track is "${approval.internal.status}".`,
    "Close review is only available while internal review is pending or needs re-review.",
    ["review_status", "review_queue", ...notThese],
    logicalPath,
    overallStatus,
  );
}

export function assertCanInternalApprove(
  approval: ApprovalRecord,
  logicalPath: string,
): void {
  if (canInternalApprove(approval)) {
    return;
  }

  const { overallStatus } = approval;
  const notThese = ["spec_approve", "task_approve_plan", "comments_resolve"];

  if (overallStatus === "pending_client") {
    throw new ReviewPreconditionError(
      "already_pending_client",
      `Cannot sign off ${logicalPath}: already internally approved — awaiting client review.`,
      "Document is in the client queue. Confirm with review_status. Client sign-off happens in the web app, not review_approve.",
      ["review_status", "review_queue", ...notThese],
      logicalPath,
      overallStatus,
    );
  }

  if (overallStatus === "approved") {
    throw new ReviewPreconditionError(
      "fully_approved",
      `Cannot sign off ${logicalPath}: document is fully approved on both tracks.`,
      "No internal sign-off needed. If content changed, run review_begin or review_check first to invalidate stale approval.",
      ["review_begin", "review_check", "review_status", ...notThese],
      logicalPath,
      overallStatus,
    );
  }

  if (overallStatus === "rejected") {
    throw new ReviewPreconditionError(
      "client_rejected",
      `Cannot sign off ${logicalPath}: client rejected this document.`,
      "Fix the document per client feedback, run review_begin, complete the review runbook, then call review_approve.",
      ["review_begin", "review_status", "review_queue", ...notThese],
      logicalPath,
      overallStatus,
    );
  }

  throw new ReviewPreconditionError(
    "invalid_state",
    `Cannot sign off ${logicalPath}: document is in state "${overallStatus}" (internal: ${approval.internal.status}).`,
    "Run review_begin to refresh the queue, then follow the ai-spector-review runbook before review_approve.",
    ["review_begin", "review_status", "review_queue", ...notThese],
    logicalPath,
    overallStatus,
  );
}
