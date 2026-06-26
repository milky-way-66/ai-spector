import type { z } from "zod";
import type {
  ReviewApproveSchema,
  ReviewDeclineSchema,
  ReviewCloseSchema,
  ReviewStatusSchema,
  ReviewQueueSchema,
  ReviewCheckSchema,
  ReviewBeginSchema,
  ReviewRejectSchema,
  ReviewListSchema,
  ReviewSessionStartSchema,
  ReviewSessionAckReviewSchema,
  ReviewWithdrawSchema,
  ReviewReopenSchema,
  ReviewConfigSchema,
} from "../schemas.js";
import {
  runApprove,
  runDecline,
  runClose,
  runReviewStatus,
  runReviewQueue,
  runReviewCheck,
  runReviewBegin,
  runReviewReject,
  runReviewList,
  runReviewSessionStart,
  runReviewSessionAckReview,
  runWithdraw,
  runReopen,
  runReviewConfig,
} from "@/core/operations/review.js";

function warnDeprecated(oldTool: string, action: string): void {
  process.stderr.write(
    `[ai-spector-mcp] DEPRECATED: "${oldTool}" is deprecated — use contract_review with action="${action}" instead.\n`,
  );
}

export async function toolReviewDecline(input: z.infer<typeof ReviewDeclineSchema>) {
  warnDeprecated("review_decline", "decline");
  return runDecline({
    root: input.root,
    logicalPath: input.logicalPath,
    by: input.by,
    username: input.username,
    role: input.role,
    note: input.note,
  });
}

export async function toolReviewClose(input: z.infer<typeof ReviewCloseSchema>) {
  warnDeprecated("review_close", "close");
  return runClose({
    root: input.root,
    logicalPath: input.logicalPath,
    reason: input.reason,
    by: input.by,
    username: input.username,
    role: input.role,
  });
}

export async function toolReviewApprove(input: z.infer<typeof ReviewApproveSchema>) {
  warnDeprecated("review_approve", "approve");
  return runApprove({
    root: input.root,
    logicalPath: input.logicalPath,
    by: input.by,
    username: input.username,
    role: input.role,
    note: input.note,
  });
}

export async function toolReviewStatus(input: z.infer<typeof ReviewStatusSchema>) {
  warnDeprecated("review_status", "status");
  return runReviewStatus({
    root: input.root,
    logicalPath: input.logicalPath,
    showDiff: input.showDiff,
    includeHistory: input.includeHistory,
    historyLimit: input.historyLimit,
    historySince: input.historySince,
  });
}

export async function toolReviewQueue(input: z.infer<typeof ReviewQueueSchema>) {
  warnDeprecated("review_queue", "queue");
  const enrich = input.enrich ?? input.showDiff !== false;
  return runReviewQueue({
    root: input.root,
    track: input.track,
    showDiff: input.showDiff,
    enrich,
  });
}

export async function toolReviewCheck(input: z.infer<typeof ReviewCheckSchema>) {
  warnDeprecated("review_check", "check");
  return runReviewCheck({ root: input.root });
}

export async function toolReviewBegin(input: z.infer<typeof ReviewBeginSchema>) {
  warnDeprecated("review_begin", "begin");
  return runReviewBegin({
    root: input.root,
    logicalPath: input.logicalPath,
    showDiff: input.showDiff,
    includeHistory: input.includeHistory,
    historyLimit: input.historyLimit,
    historySince: input.historySince,
  });
}

export async function toolReviewReject(input: z.infer<typeof ReviewRejectSchema>) {
  warnDeprecated("review_reject", "reject");
  return runReviewReject({
    root: input.root,
    logicalPath: input.logicalPath,
    reason: input.reason,
    by: input.by,
    username: input.username,
    role: input.role,
  });
}

export async function toolReviewList(input: z.infer<typeof ReviewListSchema>) {
  warnDeprecated("review_list", "list");
  return runReviewList({ root: input.root, status: input.status, prefix: input.prefix });
}

export async function toolReviewSessionStart(input: z.infer<typeof ReviewSessionStartSchema>) {
  warnDeprecated("review_session_start", "session_start");
  return runReviewSessionStart({ root: input.root });
}

export async function toolReviewSessionAckReview(
  input: z.infer<typeof ReviewSessionAckReviewSchema>,
) {
  warnDeprecated("review_session_ack_review", "session_ack");
  return runReviewSessionAckReview({ root: input.root, logicalPath: input.logicalPath });
}

export async function toolReviewWithdraw(input: z.infer<typeof ReviewWithdrawSchema>) {
  warnDeprecated("review_withdraw", "withdraw");
  return runWithdraw({
    root: input.root,
    logicalPath: input.logicalPath,
    track: input.track,
    by: input.by,
    username: input.username,
    role: input.role,
  });
}

export async function toolReviewReopen(input: z.infer<typeof ReviewReopenSchema>) {
  warnDeprecated("review_reopen", "reopen");
  return runReopen({
    root: input.root,
    logicalPath: input.logicalPath,
    track: input.track,
    by: input.by,
    username: input.username,
    role: input.role,
  });
}

export async function toolReviewConfig(input: z.infer<typeof ReviewConfigSchema>) {
  warnDeprecated("review_config", "config");
  return runReviewConfig({ root: input.root });
}
