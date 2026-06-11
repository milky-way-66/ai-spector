export type OverallStatus = "pending_internal" | "pending_client" | "approved" | "rejected";
export type TrackStatus = "pending" | "approved" | "needs_review";
export type ClientStatus = "pending" | "approved" | "rejected";
export type QueueReason = "content_changed" | "client_rejected";
export type HistoryEvent = "approved" | "invalidated" | "rejected";
export type ReviewTrack = "internal" | "client";

export interface InternalTrack {
  status: TrackStatus;
  approvedAt: string | null;
  approvedBy: string | null;
  invalidatedAt: string | null;
}

export interface ClientTrack {
  status: ClientStatus;
  approvedAt: string | null;
  comment: string | null;
}

export interface ApprovalRecord {
  version: 1;
  logicalPath: string;
  contentHash: string;
  overallStatus: OverallStatus;
  internal: InternalTrack;
  client: ClientTrack;
}

export interface QueueEntry {
  logicalPath: string;
  queuedAt: string;
  reason: QueueReason;
  approvedHash: string | null;
  currentHash: string;
}

export interface QueueIndex {
  version: 1;
  entries: QueueEntry[];
}

export interface DiffFile {
  logicalPath: string;
  approvedHash: string | null;
  currentHash: string;
  diff: string;
  linesAdded: number;
  linesRemoved: number;
  computedAt: string;
}

export interface HistoryLine {
  event: HistoryEvent;
  track?: ReviewTrack;
  at: string;
  by?: string;
  hash?: string;
  previousHash?: string;
  newHash?: string;
  reason?: string;
}
