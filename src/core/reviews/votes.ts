import type { InternalTrack, ClientTrack, ReviewVote, QuorumSummary } from "./types.js";
import { computeQuorum } from "./quorum.js";

export function emptyInternalTrack(): InternalTrack {
  return {
    status: "pending",
    votes: [],
    quorumMetAt: null,
    closedAt: null,
    closedBy: null,
    invalidatedAt: null,
    reopenedAt: null,
  };
}

export function emptyClientTrack(): ClientTrack {
  return {
    status: "pending",
    votes: [],
    quorumMetAt: null,
    closedAt: null,
    closedBy: null,
    reopenedAt: null,
  };
}

export function upsertVote(votes: ReviewVote[], vote: ReviewVote): ReviewVote[] {
  const idx = votes.findIndex((v) => v.by === vote.by);
  if (idx === -1) return [...votes, vote];
  const next = [...votes];
  next[idx] = vote;
  return next;
}

export function removeVote(votes: ReviewVote[], by: string): ReviewVote[] {
  return votes.filter((v) => v.by !== by);
}

export function trackQuorum(track: InternalTrack | ClientTrack, minApprovals: number) {
  return computeQuorum(track.votes, minApprovals);
}

export function isTrackOpenForVotes(track: InternalTrack | ClientTrack): boolean {
  return track.status === "pending" || track.status === "needs_review";
}

export function isTrackClosed(track: InternalTrack | ClientTrack): boolean {
  return track.status === "approved" || track.status === "rejected";
}

/** After reopen, auto-close only when quorum is met and the action occurs after reopenedAt. */
export function shouldAutoCloseTrack(
  track: InternalTrack | ClientTrack,
  quorum: QuorumSummary,
  actionAt: string,
): boolean {
  if (!quorum.met) return false;
  if (!track.reopenedAt) return true;
  return actionAt > track.reopenedAt;
}
