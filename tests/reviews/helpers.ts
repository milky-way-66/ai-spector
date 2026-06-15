import type { ClientTrack, InternalTrack } from "@/core/reviews/types.js";

export function internalApprovedTrack(by: string, at: string, note?: string): InternalTrack {
  return {
    status: "approved",
    votes: [
      {
        by,
        username: by,
        role: "user",
        decision: "approve",
        at,
        ...(note ? { note } : {}),
      },
    ],
    quorumMetAt: at,
    closedAt: null,
    closedBy: null,
    invalidatedAt: null,
  };
}

export function clientApprovedTrack(by: string, at: string): ClientTrack {
  return {
    status: "approved",
    votes: [
      {
        by,
        username: by,
        role: "client",
        decision: "approve",
        at,
      },
    ],
    quorumMetAt: at,
    closedAt: null,
    closedBy: null,
  };
}
