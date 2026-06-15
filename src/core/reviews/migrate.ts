import { readFile, copyFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { pathExists, readJson } from "../util/fs.js";
import {
  legacyReviewsRoot,
  reviewQueuePaths,
  legacyApprovalJsonPath,
  legacyApprovalSnapshotPath,
  legacyApprovalHistoryPath,
  legacyQueuePendingPath,
  legacyQueueResolvedPath,
  legacyQueueRejectedPath,
  legacyQueueFailedPath,
  legacyDiffFilePath,
  snapshotPath,
  changePath,
  safeFileName,
} from "./paths.js";
import {
  loadRegistry,
  saveRegistry,
  saveFingerprints,
  appendHistory,
} from "./storage.js";
import type {
  ApprovalRecord,
  QueueIndex,
  DiffFile,
  HistoryLine,
  FingerprintsFile,
  PendingQueueFile,
  ReviewJob,
} from "./types.js";
import { reviewJobId } from "./types.js";
import { normalizeApprovalRecord } from "./normalize.js";
import { readdir } from "node:fs/promises";

export interface MigrateReviewsResult {
  migrated: boolean;
  documents: number;
  pendingJobs: number;
  historyLines: number;
  message: string;
}

export async function legacyReviewsExists(projectRoot: string): Promise<boolean> {
  return pathExists(legacyReviewsRoot(projectRoot));
}

export async function needsReviewMigration(projectRoot: string): Promise<boolean> {
  const legacy = await legacyReviewsExists(projectRoot);
  if (!legacy) return false;
  const paths = reviewQueuePaths(projectRoot);
  return !(await pathExists(paths.registry));
}

/** Migrate legacy `reviews/` tree to `.ai-spector/.docflow/review-queue/`. */
export async function migrateLegacyReviews(projectRoot: string): Promise<MigrateReviewsResult> {
  if (!(await needsReviewMigration(projectRoot))) {
    const registry = await loadRegistry(projectRoot);
    const docCount = Object.keys(registry.documents).length;
    return {
      migrated: false,
      documents: docCount,
      pendingJobs: 0,
      historyLines: 0,
      message: docCount > 0
        ? "Review queue already at .ai-spector/.docflow/review-queue/"
        : "No legacy reviews/ directory to migrate",
    };
  }

  const paths = reviewQueuePaths(projectRoot);
  await mkdir(paths.dir, { recursive: true });
  await mkdir(paths.snapshots, { recursive: true });
  await mkdir(paths.changes, { recursive: true });

  const registry = await loadRegistry(projectRoot);
  const fingerprints: FingerprintsFile = { version: 1, files: {} };
  const pending: PendingQueueFile = { version: 2, jobs: [] };
  let historyLines = 0;

  // Walk legacy approval.json files
  const logicalPaths = await discoverLegacyApprovals(projectRoot);
  for (const logicalPath of logicalPaths) {
    const legacyApproval = join(projectRoot, legacyApprovalJsonPath(logicalPath));
    const raw = await readJson<ApprovalRecord>(legacyApproval);
    const record = normalizeApprovalRecord({ ...raw, logicalPath });

    // Migrate snapshot
    const legacySnap = join(projectRoot, legacyApprovalSnapshotPath(logicalPath));
    if (await pathExists(legacySnap)) {
      const dest = snapshotPath(paths, logicalPath);
      await copyFile(legacySnap, dest);
      record.snapshotRef = join(
        ".ai-spector/.docflow/review-queue/snapshots",
        `${safeFileName(logicalPath)}.md`,
      ).replace(/\\/g, "/");
    }

    registry.documents[logicalPath] = record;
    fingerprints.files[logicalPath] = {
      hash: record.contentHash,
      docPath: record.docPath ?? "",
      scannedAt: record.lastEventAt ?? record.internal.quorumMetAt ?? new Date().toISOString(),
    };

    // Migrate per-doc history to global history.jsonl
    const legacyHist = join(projectRoot, legacyApprovalHistoryPath(logicalPath));
    if (await pathExists(legacyHist)) {
      const content = await readFile(legacyHist, "utf8");
      for (const line of content.split("\n").filter(Boolean)) {
        const parsed = JSON.parse(line) as HistoryLine;
        await appendHistory(projectRoot, logicalPath, parsed);
        historyLines++;
      }
    }
  }

  await saveRegistry(projectRoot, registry);
  await saveFingerprints(projectRoot, fingerprints);

  // Migrate queue indexes
  for (const track of ["internal", "client"] as const) {
    for (const kind of ["pending", "resolved", "rejected"] as const) {
      let legacyPath: string;
      if (kind === "pending") legacyPath = legacyQueuePendingPath(track);
      else if (kind === "resolved") legacyPath = legacyQueueResolvedPath(track);
      else legacyPath = legacyQueueRejectedPath(track);

      const abs = join(projectRoot, legacyPath);
      if (!(await pathExists(abs))) continue;

      const idx = await readJson<QueueIndex>(abs).catch(() => ({ version: 1 as const, entries: [] }));
      if (kind === "pending") {
        for (const entry of idx.entries) {
          pending.jobs.push({
            id: reviewJobId(entry.logicalPath, track),
            logicalPath: entry.logicalPath,
            track,
            reason: entry.reason === "content_changed" && track === "client" && entry.approvedHash === null
              ? "awaiting_client_signoff"
              : entry.reason,
            queuedAt: entry.queuedAt,
            baselineHash: entry.approvedHash,
            currentHash: entry.currentHash,
          });
        }
      } else {
        const { writeJson } = await import("../util/fs.js");
        const dest =
          track === "internal"
            ? kind === "resolved"
              ? paths.internalResolved
              : paths.internalRejected
            : kind === "resolved"
              ? paths.clientResolved
              : paths.clientRejected;
        await writeJson(dest, idx);
      }
    }

    // Migrate diffs
    const legacyDiffsDir = join(projectRoot, "reviews", `${track}_queue`, "diffs");
    if (await pathExists(legacyDiffsDir)) {
      const files = await readdir(legacyDiffsDir);
      for (const file of files) {
        if (!file.endsWith(".json")) continue;
        const diff = await readJson<DiffFile>(join(legacyDiffsDir, file));
        const { writeJson } = await import("../util/fs.js");
        await writeJson(changePath(paths, diff.logicalPath), diff);
      }
    }
  }

  // Migrate internal failed queue
  const failedAbs = join(projectRoot, legacyQueueFailedPath());
  if (await pathExists(failedAbs)) {
    const idx = await readJson<QueueIndex>(failedAbs).catch(() => ({ version: 1 as const, entries: [] }));
    const { writeJson } = await import("../util/fs.js");
    await writeJson(paths.internalFailed, idx);
  }

  const { writeJson } = await import("../util/fs.js");
  await writeJson(paths.pending, pending);

  return {
    migrated: true,
    documents: logicalPaths.length,
    pendingJobs: pending.jobs.length,
    historyLines,
    message: `Migrated ${logicalPaths.length} document(s) from reviews/ to .ai-spector/.docflow/review-queue/`,
  };
}

async function discoverLegacyApprovals(projectRoot: string): Promise<string[]> {
  const root = legacyReviewsRoot(projectRoot);
  if (!(await pathExists(root))) return [];

  const logicalPaths: string[] = [];

  async function walk(dir: string, rel: string): Promise<void> {
    let entries;
    try {
      entries = await readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const ent of entries) {
      if (ent.isDirectory()) {
        const nextRel = rel ? `${rel}/${ent.name}` : ent.name;
        if (nextRel === "internal_queue" || nextRel === "client_queue") continue;
        await walk(join(dir, ent.name), nextRel);
      } else if (ent.name === "approval.json" && rel) {
        logicalPaths.push(rel);
      }
    }
  }

  await walk(root, "");
  return logicalPaths;
}

/** Auto-migrate if legacy reviews/ exists and new queue is empty. */
export async function ensureReviewQueueMigrated(projectRoot: string): Promise<MigrateReviewsResult | null> {
  if (!(await needsReviewMigration(projectRoot))) return null;
  return migrateLegacyReviews(projectRoot);
}
