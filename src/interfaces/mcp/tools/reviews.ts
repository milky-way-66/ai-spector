import type { z } from "zod";
import type {
  ReviewApproveSchema,
  ReviewStatusSchema,
  ReviewQueueSchema,
  ReviewCheckSchema,
  ReviewRejectSchema,
  ReviewListSchema,
} from "../schemas.js";
import {
  runApprove,
  runReviewStatus,
  runReviewQueue,
  runReviewCheck,
  runReviewReject,
  runReviewList,
} from "@/core/operations/review.js";

export async function toolReviewApprove(input: z.infer<typeof ReviewApproveSchema>) {
  return runApprove({ root: input.root, logicalPath: input.logicalPath, by: input.by });
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
  return runReviewQueue({ root: input.root, track: input.track, showDiff: input.showDiff });
}

export async function toolReviewCheck(input: z.infer<typeof ReviewCheckSchema>) {
  return runReviewCheck({ root: input.root });
}

export async function toolReviewReject(input: z.infer<typeof ReviewRejectSchema>) {
  return runReviewReject({ root: input.root, logicalPath: input.logicalPath, reason: input.reason });
}

export async function toolReviewList(input: z.infer<typeof ReviewListSchema>) {
  return runReviewList({ root: input.root, status: input.status, prefix: input.prefix });
}
