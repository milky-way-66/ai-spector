import type { QuorumSummary, ReviewVote } from "./types.js";

export function requiredApprovals(voterCount: number): number {
  if (voterCount <= 0) return 0;
  return Math.ceil((2 / 3) * voterCount);
}

export function computeQuorum(votes: ReviewVote[]): QuorumSummary {
  const voterCount = votes.length;
  const approveCount = votes.filter((v) => v.decision === "approve").length;
  const declineCount = voterCount - approveCount;
  const required = requiredApprovals(voterCount);
  return {
    voterCount,
    approveCount,
    declineCount,
    required,
    met: voterCount > 0 && approveCount >= required,
  };
}
