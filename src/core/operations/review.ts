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
} from "../reviews/storage.js";
import { reconcileReviews } from "../reviews/reconcile.js";
import type { ApprovalRecord, QueueEntry, DiffFile } from "../reviews/types.js";

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
}

export interface ReviewStatusResult {
  approval: ApprovalRecord;
  diff: DiffFile | null;
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
}

export interface ReviewListResult {
  entries: ReviewListEntry[];
  total: number;
}

// ── Operations ────────────────────────────────────────────────────────────────

export async function runApprove(opts: ReviewApproveOptions): Promise<ReviewApproveResult> {
  const paths = await resolveProjectPaths(opts.root);
  const lp = normalizeLogicalPath(opts.logicalPath);
  const approvedBy = opts.by ?? "local";

  const { absPath: absDocPath } = await resolveReviewDocPath(paths.root, lp);

  const content = await readFile(absDocPath, "utf8");
  const contentHash = createHash("sha256").update(content).digest("hex").slice(0, 16);

  // Warn about open threads but don't block
  let openThreadWarning: string | null = null;
  const openThreads = await listThreads({ projectRoot: paths.root, filePath: lp, status: "open" });
  if (openThreads.length > 0) {
    openThreadWarning = `${openThreads.length} open comment thread(s) on this document`;
  }

  const now = new Date().toISOString();

  let approval = await getApproval(paths.root, lp);
  if (!approval) {
    approval = makeApproval(lp, contentHash);
  }

  // Only internal can approve via this tool
  if (approval.overallStatus !== "pending_internal" && approval.internal.status !== "needs_review") {
    throw new Error(
      `Cannot approve: document is in state "${approval.overallStatus}". ` +
        `Run 'review check' first if the document has changed.`,
    );
  }

  approval.contentHash = contentHash;
  approval.internal = {
    status: "approved",
    approvedAt: now,
    approvedBy,
    invalidatedAt: null,
  };
  approval.overallStatus = deriveOverallStatus(approval);
  await saveApproval(paths.root, approval);

  // Write snapshot on first approval or re-approval
  await writeSnapshot(paths.root, lp, content);

  // Move from internal pending → internal resolved
  const entry = await removeFromQueue(paths.root, "internal", lp);
  if (entry) {
    await archiveQueueEntry(paths.root, "internal", "resolved", { ...entry, queuedAt: entry.queuedAt });
    await deleteDiff(paths.root, "internal", lp);
  }

  // Add to client queue
  await addToQueue(paths.root, "client", {
    logicalPath: lp,
    queuedAt: now,
    reason: "content_changed",
    approvedHash: null,
    currentHash: contentHash,
  });

  await appendHistory(paths.root, lp, {
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
  const paths = await resolveProjectPaths(opts.root);
  const lp = normalizeLogicalPath(opts.logicalPath);

  const approval = await getApproval(paths.root, lp);
  if (!approval) {
    throw new Error(`No approval record found for: ${lp}. Run 'review check' to initialise.`);
  }

  let diff: DiffFile | null = null;
  if (opts.showDiff !== false) {
    // Try internal diff first, then client
    diff = await loadDiff(paths.root, "internal", lp);
    if (!diff) diff = await loadDiff(paths.root, "client", lp);

    // Recompute if missing but snapshot + doc exist
    if (!diff && approval.overallStatus === "pending_internal") {
      try {
        const { absPath: absDocPath } = await resolveReviewDocPath(paths.root, lp);
        const snapshot = await readSnapshot(paths.root, lp);
        if (snapshot && (await pathExists(absDocPath))) {
          const current = await readFile(absDocPath, "utf8");
          const currentHash = createHash("sha256").update(current).digest("hex").slice(0, 16);
          const diffResult = computeLineDiff(snapshot, current);
          diff = {
            logicalPath: lp,
            approvedHash: approval.contentHash,
            currentHash,
            ...diffResult,
            computedAt: new Date().toISOString(),
          };
          await saveDiff(paths.root, "internal", diff);
        }
      } catch {
        // Doc file not resolvable — skip diff recomputation
      }
    }
  }

  return { approval, diff };
}

export async function runReviewQueue(opts: ReviewQueueOptions): Promise<ReviewQueueResult> {
  const paths = await resolveProjectPaths(opts.root);
  const track = opts.track ?? "all";

  const [iPending, iResolved, iRejected, iFailed, cPending, cResolved, cRejected] =
    await Promise.all([
      track !== "client" ? loadQueueIndex(paths.root, "internal", "pending") : Promise.resolve({ version: 1 as const, entries: [] }),
      track !== "client" ? loadQueueIndex(paths.root, "internal", "resolved") : Promise.resolve({ version: 1 as const, entries: [] }),
      track !== "client" ? loadQueueIndex(paths.root, "internal", "rejected") : Promise.resolve({ version: 1 as const, entries: [] }),
      track !== "client" ? loadQueueIndex(paths.root, "internal", "failed") : Promise.resolve({ version: 1 as const, entries: [] }),
      track !== "internal" ? loadQueueIndex(paths.root, "client", "pending") : Promise.resolve({ version: 1 as const, entries: [] }),
      track !== "internal" ? loadQueueIndex(paths.root, "client", "resolved") : Promise.resolve({ version: 1 as const, entries: [] }),
      track !== "internal" ? loadQueueIndex(paths.root, "client", "rejected") : Promise.resolve({ version: 1 as const, entries: [] }),
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
        diffs[lp] = await loadDiff(paths.root, t, lp);
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
  const paths = await resolveProjectPaths(opts.root);
  const logicalPaths = await discoverApprovals(paths.root);

  const entries: ReviewListEntry[] = [];

  await Promise.all(
    logicalPaths.map(async (lp) => {
      if (opts.prefix && !lp.startsWith(opts.prefix)) return;
      const approval = await getApproval(paths.root, lp);
      if (!approval) return;
      if (opts.status && opts.status !== "all" && approval.overallStatus !== opts.status) return;
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
      });
    }),
  );

  entries.sort((a, b) => a.logicalPath.localeCompare(b.logicalPath));

  return { entries, total: entries.length };
}

export async function runReviewCheck(opts: ReviewCheckOptions): Promise<ReviewCheckResult> {
  const paths = await resolveProjectPaths(opts.root);
  return reconcileReviews(paths.root);
}

export async function runReviewReject(opts: ReviewRejectOptions): Promise<ReviewRejectResult> {
  const paths = await resolveProjectPaths(opts.root);
  const lp = normalizeLogicalPath(opts.logicalPath);

  const entry = await removeFromQueue(paths.root, "internal", lp);
  if (!entry) {
    return {
      logicalPath: lp,
      rejected: false,
      message: `${lp} is not in the internal review queue`,
    };
  }

  await archiveQueueEntry(paths.root, "internal", "rejected", entry);
  await deleteDiff(paths.root, "internal", lp);

  // Reset approval back to approved (dismiss the change)
  const approval = await getApproval(paths.root, lp);
  if (approval) {
    approval.internal.status = "approved";
    approval.internal.invalidatedAt = null;
    approval.overallStatus = deriveOverallStatus(approval);
    await saveApproval(paths.root, approval);
  }

  const now = new Date().toISOString();
  await appendHistory(paths.root, lp, {
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
