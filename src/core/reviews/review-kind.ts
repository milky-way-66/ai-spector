import type { ApprovalRecord } from "./types.js";

export type ReviewKind = "first" | "re_review" | "client_signoff";
export type ReviewTemplate = "first" | "re_review" | "client_signoff";

/** Classify review context for agent templates and workflow guidance. */
export function deriveReviewKind(approval: ApprovalRecord): ReviewKind {
  if (approval.overallStatus === "pending_client") {
    return "client_signoff";
  }
  if (
    approval.internal.status === "needs_review" ||
    approval.internal.invalidatedAt != null ||
    approval.snapshotRef != null
  ) {
    return "re_review";
  }
  if (approval.overallStatus === "pending_internal" && approval.internal.status === "pending") {
    return "first";
  }
  if (approval.overallStatus === "approved") {
    return "re_review";
  }
  return "re_review";
}

export function reviewTemplateForKind(kind: ReviewKind): ReviewTemplate {
  return kind;
}
