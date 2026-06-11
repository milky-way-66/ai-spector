import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { pathExists } from "../util/fs.js";
import { resolveProjectPaths } from "../util/paths.js";
import { normalizeLogicalPath } from "../comments/paths.js";
import { resolveReviewDocPath } from "../reviews/doc-resolve.js";
import { listThreads } from "../comments/storage.js";
import { computeLineDiff } from "../util/diff.js";
import {
  getApproval,
  saveApproval,
  makeApproval,
  writeSnapshot,
  readSnapshot,
  appendHistory,
  addToQueue,
  removeFromQueue,
  archiveQueueEntry,
  loadQueueIndex,
  loadDiff,
  saveDiff,
  deleteDiff,
  deriveOverallStatus,
  discoverApprovals,
  readHistory,
  updateFingerprint,
} from "../reviews/storage.js";
import { reconcileReviews } from "../reviews/reconcile.js";
import { computeLiveStaleness } from "../reviews/staleness.js";
import { ensureReviewQueueMigrated, migrateLegacyReviews } from "../reviews/migrate.js";
import type { ApprovalRecord, QueueEntry, DiffFile, HistoryLine } from "../reviews/types.js";

// ── Options / Results ─────────────────────────────────────────────────────────

export interface ReviewApproveOptions {
  root?: string;
  logicalPath: string;
  by?: string;
}

export interface ReviewApproveResult {
  logicalPath: string;
  approvedBy: string;
  contentHash: string;
  movedToClientQueue: boolean;
  openThreadWarning: string | null;
}

export interface ReviewStatusOptions {
  root?: string;
  logicalPath: string;
  showDiff?: boolean;
  includeHistory?: boolean;
  historyLimit?: number;
  historySince?: string;
}

export interface ReviewStatusResult {
  approval: ApprovalRecord;
  diff: DiffFile | null;
  /** True when live content hash differs from last approved hash (computed, not yet reconciled). */
  stale?: boolean;
  /** Hash of the approved snapshot when stale is true. */
  approvedContentHash?: string;
  history?: HistoryLine[];
}

export interface ReviewQueueOptions {
  root?: string;
  track?: "internal" | "client" | "all";
  showDiff?: boolean;
}

export interface ReviewQueueResult {
  internal: { pending: QueueEntry[]; resolved: QueueEntry[]; rejected: QueueEntry[]; failed: QueueEntry[] };
  client: { pending: QueueEntry[]; resolved: QueueEntry[]; rejected: QueueEntry[] };
  diffs: Record<string, DiffFile | null>;
}

export interface ReviewCheckOptions {
  root?: string;
}

export interface ReviewCheckResult {
  scanned: number;
  invalidated: number;
  alreadyPending: number;
  errors: Array<{ logicalPath: string; error: string }>;
  migrated?: boolean;
}

export interface ReviewRejectOptions {
  root?: string;
  logicalPath: string;
  reason?: string;
}

export interface ReviewRejectResult {
  logicalPath: string;
  rejected: boolean;
  message: string;
}

export interface ReviewListOptions {
  root?: string;
  /** Filter by overallStatus. Omit to return all. */
  status?: "pending_internal" | "pending_client" | "approved" | "rejected" | "all";
  /** Filter to logical paths starting with this prefix, e.g. "srs" */
  prefix?: string;
}

export interface ReviewListEntry {
  logicalPath: string;
  overallStatus: string;
  contentHash: string;
  internal: { status: string; approvedBy: string | null; approvedAt: string | null };
  client: { status: string };
  /** True when live content differs from last approved hash. */
  stale?: boolean;
  /** Hash at last approval when stale is true. */
  approvedContentHash?: string;
}

export interface ReviewListResult {
  entries: ReviewListEntry[];
  total: number;
}

export interface ReviewMigrateOptions {
  root?: string;
}

export interface ReviewMigrateResult {
  migrated: boolean;
  documents: number;
  pendingJobs: number;
  historyLines: number;
  message: string;
}

async function prepareReviewRoot(root?: string): Promise<string> {
  const paths = await resolveProjectPaths(root);
  await ensureReviewQueueMigrated(paths.root);
  return paths.root;
}

// ── Operations ────────────────────────────────────────────────────────────────

export async function runApprove(opts: ReviewApproveOptions): Promise<ReviewApproveResult> {
  const projectRoot = await prepareReviewRoot(opts.root);
  const lp = normalizeLogicalPath(opts.logicalPath);
  const approvedBy = opts.by ?? "local";

  const { absPath: absDocPath, docPath } = await resolveReviewDocPath(projectRoot, lp);

  const content = await readFile(absDocPath, "utf8");
  const contentHash = createHash("sha256").update(content).digest("hex").slice(0, 16);

  // Warn about open threads but don't block
  let openThreadWarning: string | null = null;
  const openThreads = await listThreads({ projectRoot, filePath: lp, status: "open" });
  if (openThreads.length > 0) {
    openThreadWarning = `${openThreads.length} open comment thread(s) on this document`;
  }

  const now = new Date().toISOString();

  let approval = await getApproval(projectRoot, lp);
  if (!approval) {
    approval = makeApproval(lp, contentHash, docPath);
  }

  // Only internal can approve via this tool
  if (approval.overallStatus !== "pending_internal" && approval.internal.status !== "needs_review") {
    throw new Error(
      `Cannot approve: document is in state "${approval.overallStatus}". ` +
        `Run 'review check' first if the document has changed.`,
    );
  }

  approval.docPath = docPath;
  approval.contentHash = contentHash;
  approval.internal = {
    status: "approved",
    approvedAt: now,
    approvedBy,
    invalidatedAt: null,
  };
  approval.lastEventAt = now;
  approval.overallStatus = deriveOverallStatus(approval);

  const snapshotRef = await writeSnapshot(projectRoot, lp, content);
  approval.snapshotRef = snapshotRef;
  await saveApproval(projectRoot, approval);

  await updateFingerprint(projectRoot, lp, {
    hash: contentHash,
    docPath,
    scannedAt: now,
  });

  // Move from internal pending → internal resolved
  const entry = await removeFromQueue(projectRoot, "internal", lp);
  if (entry) {
    await archiveQueueEntry(projectRoot, "internal", "resolved", { ...entry, queuedAt: entry.queuedAt });
    await deleteDiff(projectRoot, "internal", lp);
  }

  // Add to client queue
  await addToQueue(projectRoot, "client", {
    logicalPath: lp,
    queuedAt: now,
    reason: "awaiting_client_signoff",
    approvedHash: contentHash,
    currentHash: contentHash,
  });

  await appendHistory(projectRoot, lp, {
    event: "approved",
    track: "internal",
    at: now,
    by: approvedBy,
    hash: contentHash,
  });

  return {
    logicalPath: lp,
    approvedBy,
    contentHash,
    movedToClientQueue: true,
    openThreadWarning,
  };
}

export async function runReviewStatus(opts: ReviewStatusOptions): Promise<ReviewStatusResult> {
  const projectRoot = await prepareReviewRoot(opts.root);
  const lp = normalizeLogicalPath(opts.logicalPath);

  const persisted = await getApproval(projectRoot, lp);
  if (!persisted) {
    throw new Error(`No approval record found for: ${lp}. Run 'review check' to initialise.`);
  }

  const approvedContentHash = persisted.contentHash;
  const live = await computeLiveStaleness(projectRoot, persisted, {
    showDiff: opts.showDiff !== false,
  });
  const approval = live.effectiveApproval;

  let diff: DiffFile | null = null;
  if (opts.showDiff !== false) {
    // Persisted diff from reconcile takes precedence
    diff = await loadDiff(projectRoot, "internal", lp);
    if (!diff) diff = await loadDiff(projectRoot, "client", lp);
    if (!diff) diff = live.diff;

    // Recompute if missing but already pending internal
    if (!diff && approval.overallStatus === "pending_internal") {
      try {
        const snapshot = await readSnapshot(projectRoot, lp);
        const { absPath: absDocPath } = await resolveReviewDocPath(projectRoot, lp);
        if (snapshot && (await pathExists(absDocPath))) {
          const current = await readFile(absDocPath, "utf8");
          const currentHash = createHash("sha256").update(current).digest("hex").slice(0, 16);
          const diffResult = computeLineDiff(snapshot, current);
          diff = {
            logicalPath: lp,
            approvedHash: approvedContentHash,
            currentHash,
            ...diffResult,
            computedAt: new Date().toISOString(),
          };
          if (!live.stale) {
            await saveDiff(projectRoot, "internal", diff);
          }
        }
      } catch {
        // Doc file not resolvable — skip diff recomputation
      }
    }
  }

  const result: ReviewStatusResult = {
    approval,
    diff,
    ...(live.stale ? { stale: true, approvedContentHash } : {}),
  };

  if (opts.includeHistory) {
    result.history = await readHistory(projectRoot, lp, {
      limit: opts.historyLimit,
      since: opts.historySince,
    });
  }

  return result;
}

export async function runReviewQueue(opts: ReviewQueueOptions): Promise<ReviewQueueResult> {
  const projectRoot = await prepareReviewRoot(opts.root);
  const track = opts.track ?? "all";

  const [iPending, iResolved, iRejected, iFailed, cPending, cResolved, cRejected] =
    await Promise.all([
      track !== "client" ? loadQueueIndex(projectRoot, "internal", "pending") : Promise.resolve({ version: 1 as const, entries: [] }),
      track !== "client" ? loadQueueIndex(projectRoot, "internal", "resolved") : Promise.resolve({ version: 1 as const, entries: [] }),
      track !== "client" ? loadQueueIndex(projectRoot, "internal", "rejected") : Promise.resolve({ version: 1 as const, entries: [] }),
      track !== "client" ? loadQueueIndex(projectRoot, "internal", "failed") : Promise.resolve({ version: 1 as const, entries: [] }),
      track !== "internal" ? loadQueueIndex(projectRoot, "client", "pending") : Promise.resolve({ version: 1 as const, entries: [] }),
      track !== "internal" ? loadQueueIndex(projectRoot, "client", "resolved") : Promise.resolve({ version: 1 as const, entries: [] }),
      track !== "internal" ? loadQueueIndex(projectRoot, "client", "rejected") : Promise.resolve({ version: 1 as const, entries: [] }),
    ]);

  // Load diffs for pending entries if requested
  const diffs: Record<string, DiffFile | null> = {};
  if (opts.showDiff !== false) {
    const pendingPaths = [
      ...iPending.entries.map((e) => ({ lp: e.logicalPath, t: "internal" as const })),
      ...cPending.entries.map((e) => ({ lp: e.logicalPath, t: "client" as const })),
    ];
    await Promise.all(
      pendingPaths.map(async ({ lp, t }) => {
        diffs[lp] = await loadDiff(projectRoot, t, lp);
      }),
    );
  }

  return {
    internal: {
      pending: iPending.entries,
      resolved: iResolved.entries,
      rejected: iRejected.entries,
      failed: iFailed.entries,
    },
    client: {
      pending: cPending.entries,
      resolved: cResolved.entries,
      rejected: cRejected.entries,
    },
    diffs,
  };
}

export async function runReviewList(opts: ReviewListOptions): Promise<ReviewListResult> {
  const projectRoot = await prepareReviewRoot(opts.root);
  const logicalPaths = await discoverApprovals(projectRoot);

  const entries: ReviewListEntry[] = [];

  await Promise.all(
    logicalPaths.map(async (lp) => {
      if (opts.prefix && !lp.startsWith(opts.prefix)) return;
      const persisted = await getApproval(projectRoot, lp);
      if (!persisted) return;

      const live = await computeLiveStaleness(projectRoot, persisted, { showDiff: false });
      const approval = live.effectiveApproval;

      if (opts.status && opts.status !== "all") {
        const filterStatus = opts.status;
        const matchesPersisted = persisted.overallStatus === filterStatus;
        const matchesLive = approval.overallStatus === filterStatus;
        if (!matchesPersisted && !matchesLive) return;
      }

      entries.push({
        logicalPath: lp,
        overallStatus: approval.overallStatus,
        contentHash: approval.contentHash,
        internal: {
          status: approval.internal.status,
          approvedBy: approval.internal.approvedBy,
          approvedAt: approval.internal.approvedAt,
        },
        client: { status: approval.client.status },
        ...(live.stale
          ? { stale: true, approvedContentHash: persisted.contentHash }
          : {}),
      });
    }),
  );

  entries.sort((a, b) => a.logicalPath.localeCompare(b.logicalPath));

  return { entries, total: entries.length };
}

export async function runReviewCheck(opts: ReviewCheckOptions): Promise<ReviewCheckResult> {
  const projectRoot = await prepareReviewRoot(opts.root);
  const migration = await ensureReviewQueueMigrated(projectRoot);
  const result = await reconcileReviews(projectRoot);
  if (migration?.migrated) {
    return { ...result, migrated: true };
  }
  return result;
}

export async function runReviewReject(opts: ReviewRejectOptions): Promise<ReviewRejectResult> {
  const projectRoot = await prepareReviewRoot(opts.root);
  const lp = normalizeLogicalPath(opts.logicalPath);

  const entry = await removeFromQueue(projectRoot, "internal", lp);
  if (!entry) {
    return {
      logicalPath: lp,
      rejected: false,
      message: `${lp} is not in the internal review queue`,
    };
  }

  await archiveQueueEntry(projectRoot, "internal", "rejected", entry);
  await deleteDiff(projectRoot, "internal", lp);

  // Reset approval back to approved (dismiss the change)
  const approval = await getApproval(projectRoot, lp);
  if (approval) {
    approval.internal.status = "approved";
    approval.internal.invalidatedAt = null;
    approval.overallStatus = deriveOverallStatus(approval);
    await saveApproval(projectRoot, approval);
  }

  const now = new Date().toISOString();
  await appendHistory(projectRoot, lp, {
    event: "rejected",
    track: "internal",
    at: now,
    reason: opts.reason ?? "dismissed",
  });

  return {
    logicalPath: lp,
    rejected: true,
    message: opts.reason
      ? `Dismissed change for ${lp}: ${opts.reason}`
      : `Dismissed change for ${lp} (no re-approval required)`,
  };
}

export async function runReviewMigrate(opts: ReviewMigrateOptions): Promise<ReviewMigrateResult> {
  const paths = await resolveProjectPaths(opts.root);
  return migrateLegacyReviews(paths.root);
}
