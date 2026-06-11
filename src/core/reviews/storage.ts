import { readFile, writeFile, readdir, mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { pathExists, readJson, writeJson } from "../util/fs.js";
import {
  approvalJsonPath,
  approvalSnapshotPath,
  approvalHistoryPath,
  diffFilePath,
  queuePendingPath,
  queueResolvedPath,
  queueRejectedPath,
  queueFailedPath,
} from "./paths.js";
import type {
  ApprovalRecord,
  QueueIndex,
  QueueEntry,
  DiffFile,
  HistoryLine,
  OverallStatus,
} from "./types.js";

// ── Approval ──────────────────────────────────────────────────────────────────

export async function getApproval(
  projectRoot: string,
  logicalPath: string,
): Promise<ApprovalRecord | null> {
  const p = join(projectRoot, approvalJsonPath(logicalPath));
  if (!(await pathExists(p))) return null;
  return readJson<ApprovalRecord>(p);
}

export async function saveApproval(
  projectRoot: string,
  record: ApprovalRecord,
): Promise<void> {
  await writeJson(join(projectRoot, approvalJsonPath(record.logicalPath)), record);
}

export function makeApproval(logicalPath: string, contentHash: string): ApprovalRecord {
  return {
    version: 1,
    logicalPath,
    contentHash,
    overallStatus: "pending_internal",
    internal: { status: "pending", approvedAt: null, approvedBy: null, invalidatedAt: null },
    client: { status: "pending", approvedAt: null, comment: null },
  };
}

export function deriveOverallStatus(record: ApprovalRecord): OverallStatus {
  if (record.client.status === "rejected") return "rejected";
  if (record.internal.status !== "approved") return "pending_internal";
  if (record.client.status !== "approved") return "pending_client";
  return "approved";
}

// ── Snapshot ──────────────────────────────────────────────────────────────────

export async function readSnapshot(
  projectRoot: string,
  logicalPath: string,
): Promise<string | null> {
  const p = join(projectRoot, approvalSnapshotPath(logicalPath));
  if (!(await pathExists(p))) return null;
  return readFile(p, "utf8");
}

export async function writeSnapshot(
  projectRoot: string,
  logicalPath: string,
  content: string,
): Promise<void> {
  const p = join(projectRoot, approvalSnapshotPath(logicalPath));
  await mkdir(dirname(p), { recursive: true });
  await writeFile(p, content, "utf8");
}

// ── History ───────────────────────────────────────────────────────────────────

export async function appendHistory(
  projectRoot: string,
  logicalPath: string,
  line: HistoryLine,
): Promise<void> {
  const p = join(projectRoot, approvalHistoryPath(logicalPath));
  await mkdir(dirname(p), { recursive: true });
  await writeFile(p, `${JSON.stringify(line)}\n`, { flag: "a" });
}

// ── Queue index ───────────────────────────────────────────────────────────────

const EMPTY_INDEX: QueueIndex = { version: 1, entries: [] };

export async function loadQueueIndex(
  projectRoot: string,
  track: "internal" | "client",
  kind: "pending" | "resolved" | "rejected" | "failed",
): Promise<QueueIndex> {
  let p: string;
  if (kind === "pending") p = queuePendingPath(track);
  else if (kind === "resolved") p = queueResolvedPath(track);
  else if (kind === "rejected") p = queueRejectedPath(track);
  else p = queueFailedPath();

  const abs = join(projectRoot, p);
  if (!(await pathExists(abs))) return { ...EMPTY_INDEX };
  return readJson<QueueIndex>(abs).catch(() => ({ ...EMPTY_INDEX }));
}

export async function saveQueueIndex(
  projectRoot: string,
  track: "internal" | "client",
  kind: "pending" | "resolved" | "rejected" | "failed",
  index: QueueIndex,
): Promise<void> {
  let p: string;
  if (kind === "pending") p = queuePendingPath(track);
  else if (kind === "resolved") p = queueResolvedPath(track);
  else if (kind === "rejected") p = queueRejectedPath(track);
  else p = queueFailedPath();

  await writeJson(join(projectRoot, p), index);
}

export async function addToQueue(
  projectRoot: string,
  track: "internal" | "client",
  entry: QueueEntry,
): Promise<void> {
  const idx = await loadQueueIndex(projectRoot, track, "pending");
  idx.entries = idx.entries.filter((e) => e.logicalPath !== entry.logicalPath);
  idx.entries.push(entry);
  await saveQueueIndex(projectRoot, track, "pending", idx);
}

export async function removeFromQueue(
  projectRoot: string,
  track: "internal" | "client",
  logicalPath: string,
): Promise<QueueEntry | null> {
  const idx = await loadQueueIndex(projectRoot, track, "pending");
  const found = idx.entries.find((e) => e.logicalPath === logicalPath) ?? null;
  if (found) {
    idx.entries = idx.entries.filter((e) => e.logicalPath !== logicalPath);
    await saveQueueIndex(projectRoot, track, "pending", idx);
  }
  return found;
}

export async function archiveQueueEntry(
  projectRoot: string,
  track: "internal" | "client",
  kind: "resolved" | "rejected" | "failed",
  entry: QueueEntry,
): Promise<void> {
  const idx = await loadQueueIndex(projectRoot, track, kind);
  idx.entries.push(entry);
  await saveQueueIndex(projectRoot, track, kind, idx);
}

// ── Diff file ─────────────────────────────────────────────────────────────────

export async function loadDiff(
  projectRoot: string,
  track: "internal" | "client",
  logicalPath: string,
): Promise<DiffFile | null> {
  const p = join(projectRoot, diffFilePath(track, logicalPath));
  if (!(await pathExists(p))) return null;
  return readJson<DiffFile>(p).catch(() => null);
}

export async function saveDiff(
  projectRoot: string,
  track: "internal" | "client",
  diff: DiffFile,
): Promise<void> {
  await writeJson(join(projectRoot, diffFilePath(track, diff.logicalPath)), diff);
}

export async function deleteDiff(
  projectRoot: string,
  track: "internal" | "client",
  logicalPath: string,
): Promise<void> {
  const { unlink } = await import("node:fs/promises");
  const p = join(projectRoot, diffFilePath(track, logicalPath));
  if (await pathExists(p)) await unlink(p);
}

// ── Discovery ─────────────────────────────────────────────────────────────────

export async function discoverApprovals(projectRoot: string): Promise<string[]> {
  const root = join(projectRoot, "reviews");
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
        // Skip queue dirs
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
