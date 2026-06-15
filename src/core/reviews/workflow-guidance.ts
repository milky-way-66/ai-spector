import { canInternalApprove } from "./errors.js";
import { trackQuorum } from "./votes.js";
import { reviewTemplateForKind, type ReviewKind } from "./review-kind.js";
import type { ApprovalRecord, ReviewSessionFile } from "./types.js";

export type ReviewWorkflowPhase =
  | "awaiting_internal_review"
  | "awaiting_client"
  | "fully_approved"
  | "client_rejected"
  | "stale_needs_rereview";

export interface ReviewWorkflowGuidance {
  workflowId: "doc-review";
  phase: ReviewWorkflowPhase;
  canReviewApprove: boolean;
  message: string;
  nextTools: string[];
  notTheseTools: string[];
  reviewTemplate?: "first" | "re_review" | "client_signoff";
}

const NOT_APPROVE_SIBLINGS = ["spec_approve", "task_approve_plan", "comments_resolve"] as const;

const READINESS_REVIEW_TOOLS = [
  "readiness_scan",
  "readiness_output_checklist",
] as const;

const INTERNAL_REVIEW_TOOLS = [
  "review_check",
  "review_queue",
  "review_status",
  "graph_impact",
  ...READINESS_REVIEW_TOOLS,
  "review_session_ack_review",
  "review_approve",
] as const;

export function buildReviewWorkflowGuidance(
  approval: ApprovalRecord,
  opts?: { stale?: boolean; session?: ReviewSessionFile | null; reviewKind?: ReviewKind },
): ReviewWorkflowGuidance {
  const stale = opts?.stale === true;
  const session = opts?.session;
  const sessionReady =
    !!session &&
    session.activeLogicalPath === approval.logicalPath &&
    session.phase === "awaiting_decision" &&
    !!session.reviewWrittenAt;

  const reviewTemplate = reviewTemplateForKind(
    opts?.reviewKind ??
      (approval.overallStatus === "pending_client"
        ? "client_signoff"
        : approval.internal.status === "pending" && !approval.snapshotRef
          ? "first"
          : "re_review"),
  );

  const applySessionGate = (guidance: ReviewWorkflowGuidance): ReviewWorkflowGuidance => {
    const withWorker = { ...guidance, workflowId: "doc-review" as const, reviewTemplate };
    if (!canInternalApprove(approval) || guidance.canReviewApprove === false) {
      return withWorker;
    }
    if (sessionReady) {
      return { ...withWorker, canReviewApprove: true };
    }
    const sessionNote = session
      ? ` Session phase "${session.phase}" — call review_session_ack_review after writing the review summary.`
      : " No review session — run review_check/review_status, write review, then review_session_ack_review.";
    return {
      ...withWorker,
      canReviewApprove: false,
      message: `${guidance.message}${sessionNote}`,
      nextTools: guidance.nextTools.includes("review_session_ack_review")
        ? guidance.nextTools
        : [...guidance.nextTools, "review_session_ack_review"],
    };
  };

  const canApprove = canInternalApprove(approval) && !stale && sessionReady;

  if (stale && approval.internal.status === "needs_review") {
    return applySessionGate({
      workflowId: "doc-review",
      phase: "stale_needs_rereview",
      canReviewApprove: canApprove,
      message:
        "Content changed since last sign-off. Run review_check if needed, load diff via review_status, score readiness checklist, write a review summary, review_session_ack_review, then review_approve.",
      nextTools: [
        "review_check",
        "review_status",
        "graph_impact",
        ...READINESS_REVIEW_TOOLS,
        "review_session_ack_review",
        "review_approve",
      ],
      notTheseTools: [...NOT_APPROVE_SIBLINGS],
    });
  }

  if (approval.overallStatus === "pending_internal" || canInternalApprove(approval)) {
    const quorum = trackQuorum(approval.internal);
    const quorumNote =
      quorum.voterCount > 0 && !quorum.met
        ? ` Internal quorum: ${quorum.approveCount}/${quorum.required} approvals (${quorum.voterCount} voter(s)).`
        : "";
    return applySessionGate({
      workflowId: "doc-review",
      phase: "awaiting_internal_review",
      canReviewApprove: canApprove,
      message:
        `Internal sign-off: review_begin → read full doc → readiness checklist → graph_impact → write review → review_session_ack_review → user yes → review_approve (cast vote; 2/3 quorum).${quorumNote}`,
      nextTools: ["review_begin", ...INTERNAL_REVIEW_TOOLS, "review_decline", "review_close"],
      notTheseTools: [...NOT_APPROVE_SIBLINGS],
    });
  }

  if (approval.overallStatus === "pending_client") {
    return {
      workflowId: "doc-review",
      phase: "awaiting_client",
      canReviewApprove: false,
      message:
        "Internally signed off — waiting for client approval in the web app. Use review_status or review_queue (track client).",
      nextTools: ["review_status", "review_queue"],
      notTheseTools: ["review_approve", ...NOT_APPROVE_SIBLINGS],
    };
  }

  if (approval.overallStatus === "approved") {
    return {
      workflowId: "doc-review",
      phase: "fully_approved",
      canReviewApprove: false,
      message: "Fully signed off. If content changes, review_check will invalidate and re-queue for internal review.",
      nextTools: ["review_check", "review_status", "review_list"],
      notTheseTools: ["review_approve", ...NOT_APPROVE_SIBLINGS],
    };
  }

  return {
    workflowId: "doc-review",
    phase: "client_rejected",
    canReviewApprove: false,
    message:
      "Client rejected — revise the document, run review_check, then follow the internal review runbook before review_approve.",
    nextTools: ["review_check", "review_status", "review_queue"],
    notTheseTools: ["review_approve", "spec_approve", "task_approve_plan"],
  };
}
