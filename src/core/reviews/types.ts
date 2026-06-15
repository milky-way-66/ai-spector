export type OverallStatus = "pending_internal" | "pending_client" | "approved" | "rejected";
export type TrackStatus = "pending" | "approved" | "needs_review";
export type ClientStatus = "pending" | "approved" | "rejected";
export type QueueReason =
  | "content_changed"
  | "client_rejected"
  | "awaiting_client_signoff"
  | "first_review"
  | "invalidated";
export type HistoryEvent =
  | "registered"
  | "approved"
  | "invalidated"
  | "rejected"
  | "client_approved"
  | "client_rejected";
export type ReviewTrack = "internal" | "client";
import type { AuditActorRole } from "../util/audit-actor.js";
export type ReviewActorRole = AuditActorRole;

export interface InternalTrack {
  status: TrackStatus;
  approvedAt: string | null;
  approvedBy: string | null;
  invalidatedAt: string | null;
  /** Reviewer note on internal approve (optional). */
  note?: string | null;
}

export interface ClientTrack {
  status: ClientStatus;
  approvedAt: string | null;
  comment: string | null;
}

/** Per-document approval state stored in registry.json. */
export interface ApprovalRecord {
  version: 1 | 2;
  logicalPath: string;
  /** Repo-relative path to the resolved document file. */
  docPath?: string;
  contentHash: string;
  overallStatus: OverallStatus;
  internal: InternalTrack;
  client: ClientTrack;
  snapshotRef?: string;
  lastEventAt?: string;
}

export interface ReviewFingerprint {
  hash: string;
  docPath: string;
  scannedAt: string;
}

export interface FingerprintsFile {
  version: 1;
  files: Record<string, ReviewFingerprint>;
}

export interface RegistryFile {
  version: 2;
  documents: Record<string, ApprovalRecord>;
}

/** Unified pending job (replaces per-track QueueEntry in pending index). */
export interface ReviewJob {
  id: string;
  logicalPath: string;
  track: ReviewTrack;
  reason: QueueReason;
  queuedAt: string;
  baselineHash: string | null;
  currentHash: string;
}

export interface PendingQueueFile {
  version: 2;
  jobs: ReviewJob[];
}

/** @deprecated Use ReviewJob — kept for queue result compatibility. */
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
  logicalPath?: string;
  track?: ReviewTrack;
  at: string;
  /** Actor email (typically from git user.email). */
  by?: string;
  /** Actor display name (typically from git user.name). */
  username?: string;
  /** Whether the actor is an internal team member or external client reviewer. */
  role?: ReviewActorRole;
  hash?: string;
  previousHash?: string;
  newHash?: string;
  reason?: string;
  /** Reviewer note on approve (optional). */
  note?: string;
  meta?: Record<string, unknown>;
}

export function jobToQueueEntry(job: ReviewJob): QueueEntry {
  return {
    logicalPath: job.logicalPath,
    queuedAt: job.queuedAt,
    reason: job.reason,
    approvedHash: job.baselineHash,
    currentHash: job.currentHash,
  };
}

export function reviewJobId(logicalPath: string, track: ReviewTrack): string {
  return `${logicalPath}:${track}`;
}

/** Agent review workflow phase persisted in `.session.json` (local gate for review_approve). */
export type ReviewSessionPhase =
  | "detect"
  | "queue"
  | "reviewing"
  | "awaiting_decision"
  | "done";

export interface ReviewSessionFile {
  version: 1;
  startedAt: string;
  updatedAt: string;
  phase: ReviewSessionPhase;
  activeLogicalPath: string | null;
  reviewStatusAt: string | null;
  reviewWrittenAt: string | null;
  contentHashAtReview: string | null;
}
