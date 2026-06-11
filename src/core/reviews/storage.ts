import { readFile, writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { pathExists, readJson, writeJson } from "../util/fs.js";
import {
  reviewQueuePaths,
  snapshotPath,
  changePath,
  type ReviewQueuePaths,
} from "./paths.js";
import type {
  ApprovalRecord,
  QueueIndex,
  QueueEntry,
  DiffFile,
  HistoryLine,
  OverallStatus,
  ReviewTrack,
  FingerprintsFile,
  RegistryFile,
  PendingQueueFile,
  ReviewJob,
  ReviewFingerprint,
} from "./types.js";
import { jobToQueueEntry, reviewJobId } from "./types.js";

const EMPTY_REGISTRY: RegistryFile = { version: 2, documents: {} };
const EMPTY_FINGERPRINTS: FingerprintsFile = { version: 1, files: {} };
const EMPTY_PENDING: PendingQueueFile = { version: 2, jobs: [] };
const EMPTY_INDEX: QueueIndex = { version: 1, entries: [] };

function archivePath(paths: ReviewQueuePaths, track: ReviewTrack, kind: "resolved" | "rejected" | "failed"): string {
  if (track === "internal") {
    if (kind === "resolved") return paths.internalResolved;
    if (kind === "rejected") return paths.internalRejected;
    return paths.internalFailed;
  }
  if (kind === "resolved") return paths.clientResolved;
  return paths.clientRejected;
}

async function ensureQueueDirs(paths: ReviewQueuePaths): Promise<void> {
  await mkdir(paths.dir, { recursive: true });
  await mkdir(paths.snapshots, { recursive: true });
  await mkdir(paths.changes, { recursive: true });
}

export async function loadRegistry(projectRoot: string): Promise<RegistryFile> {
  const paths = reviewQueuePaths(projectRoot);
  if (!(await pathExists(paths.registry))) return { ...EMPTY_REGISTRY };
  const raw = await readJson<Partial<RegistryFile>>(paths.registry).catch(() => EMPTY_REGISTRY);
  return { version: 2, documents: raw.documents ?? {} };
}

export async function saveRegistry(projectRoot: string, registry: RegistryFile): Promise<void> {
  const paths = reviewQueuePaths(projectRoot);
  await ensureQueueDirs(paths);
  await writeJson(paths.registry, registry);
}

export async function loadFingerprints(projectRoot: string): Promise<FingerprintsFile> {
  const paths = reviewQueuePaths(projectRoot);
  if (!(await pathExists(paths.fingerprints))) return { ...EMPTY_FINGERPRINTS };
  return readJson<FingerprintsFile>(paths.fingerprints).catch(() => ({ ...EMPTY_FINGERPRINTS }));
}

export async function saveFingerprints(projectRoot: string, fingerprints: FingerprintsFile): Promise<void> {
  const paths = reviewQueuePaths(projectRoot);
  await ensureQueueDirs(paths);
  await writeJson(paths.fingerprints, fingerprints);
}

export async function updateFingerprint(
  projectRoot: string,
  logicalPath: string,
  fp: ReviewFingerprint,
): Promise<void> {
  const fingerprints = await loadFingerprints(projectRoot);
  fingerprints.files[logicalPath] = fp;
  await saveFingerprints(projectRoot, fingerprints);
}

async function loadPending(projectRoot: string): Promise<PendingQueueFile> {
  const paths = reviewQueuePaths(projectRoot);
  if (!(await pathExists(paths.pending))) return { ...EMPTY_PENDING };
  return readJson<PendingQueueFile>(paths.pending).catch(() => ({ ...EMPTY_PENDING }));
}

async function savePending(projectRoot: string, pending: PendingQueueFile): Promise<void> {
  const paths = reviewQueuePaths(projectRoot);
  await ensureQueueDirs(paths);
  await writeJson(paths.pending, pending);
}

// ── Approval ──────────────────────────────────────────────────────────────────

export async function getApproval(
  projectRoot: string,
  logicalPath: string,
): Promise<ApprovalRecord | null> {
  const registry = await loadRegistry(projectRoot);
  return registry.documents[logicalPath] ?? null;
}

export async function saveApproval(
  projectRoot: string,
  record: ApprovalRecord,
): Promise<void> {
  const registry = await loadRegistry(projectRoot);
  registry.documents[record.logicalPath] = { ...record, version: 2 };
  await saveRegistry(projectRoot, registry);
}

export function makeApproval(logicalPath: string, contentHash: string, docPath?: string): ApprovalRecord {
  return {
    version: 2,
    logicalPath,
    docPath,
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
  const paths = reviewQueuePaths(projectRoot);
  const approval = await getApproval(projectRoot, logicalPath);
  const p = approval?.snapshotRef
    ? join(projectRoot, approval.snapshotRef).replace(/\\/g, "/")
    : snapshotPath(paths, logicalPath);
  if (!(await pathExists(p))) return null;
  return readFile(p, "utf8");
}

export async function writeSnapshot(
  projectRoot: string,
  logicalPath: string,
  content: string,
): Promise<string> {
  const paths = reviewQueuePaths(projectRoot);
  await ensureQueueDirs(paths);
  const rel = join(".ai-spector/.docflow/review-queue/snapshots", `${logicalPath.replace(/\//g, "__")}.md`);
  const abs = join(projectRoot, rel);
  await mkdir(join(projectRoot, paths.snapshots), { recursive: true });
  await writeFile(abs, content, "utf8");
  return rel.replace(/\\/g, "/");
}

// ── History ───────────────────────────────────────────────────────────────────

export async function appendHistory(
  projectRoot: string,
  logicalPath: string,
  line: HistoryLine,
): Promise<void> {
  const paths = reviewQueuePaths(projectRoot);
  await ensureQueueDirs(paths);
  const entry: HistoryLine = { ...line, logicalPath };
  await writeFile(paths.history, `${JSON.stringify(entry)}\n`, { flag: "a" });
}

export async function readHistory(
  projectRoot: string,
  logicalPath: string,
  opts?: { limit?: number; since?: string },
): Promise<HistoryLine[]> {
  const paths = reviewQueuePaths(projectRoot);
  if (!(await pathExists(paths.history))) return [];

  const content = await readFile(paths.history, "utf8");
  let lines = content
    .split("\n")
    .filter(Boolean)
    .map((l) => JSON.parse(l) as HistoryLine)
    .filter((l) => l.logicalPath === logicalPath);

  if (opts?.since) {
    lines = lines.filter((l) => l.at >= opts.since!);
  }
  if (opts?.limit !== undefined && opts.limit >= 0) {
    lines = lines.slice(-opts.limit);
  }
  return lines;
}

// ── Queue index ───────────────────────────────────────────────────────────────

export async function loadQueueIndex(
  projectRoot: string,
  track: "internal" | "client",
  kind: "pending" | "resolved" | "rejected" | "failed",
): Promise<QueueIndex> {
  if (kind === "pending") {
    const pending = await loadPending(projectRoot);
    const entries = pending.jobs
      .filter((j) => j.track === track)
      .map(jobToQueueEntry);
    return { version: 1, entries };
  }

  const paths = reviewQueuePaths(projectRoot);
  const p = archivePath(paths, track, kind);
  if (!(await pathExists(p))) return { ...EMPTY_INDEX };
  return readJson<QueueIndex>(p).catch(() => ({ ...EMPTY_INDEX }));
}

export async function saveQueueIndex(
  projectRoot: string,
  track: "internal" | "client",
  kind: "pending" | "resolved" | "rejected" | "failed",
  index: QueueIndex,
): Promise<void> {
  if (kind === "pending") {
    const pending = await loadPending(projectRoot);
    const otherJobs = pending.jobs.filter((j) => j.track !== track);
    const newJobs: ReviewJob[] = index.entries.map((e) => ({
      id: reviewJobId(e.logicalPath, track),
      logicalPath: e.logicalPath,
      track,
      reason: e.reason,
      queuedAt: e.queuedAt,
      baselineHash: e.approvedHash,
      currentHash: e.currentHash,
    }));
    pending.jobs = [...otherJobs, ...newJobs];
    await savePending(projectRoot, pending);
    return;
  }

  const paths = reviewQueuePaths(projectRoot);
  await ensureQueueDirs(paths);
  await writeJson(archivePath(paths, track, kind), index);
}

export async function addToQueue(
  projectRoot: string,
  track: "internal" | "client",
  entry: QueueEntry,
): Promise<void> {
  const pending = await loadPending(projectRoot);
  const id = reviewJobId(entry.logicalPath, track);
  pending.jobs = pending.jobs.filter((j) => j.id !== id);
  pending.jobs.push({
    id,
    logicalPath: entry.logicalPath,
    track,
    reason: entry.reason,
    queuedAt: entry.queuedAt,
    baselineHash: entry.approvedHash,
    currentHash: entry.currentHash,
  });
  await savePending(projectRoot, pending);
}

export async function removeFromQueue(
  projectRoot: string,
  track: "internal" | "client",
  logicalPath: string,
): Promise<QueueEntry | null> {
  const pending = await loadPending(projectRoot);
  const id = reviewJobId(logicalPath, track);
  const found = pending.jobs.find((j) => j.id === id) ?? null;
  if (found) {
    pending.jobs = pending.jobs.filter((j) => j.id !== id);
    await savePending(projectRoot, pending);
    return jobToQueueEntry(found);
  }
  return null;
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
  const paths = reviewQueuePaths(projectRoot);
  const p = changePath(paths, logicalPath);
  if (!(await pathExists(p))) return null;
  return readJson<DiffFile>(p).catch(() => null);
}

export async function saveDiff(
  projectRoot: string,
  _track: "internal" | "client",
  diff: DiffFile,
): Promise<void> {
  const paths = reviewQueuePaths(projectRoot);
  await ensureQueueDirs(paths);
  await writeJson(changePath(paths, diff.logicalPath), diff);
}

export async function deleteDiff(
  projectRoot: string,
  _track: "internal" | "client",
  logicalPath: string,
): Promise<void> {
  const { unlink } = await import("node:fs/promises");
  const paths = reviewQueuePaths(projectRoot);
  const p = changePath(paths, logicalPath);
  if (await pathExists(p)) await unlink(p);
}

// ── Discovery ─────────────────────────────────────────────────────────────────

export async function discoverApprovals(projectRoot: string): Promise<string[]> {
  const registry = await loadRegistry(projectRoot);
  return Object.keys(registry.documents).sort();
}

export async function reviewQueueInitialized(projectRoot: string): Promise<boolean> {
  const paths = reviewQueuePaths(projectRoot);
  return pathExists(paths.registry);
}
