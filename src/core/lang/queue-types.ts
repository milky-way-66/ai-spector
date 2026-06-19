import type { DocAnchor, EnrichmentCache } from "../sync/drift-types.js";

export type SyncDirection = "outbound" | "inbound";
export type FailReason = "conflict" | "dismissed" | "sync_error" | "timeout";

export type DocType = "srs" | "basic-design";

/** One detected file edit — used for merge resolution by AI or human. */
export interface FileChangeRecord {
  lang: string;
  path: string;
  hash: string;
  previousHash: string;
  /** File version before this edit */
  previousVersion: number;
  /** File version after this edit */
  version: number;
  /** When reconcile detected this edit (ISO-8601) */
  changedAt: string;
  /** File mtime — use with `sequence` to order parallel lang edits */
  mtimeMs: number;
  /** Order within this reconcile batch (1 = earliest by mtime) */
  sequence: number;
  /** v2: git anchor at previous version (replaces eager diff as source of truth) */
  anchor?: DocAnchor;
  /** @deprecated v1 — kept for legacy read; enrich uses when anchor missing */
  diff?: string;
  linesAdded?: number;
  linesRemoved?: number;
}

export interface TranslationTarget {
  lang: string;
  path: string;
  status: "pending" | "synced";
  baselineHash?: string;
  syncedAt?: string;
  hash?: string;
}

/** One sync job per logical document file (lang-agnostic relative path). */
export interface TranslationJob {
  id: string;
  docType: DocType;
  relativePath: string;
  direction: SyncDirection;
  origin: {
    lang: string;
    path: string;
    hash: string;
    changedAt: string;
    /** Set when multiple langs changed the same file — latest wins as origin */
    mergedLangs?: string[];
  };
  targets: TranslationTarget[];
  /** Per-language edits that created or updated this job (compare versions when merging) */
  changes: FileChangeRecord[];
  enrichment?: EnrichmentCache;
  createdAt: string;
  updatedAt: string;
}

export interface PendingQueueFile {
  version: 1;
  jobs: TranslationJob[];
}

export interface ResolvedTranslationJob extends TranslationJob {
  resolvedAt: string;
  syncedLangs: string[];
}

export interface ResolvedQueueFile {
  version: 1;
  jobs: ResolvedTranslationJob[];
}

export interface FailedTranslationJob extends TranslationJob {
  failedAt: string;
  reason: FailReason;
  message: string;
  changedLangs?: string[];
}

export interface FailedQueueFile {
  version: 1;
  jobs: FailedTranslationJob[];
}

export interface FileFingerprint {
  hash: string;
  scannedAt: string;
  /** Monotonic version — increments on each content change */
  version: number;
  /** Last scanned content — used to compute diffs on the next change */
  content?: string;
}

export interface FingerprintsFile {
  version: 1;
  files: Record<string, FileFingerprint>;
}

/** Per logical document — canonical store for pending merge context. */
export interface FileChangesDocument {
  version: 1;
  docType: DocType;
  relativePath: string;
  jobId: string;
  updatedAt: string;
  changes: FileChangeRecord[];
}

/** Append-only log of all file changes (for merge / audit). */
export interface ChangeHistoryFile {
  version: 1;
  entries: Array<FileChangeRecord & { docType: DocType; relativePath: string; jobId?: string }>;
}

export interface ReconcileResult {
  skipped: boolean;
  skipReason?: string;
  enqueued: number;
  resolved: number;
  failed: number;
  pendingCount: number;
}

export interface QueuePaths {
  dir: string;
  fingerprints: string;
  pending: string;
  resolved: string;
  failed: string;
  changeHistory: string;
  changesDir: string;
}
