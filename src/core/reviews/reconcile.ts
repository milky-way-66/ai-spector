import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { pathExists } from "../util/fs.js";
import { logicalPathToDocPath } from "../comments/paths.js";
import { computeLineDiff } from "../util/diff.js";
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
} from "./storage.js";

export interface ReconcileReviewsResult {
  scanned: number;
  invalidated: number;
  alreadyPending: number;
  errors: Array<{ logicalPath: string; error: string }>;
}

export async function reconcileReviews(projectRoot: string): Promise<ReconcileReviewsResult> {
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

      const docPath = logicalPathToDocPath(logicalPath);
      if (!docPath) {
        result.errors.push({ logicalPath, error: "Cannot resolve doc path" });
        continue;
      }

      const absDocPath = join(projectRoot, docPath);
      if (!(await pathExists(absDocPath))) {
        result.errors.push({ logicalPath, error: `Doc file not found: ${docPath}` });
        continue;
      }

      const currentContent = await readFile(absDocPath, "utf8");
      const currentHash = createHash("sha256").update(currentContent).digest("hex").slice(0, 16);

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

      // Invalidate approval
      const now = new Date().toISOString();
      const prevHash = approval.contentHash;
      approval.contentHash = currentHash;
      approval.internal.status = "needs_review";
      approval.internal.invalidatedAt = now;
      approval.client.status = "pending";
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
