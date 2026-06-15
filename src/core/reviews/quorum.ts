import type { QuorumSummary, ReviewVote } from "./types.js";

/** @deprecated Use configurable minApprovals from review-queue.json instead. */
export function requiredApprovals(voterCount: number): number {
  if (voterCount <= 0) return 0;
  return Math.ceil((2 / 3) * voterCount);
}

export function computeQuorum(votes: ReviewVote[], minApprovals: number): QuorumSummary {
  const voterCount = votes.length;
  const approveCount = votes.filter((v) => v.decision === "approve").length;
  const declineCount = voterCount - approveCount;
  const required = minApprovals;
  return {
    voterCount,
    approveCount,
    declineCount,
    required,
    met: approveCount >= required,
  };
}
