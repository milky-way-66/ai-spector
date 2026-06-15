import { readFile } from "node:fs/promises";
import { computeLineDiff } from "../util/diff.js";
import { contentHash, resolveApprovalDocPath } from "./staleness.js";
import {
  discoverApprovals,
  getApproval,
  saveApproval,
  readSnapshot,
  addToQueue,
  removeFromQueue,
  saveDiff,
  appendHistory,
  deriveOverallStatus,
  updateFingerprint,
} from "./storage.js";
import { emptyClientTrack } from "./votes.js";
import { ensureReviewQueueMigrated } from "./migrate.js";

export interface ReconcileReviewsResult {
  scanned: number;
  invalidated: number;
  alreadyPending: number;
  errors: Array<{ logicalPath: string; error: string }>;
}

export async function reconcileReviews(projectRoot: string): Promise<ReconcileReviewsResult> {
  await ensureReviewQueueMigrated(projectRoot);
  const logicalPaths = await discoverApprovals(projectRoot);
  const result: ReconcileReviewsResult = {
    scanned: logicalPaths.length,
    invalidated: 0,
    alreadyPending: 0,
    errors: [],
  };

  for (const logicalPath of logicalPaths) {
    try {
      const approval = await getApproval(projectRoot, logicalPath);
      if (!approval) continue;

      // Already pending internal review — nothing to do
      if (approval.overallStatus === "pending_internal") {
        result.alreadyPending++;
        continue;
      }

      let absDocPath: string;
      let docPath: string;
      try {
        ({ absPath: absDocPath, docPath } = await resolveApprovalDocPath(projectRoot, approval));
      } catch (err) {
        result.errors.push({
          logicalPath,
          error: err instanceof Error ? err.message : String(err),
        });
        continue;
      }

      const currentContent = await readFile(absDocPath, "utf8");
      const currentHash = contentHash(currentContent);

      if (currentHash === approval.contentHash) continue;

      // Content changed — compute diff against snapshot
      const snapshot = await readSnapshot(projectRoot, logicalPath);
      const diffResult = snapshot
        ? computeLineDiff(snapshot, currentContent)
        : { diff: "(snapshot missing — cannot compute diff)", linesAdded: 0, linesRemoved: 0 };

      // Save diff file for internal queue
      await saveDiff(projectRoot, "internal", {
        logicalPath,
        approvedHash: approval.contentHash,
        currentHash,
        diff: diffResult.diff,
        linesAdded: diffResult.linesAdded,
        linesRemoved: diffResult.linesRemoved,
        computedAt: new Date().toISOString(),
      });

      // Invalidate approval — reset votes, re-queue internal review
      const now = new Date().toISOString();
      const prevHash = approval.contentHash;
      approval.contentHash = currentHash;
      approval.docPath = docPath;
      approval.internal = {
        ...approval.internal,
        status: "needs_review",
        votes: [],
        quorumMetAt: null,
        closedAt: null,
        closedBy: null,
        closeReason: null,
        invalidatedAt: now,
      };
      approval.client = emptyClientTrack();
      approval.overallStatus = deriveOverallStatus(approval);
      await saveApproval(projectRoot, approval);

      // Remove from client queue if present
      await removeFromQueue(projectRoot, "client", logicalPath);

      // Add to internal queue
      await addToQueue(projectRoot, "internal", {
        logicalPath,
        queuedAt: now,
        reason: "content_changed",
        approvedHash: prevHash,
        currentHash,
      });

      await appendHistory(projectRoot, logicalPath, {
        event: "invalidated",
        at: now,
        reason: "content_changed",
        previousHash: prevHash,
        newHash: currentHash,
      });

      await updateFingerprint(projectRoot, logicalPath, {
        hash: currentHash,
        docPath,
        scannedAt: now,
      });

      result.invalidated++;
    } catch (err) {
      result.errors.push({
        logicalPath,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return result;
}
