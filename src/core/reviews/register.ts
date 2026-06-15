import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { computeLineDiff } from "../util/diff.js";
import {
  getApproval,
  saveApproval,
  makeApproval,
  addToQueue,
  updateFingerprint,
  loadQueueIndex,
  readSnapshot,
  saveDiff,
  deriveOverallStatus,
} from "./storage.js";
import { discoverReviewableDocs } from "./discover.js";
import { reconcileReviews, type ReconcileReviewsResult } from "./reconcile.js";
import { resolveReviewDocPath } from "./doc-resolve.js";
import { contentHash } from "./staleness.js";
import { normalizeLogicalPath } from "../comments/paths.js";
import { ensureReviewQueueMigrated } from "./migrate.js";
import type { ApprovalRecord } from "./types.js";
import { deriveReviewKind, type ReviewKind } from "./review-kind.js";

export interface DiscoverAndQueueResult {
  discovered: number;
  queued: number;
  alreadyQueued: number;
  errors: Array<{ logicalPath: string; error: string }>;
}

export interface SyncPendingFromDiskResult {
  /** Pending-internal docs whose on-disk hash changed since last registry sync. */
  updated: number;
  unchanged: number;
  errors: Array<{ logicalPath: string; error: string }>;
}

export interface ReviewDiscoveryResult extends ReconcileReviewsResult {
  discovered: number;
  queued: number;
  alreadyQueued: number;
  updated: number;
}

/**
 * Register never-reviewed documents found on disk into the review registry and internal queue.
 */
export async function discoverAndQueueUnreviewed(
  projectRoot: string,
): Promise<DiscoverAndQueueResult> {
  const docs = await discoverReviewableDocs(projectRoot);
  const internalPending = await loadQueueIndex(projectRoot, "internal", "pending");
  const pendingPaths = new Set(internalPending.entries.map((e) => e.logicalPath));

  const result: DiscoverAndQueueResult = {
    discovered: docs.length,
    queued: 0,
    alreadyQueued: 0,
    errors: [],
  };

  for (const doc of docs) {
    try {
      const existing = await getApproval(projectRoot, doc.logicalPath);
      if (existing) {
        if (pendingPaths.has(doc.logicalPath) || existing.overallStatus === "pending_internal") {
          result.alreadyQueued++;
        }
        continue;
      }

      const approval = makeApproval(doc.logicalPath, doc.contentHash, doc.docPath);
      await saveApproval(projectRoot, approval);

      const now = new Date().toISOString();
      await addToQueue(projectRoot, "internal", {
        logicalPath: doc.logicalPath,
        queuedAt: now,
        reason: "first_review",
        approvedHash: null,
        currentHash: doc.contentHash,
      });
      await updateFingerprint(projectRoot, doc.logicalPath, {
        hash: doc.contentHash,
        docPath: doc.docPath,
        scannedAt: now,
      });
      result.queued++;
    } catch (err) {
      result.errors.push({
        logicalPath: doc.logicalPath,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return result;
}

/**
 * Refresh pending-internal queue entries when on-disk content changed
 * (e.g. doc edited after generation but before first sign-off, or while re-review is pending).
 */
export async function syncPendingDocsFromDisk(
  projectRoot: string,
): Promise<SyncPendingFromDiskResult> {
  const docs = await discoverReviewableDocs(projectRoot);
  const internalPending = await loadQueueIndex(projectRoot, "internal", "pending");
  const pendingByPath = new Map(
    internalPending.entries.map((e) => [e.logicalPath, e] as const),
  );

  const result: SyncPendingFromDiskResult = {
    updated: 0,
    unchanged: 0,
    errors: [],
  };

  for (const doc of docs) {
    try {
      const approval = await getApproval(projectRoot, doc.logicalPath);
      if (!approval || approval.overallStatus !== "pending_internal") {
        continue;
      }

      if (doc.contentHash === approval.contentHash) {
        result.unchanged++;
        continue;
      }

      const now = new Date().toISOString();
      const prevHash = approval.contentHash;
      approval.contentHash = doc.contentHash;
      approval.docPath = doc.docPath;

      const snapshot = await readSnapshot(projectRoot, doc.logicalPath);
      if (snapshot) {
        const currentContent = await readFile(join(projectRoot, doc.docPath), "utf8");
        const diffResult = computeLineDiff(snapshot, currentContent);
        await saveDiff(projectRoot, "internal", {
          logicalPath: doc.logicalPath,
          approvedHash: prevHash,
          currentHash: doc.contentHash,
          ...diffResult,
          computedAt: now,
        });
        approval.internal.status = "needs_review";
        approval.internal.invalidatedAt = approval.internal.invalidatedAt ?? now;
      }

      approval.overallStatus = deriveOverallStatus(approval);
      await saveApproval(projectRoot, approval);

      const existingEntry = pendingByPath.get(doc.logicalPath);
      await addToQueue(projectRoot, "internal", {
        logicalPath: doc.logicalPath,
        queuedAt: existingEntry?.queuedAt ?? now,
        reason: existingEntry?.reason ?? (snapshot ? "content_changed" : "first_review"),
        approvedHash: snapshot ? prevHash : existingEntry?.approvedHash ?? null,
        currentHash: doc.contentHash,
      });

      await updateFingerprint(projectRoot, doc.logicalPath, {
        hash: doc.contentHash,
        docPath: doc.docPath,
        scannedAt: now,
      });

      result.updated++;
    } catch (err) {
      result.errors.push({
        logicalPath: doc.logicalPath,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return result;
}

/** Reconcile approvals, queue new files, and sync pending entries from disk. */
export async function runReviewDiscovery(projectRoot: string): Promise<ReviewDiscoveryResult> {
  await ensureReviewQueueMigrated(projectRoot);
  const reconcile = await reconcileReviews(projectRoot);
  const discovery = await discoverAndQueueUnreviewed(projectRoot);
  const pendingSync = await syncPendingDocsFromDisk(projectRoot);
  return {
    ...reconcile,
    discovered: discovery.discovered,
    queued: discovery.queued,
    alreadyQueued: discovery.alreadyQueued,
    updated: pendingSync.updated,
    errors: [...reconcile.errors, ...discovery.errors, ...pendingSync.errors],
  };
}

export interface EnsureApprovalResult {
  approval: ApprovalRecord;
  created: boolean;
  reviewKind: ReviewKind;
}

/**
 * Ensure an approval record exists for a resolvable logical path.
 * Creates registry + internal queue entry for first-time review when the file exists on disk.
 */
export async function ensureApprovalForReview(
  projectRoot: string,
  logicalPath: string,
): Promise<EnsureApprovalResult> {
  const lp = normalizeLogicalPath(logicalPath);
  const existing = await getApproval(projectRoot, lp);
  if (existing) {
    return {
      approval: existing,
      created: false,
      reviewKind: deriveReviewKind(existing),
    };
  }

  const { docPath, absPath } = await resolveReviewDocPath(projectRoot, lp);
  const content = await readFile(absPath, "utf8");
  const hash = contentHash(content);

  const approval = makeApproval(lp, hash, docPath);
  await saveApproval(projectRoot, approval);

  const now = new Date().toISOString();
  await addToQueue(projectRoot, "internal", {
    logicalPath: lp,
    queuedAt: now,
    reason: "first_review",
    approvedHash: null,
    currentHash: hash,
  });
  await updateFingerprint(projectRoot, lp, {
    hash,
    docPath,
    scannedAt: now,
  });

  return { approval, created: true, reviewKind: "first" };
}
