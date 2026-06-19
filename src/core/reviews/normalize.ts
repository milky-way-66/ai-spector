import type { ApprovalRecord, ClientTrack, InternalTrack, ReviewVote, TrackStatus } from "./types.js";
import { emptyClientTrack, emptyInternalTrack } from "./votes.js";

/** Legacy v1/v2 internal track before multi-voter schema. */
interface LegacyInternalFields {
  approvedAt?: string | null;
  approvedBy?: string | null;
  note?: string | null;
}

/** Legacy v1/v2 client track before multi-voter schema. */
interface LegacyClientFields {
  approvedAt?: string | null;
  comment?: string | null;
}

type RawInternalTrack = Partial<InternalTrack> & LegacyInternalFields;
type RawClientTrack = Partial<ClientTrack> & LegacyClientFields;

function legacyApproveVote(
  by: string,
  at: string,
  role: "user" | "client",
  note?: string | null,
): ReviewVote {
  return {
    by,
    role,
    decision: "approve",
    at,
    ...(note ? { note } : {}),
  };
}

export function normalizeInternalTrack(raw: RawInternalTrack): InternalTrack {
  const votes: ReviewVote[] = Array.isArray(raw.votes) ? raw.votes.map((v) => ({ ...v })) : [];

  if (raw.approvedBy && raw.status === "approved") {
    const at = raw.approvedAt ?? raw.quorumMetAt ?? votes[0]?.at ?? new Date().toISOString();
    if (!votes.some((v) => v.by === raw.approvedBy)) {
      votes.push(legacyApproveVote(raw.approvedBy, at, "user", raw.note));
    }
  }

  const quorumMetAt =
    raw.quorumMetAt ?? (raw.status === "approved" ? (raw.approvedAt ?? votes[0]?.at ?? null) : null);

  const closedAt =
    raw.closedAt ??
    (raw.status === "approved" ? (quorumMetAt ?? raw.approvedAt ?? null) : null);

  const lastApprove = [...votes].reverse().find((v) => v.decision === "approve");
  const closedBy =
    raw.closedBy ??
    (raw.status === "approved" ? (raw.approvedBy ?? lastApprove?.by ?? null) : null);

  return {
    status: (raw.status as TrackStatus | undefined) ?? emptyInternalTrack().status,
    votes,
    quorumMetAt,
    closedAt,
    closedBy,
    closeReason: raw.closeReason ?? null,
    invalidatedAt: raw.invalidatedAt ?? null,
    reopenedAt: raw.reopenedAt ?? null,
  };
}

export function normalizeClientTrack(raw: RawClientTrack): ClientTrack {
  const votes: ReviewVote[] = Array.isArray(raw.votes) ? raw.votes.map((v) => ({ ...v })) : [];

  if (raw.approvedAt && raw.status === "approved") {
    const by = votes[0]?.by ?? "unknown";
    if (votes.length === 0) {
      votes.push(legacyApproveVote(by, raw.approvedAt, "client", raw.comment));
    }
  }

  const quorumMetAt =
    raw.quorumMetAt ?? (raw.status === "approved" ? (raw.approvedAt ?? votes[0]?.at ?? null) : null);

  const closedAt =
    raw.closedAt ??
    (raw.status === "approved" ? (quorumMetAt ?? raw.approvedAt ?? null) : null);

  const lastApprove = [...votes].reverse().find((v) => v.decision === "approve");
  const closedBy =
    raw.closedBy ?? (raw.status === "approved" ? (lastApprove?.by ?? null) : null);

  return {
    status: raw.status ?? emptyClientTrack().status,
    votes,
    quorumMetAt,
    closedAt,
    closedBy,
    closeReason: raw.closeReason ?? raw.comment ?? null,
    reopenedAt: raw.reopenedAt ?? null,
  };
}

export function normalizeApprovalRecord(raw: ApprovalRecord & {
  internal?: RawInternalTrack;
  client?: RawClientTrack;
}): ApprovalRecord {
  return {
    version: 3,
    logicalPath: raw.logicalPath,
    docPath: raw.docPath,
    contentHash: raw.contentHash,
    overallStatus: raw.overallStatus,
    internal: normalizeInternalTrack(raw.internal ?? {}),
    client: normalizeClientTrack(raw.client ?? {}),
    snapshotRef: raw.snapshotRef,
    baselineAnchor: raw.baselineAnchor,
    lastEventAt: raw.lastEventAt,
  };
}

/** True when registry entry still uses legacy approvedBy / approvedAt fields. */
export function approvalNeedsNormalization(raw: {
  internal?: RawInternalTrack;
  client?: RawClientTrack;
}): boolean {
  const internal = raw.internal;
  if (internal && ("approvedBy" in internal || "approvedAt" in internal)) return true;
  const client = raw.client;
  if (client && ("approvedAt" in client || "comment" in client) && !Array.isArray(client.votes)) {
    return true;
  }
  return false;
}
