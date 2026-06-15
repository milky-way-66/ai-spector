import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { pathExists } from "../util/fs.js";
import { resolveReviewDocPath } from "./doc-resolve.js";
import { computeLineDiff } from "../util/diff.js";
import { deriveOverallStatus, readSnapshot } from "./storage.js";
import { emptyClientTrack } from "./votes.js";
import type { ApprovalRecord, DiffFile } from "./types.js";

export function contentHash(content: string): string {
  return createHash("sha256").update(content).digest("hex").slice(0, 16);
}

/** Resolve the on-disk document used for hash comparison — prefers the path stored at approval time. */
export async function resolveApprovalDocPath(
  projectRoot: string,
  approval: ApprovalRecord,
): Promise<{ docPath: string; absPath: string }> {
  if (approval.docPath) {
    const absPath = join(projectRoot, approval.docPath);
    if (await pathExists(absPath)) {
      return { docPath: approval.docPath, absPath };
    }
  }
  return resolveReviewDocPath(projectRoot, approval.logicalPath);
}

export interface LiveStalenessResult {
  stale: boolean;
  currentHash: string | null;
  /** Approval record adjusted for live content when stale (not persisted). */
  effectiveApproval: ApprovalRecord;
  diff: DiffFile | null;
}

/**
 * Compare live document content to the last approved hash.
 * When stale, returns computed needs_review state without writing to disk.
 */
export async function computeLiveStaleness(
  projectRoot: string,
  approval: ApprovalRecord,
  opts: { showDiff?: boolean } = {},
): Promise<LiveStalenessResult> {
  const showDiff = opts.showDiff !== false;
  const approvedHash = approval.contentHash;

  if (approval.overallStatus === "pending_internal" || approval.internal.status === "needs_review") {
    return { stale: false, currentHash: null, effectiveApproval: approval, diff: null };
  }

  let currentHash: string | null = null;
  try {
    const { absPath } = await resolveApprovalDocPath(projectRoot, approval);
    const currentContent = await readFile(absPath, "utf8");
    currentHash = contentHash(currentContent);
  } catch {
    return { stale: false, currentHash: null, effectiveApproval: approval, diff: null };
  }

  if (currentHash === approvedHash) {
    return { stale: false, currentHash, effectiveApproval: approval, diff: null };
  }

  const effectiveApproval: ApprovalRecord = {
    ...approval,
    contentHash: currentHash,
    internal: {
      ...approval.internal,
      status: "needs_review",
      invalidatedAt: approval.internal.invalidatedAt ?? new Date().toISOString(),
    },
    client: emptyClientTrack(),
    overallStatus: "pending_internal",
  };
  effectiveApproval.overallStatus = deriveOverallStatus(effectiveApproval);

  let diff: DiffFile | null = null;
  if (showDiff) {
    try {
      const snapshot = await readSnapshot(projectRoot, approval.logicalPath);
      const { absPath } = await resolveApprovalDocPath(projectRoot, approval);
      const currentContent = await readFile(absPath, "utf8");
      const diffResult = snapshot
        ? computeLineDiff(snapshot, currentContent)
        : { diff: "(snapshot missing — cannot compute diff)", linesAdded: 0, linesRemoved: 0 };
      diff = {
        logicalPath: approval.logicalPath,
        approvedHash,
        currentHash,
        ...diffResult,
        computedAt: new Date().toISOString(),
      };
    } catch {
      diff = null;
    }
  }

  return { stale: true, currentHash, effectiveApproval, diff };
}
