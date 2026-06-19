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

export async function toolReviewDecline(input: z.infer<typeof ReviewDeclineSchema>) {
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
  const enrich = input.enrich ?? input.showDiff !== false;
  return runReviewQueue({
    root: input.root,
    track: input.track,
    showDiff: input.showDiff,
    enrich,
  });
}

export async function toolReviewCheck(input: z.infer<typeof ReviewCheckSchema>) {
  return runReviewCheck({ root: input.root });
}

export async function toolReviewBegin(input: z.infer<typeof ReviewBeginSchema>) {
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
  return runReviewList({ root: input.root, status: input.status, prefix: input.prefix });
}

export async function toolReviewSessionStart(input: z.infer<typeof ReviewSessionStartSchema>) {
  return runReviewSessionStart({ root: input.root });
}

export async function toolReviewSessionAckReview(
  input: z.infer<typeof ReviewSessionAckReviewSchema>,
) {
  return runReviewSessionAckReview({ root: input.root, logicalPath: input.logicalPath });
}

export async function toolReviewWithdraw(input: z.infer<typeof ReviewWithdrawSchema>) {
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
  return runReviewConfig({ root: input.root });
}
