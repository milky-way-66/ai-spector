import type { InternalTrack, ClientTrack, ReviewVote } from "./types.js";
import { computeQuorum } from "./quorum.js";

export function emptyInternalTrack(): InternalTrack {
  return {
    status: "pending",
    votes: [],
    quorumMetAt: null,
    closedAt: null,
    closedBy: null,
    invalidatedAt: null,
  };
}

export function emptyClientTrack(): ClientTrack {
  return {
    status: "pending",
    votes: [],
    quorumMetAt: null,
    closedAt: null,
    closedBy: null,
  };
}

export function upsertVote(votes: ReviewVote[], vote: ReviewVote): ReviewVote[] {
  const idx = votes.findIndex((v) => v.by === vote.by);
  if (idx === -1) return [...votes, vote];
  const next = [...votes];
  next[idx] = vote;
  return next;
}

export function trackQuorum(track: InternalTrack | ClientTrack) {
  return computeQuorum(track.votes);
}

export function isTrackOpenForVotes(track: InternalTrack | ClientTrack): boolean {
  return track.status === "pending" || track.status === "needs_review";
}
