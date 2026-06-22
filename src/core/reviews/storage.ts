import { readFile, writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { pathExists, readJson, writeJson } from "../util/fs.js";
import {
  reviewQueuePaths,
  legacyReviewQueuePaths,
  reviewQueuePathsFromRel,
  resolveReviewQueueWriteRoots,
  snapshotPath,
  changePath,
  legacyApprovalJsonPath,
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
import type { DocAnchor, EnrichmentCache } from "../sync/drift-types.js";
import { jobToQueueEntry, reviewJobId } from "./types.js";

import { emptyClientTrack, emptyInternalTrack } from "./votes.js";
import {
  approvalNeedsNormalization,
  normalizeApprovalRecord,
} from "./normalize.js";

const EMPTY_REGISTRY: RegistryFile = { version: 3, documents: {} };
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

async function queuePathsForRead(
  projectRoot: string,
  filePick: (paths: ReviewQueuePaths) => string = (paths) => paths.registry,
): Promise<ReviewQueuePaths> {
  const primary = reviewQueuePaths(projectRoot);
  if (await pathExists(filePick(primary))) {
    return primary;
  }
  const legacy = legacyReviewQueuePaths(projectRoot);
  if (await pathExists(filePick(legacy))) {
    return legacy;
  }
  return primary;
}

async function writeQueueJson(
  projectRoot: string,
  pickPath: (paths: ReviewQueuePaths) => string,
  data: unknown,
): Promise<void> {
  const roots = resolveReviewQueueWriteRoots();
  const primary = reviewQueuePathsFromRel(roots.primary, projectRoot);
  const legacy = roots.legacy ? reviewQueuePathsFromRel(roots.legacy, projectRoot) : undefined;
  await ensureQueueDirs(primary);
  await writeJson(pickPath(primary), data);
  if (legacy) {
    await ensureQueueDirs(legacy);
    await writeJson(pickPath(legacy), data);
  }
}

export async function loadRegistry(projectRoot: string): Promise<RegistryFile> {
  const paths = await queuePathsForRead(projectRoot);
  if (!(await pathExists(paths.registry))) return { ...EMPTY_REGISTRY };
  const raw = await readJson<Partial<RegistryFile>>(paths.registry).catch(() => EMPTY_REGISTRY);
  const documents: Record<string, ApprovalRecord> = {};
  let dirty = false;

  for (const [logicalPath, record] of Object.entries(raw.documents ?? {})) {
    if (approvalNeedsNormalization(record)) dirty = true;
    documents[logicalPath] = normalizeApprovalRecord({ ...record, logicalPath });
  }

  const registry: RegistryFile = { version: 3, documents };
  if (dirty) {
    await saveRegistry(projectRoot, registry);
  }
  return registry;
}

export async function saveRegistry(projectRoot: string, registry: RegistryFile): Promise<void> {
  await writeQueueJson(projectRoot, (paths) => paths.registry, registry);
}

export async function loadFingerprints(projectRoot: string): Promise<FingerprintsFile> {
  const paths = await queuePathsForRead(projectRoot, (p) => p.fingerprints);
  if (!(await pathExists(paths.fingerprints))) return { ...EMPTY_FINGERPRINTS };
  return readJson<FingerprintsFile>(paths.fingerprints).catch(() => ({ ...EMPTY_FINGERPRINTS }));
}

export async function saveFingerprints(projectRoot: string, fingerprints: FingerprintsFile): Promise<void> {
  await writeQueueJson(projectRoot, (paths) => paths.fingerprints, fingerprints);
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
  const paths = await queuePathsForRead(projectRoot, (p) => p.pending);
  if (!(await pathExists(paths.pending))) return { ...EMPTY_PENDING };
  return readJson<PendingQueueFile>(paths.pending).catch(() => ({ ...EMPTY_PENDING }));
}

async function savePending(projectRoot: string, pending: PendingQueueFile): Promise<void> {
  await writeQueueJson(projectRoot, (paths) => paths.pending, pending);
}

// ── Approval ──────────────────────────────────────────────────────────────────

export async function getApproval(
  projectRoot: string,
  logicalPath: string,
): Promise<ApprovalRecord | null> {
  const registry = await loadRegistry(projectRoot);
  const fromRegistry = registry.documents[logicalPath];
  if (fromRegistry) return fromRegistry;

  const legacyPath = join(projectRoot, legacyApprovalJsonPath(logicalPath));
  if (await pathExists(legacyPath)) {
    const record = await readJson<ApprovalRecord>(legacyPath).catch(() => null);
    if (record) return normalizeApprovalRecord({ ...record, logicalPath, version: 3 });
  }
  return null;
}

export async function saveApproval(
  projectRoot: string,
  record: ApprovalRecord,
): Promise<void> {
  const registry = await loadRegistry(projectRoot);
  registry.documents[record.logicalPath] = normalizeApprovalRecord(record);
  await saveRegistry(projectRoot, registry);
}

export function makeApproval(logicalPath: string, contentHash: string, docPath?: string): ApprovalRecord {
  return {
    version: 3,
    logicalPath,
    docPath,
    contentHash,
    overallStatus: "pending_internal",
    internal: emptyInternalTrack(),
    client: emptyClientTrack(),
  };
}

export function deriveOverallStatus(record: ApprovalRecord): OverallStatus {
  if (record.internal.status === "rejected" || record.client.status === "rejected") return "rejected";
  if (record.internal.status !== "approved") return "pending_internal";
  if (record.client.status !== "approved") return "pending_client";
  return "approved";
}

// ── Snapshot ──────────────────────────────────────────────────────────────────

export async function readSnapshot(
  projectRoot: string,
  logicalPath: string,
): Promise<string | null> {
  const paths = await queuePathsForRead(projectRoot, (p) => snapshotPath(p, logicalPath));
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
  const roots = resolveReviewQueueWriteRoots();
  const primaryPaths = reviewQueuePathsFromRel(roots.primary, projectRoot);
  const legacyPaths = roots.legacy
    ? reviewQueuePathsFromRel(roots.legacy, projectRoot)
    : undefined;
  const rel = join(roots.primary, "snapshots", `${logicalPath.replace(/\//g, "__")}.md`).replace(
    /\\/g,
    "/",
  );
  const abs = join(projectRoot, rel);
  await mkdir(primaryPaths.snapshots, { recursive: true });
  await writeFile(abs, content, "utf8");
  if (legacyPaths) {
    const legacyAbs = snapshotPath(legacyPaths, logicalPath);
    await mkdir(legacyPaths.snapshots, { recursive: true });
    await writeFile(legacyAbs, content, "utf8");
  }
  return rel;
}

export async function deleteSnapshot(
  projectRoot: string,
  logicalPath: string,
): Promise<void> {
  const { unlink } = await import("node:fs/promises");
  const paths = reviewQueuePaths(projectRoot);
  const approval = await getApproval(projectRoot, logicalPath);
  const candidates = new Set<string>();
  if (approval?.snapshotRef) {
    candidates.add(join(projectRoot, approval.snapshotRef).replace(/\\/g, "/"));
  }
  candidates.add(join(projectRoot, snapshotPath(paths, logicalPath)).replace(/\\/g, "/"));

  for (const p of candidates) {
    if (await pathExists(p)) {
      await unlink(p);
    }
  }

  if (approval?.snapshotRef) {
    approval.snapshotRef = undefined;
    await saveApproval(projectRoot, approval);
  }
}

/** Remove legacy diff files and optionally snapshot on queue resolve. */
export async function purgeReviewLegacyOnResolve(
  projectRoot: string,
  logicalPath: string,
  opts: { deleteSnapshot?: boolean } = {},
): Promise<void> {
  if (opts.deleteSnapshot) {
    await deleteSnapshot(projectRoot, logicalPath);
  }
  await deleteDiff(projectRoot, "internal", logicalPath);
  await deleteDiff(projectRoot, "client", logicalPath);
}

// ── History ───────────────────────────────────────────────────────────────────

export async function appendHistory(
  projectRoot: string,
  logicalPath: string,
  line: HistoryLine,
): Promise<void> {
  const roots = resolveReviewQueueWriteRoots();
  const entry: HistoryLine = { ...line, logicalPath };
  const payload = `${JSON.stringify(entry)}\n`;
  const primary = reviewQueuePathsFromRel(roots.primary, projectRoot);
  await ensureQueueDirs(primary);
  await writeFile(primary.history, payload, { flag: "a" });
  if (roots.legacy) {
    const legacy = reviewQueuePathsFromRel(roots.legacy, projectRoot);
    await ensureQueueDirs(legacy);
    await writeFile(legacy.history, payload, { flag: "a" });
  }
}

export async function readHistory(
  projectRoot: string,
  logicalPath: string,
  opts?: { limit?: number; since?: string },
): Promise<HistoryLine[]> {
  const paths = await queuePathsForRead(projectRoot, (p) => p.history);
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

  const paths = await queuePathsForRead(
    projectRoot,
    (p) => archivePath(p, track, kind),
  );
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

  await writeQueueJson(projectRoot, (paths) => archivePath(paths, track, kind), index);
}

export interface QueueEntryExtras {
  baselineAnchor?: DocAnchor;
  enrichment?: EnrichmentCache;
}

export async function addToQueue(
  projectRoot: string,
  track: "internal" | "client",
  entry: QueueEntry,
  extras?: QueueEntryExtras,
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
    baselineAnchor: extras?.baselineAnchor,
    enrichment: extras?.enrichment,
  });
  await savePending(projectRoot, pending);
}

export async function updatePendingJobEnrichment(
  projectRoot: string,
  track: ReviewTrack,
  logicalPath: string,
  enrichment: EnrichmentCache,
): Promise<void> {
  const pending = await loadPending(projectRoot);
  const id = reviewJobId(logicalPath, track);
  const job = pending.jobs.find((j) => j.id === id);
  if (!job) return;
  job.enrichment = enrichment;
  await savePending(projectRoot, pending);
}

export async function findPendingJob(
  projectRoot: string,
  track: ReviewTrack,
  logicalPath: string,
): Promise<ReviewJob | null> {
  const pending = await loadPending(projectRoot);
  const id = reviewJobId(logicalPath, track);
  return pending.jobs.find((j) => j.id === id) ?? null;
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
  const paths = await queuePathsForRead(projectRoot, (p) => changePath(p, logicalPath));
  const p = changePath(paths, logicalPath);
  if (!(await pathExists(p))) return null;
  return readJson<DiffFile>(p).catch(() => null);
}

export async function saveDiff(
  projectRoot: string,
  _track: "internal" | "client",
  diff: DiffFile,
): Promise<void> {
  await writeQueueJson(projectRoot, (paths) => changePath(paths, diff.logicalPath), diff);
}

export async function deleteDiff(
  projectRoot: string,
  _track: "internal" | "client",
  logicalPath: string,
): Promise<void> {
  const { unlink } = await import("node:fs/promises");
  const roots = resolveReviewQueueWriteRoots();
  const targets = [
    reviewQueuePathsFromRel(roots.primary, projectRoot),
    ...(roots.legacy ? [reviewQueuePathsFromRel(roots.legacy, projectRoot)] : []),
  ];
  for (const paths of targets) {
    const p = changePath(paths, logicalPath);
    if (await pathExists(p)) {
      await unlink(p);
    }
  }
}

// ── Discovery ─────────────────────────────────────────────────────────────────

export async function discoverApprovals(projectRoot: string): Promise<string[]> {
  const registry = await loadRegistry(projectRoot);
  const paths = new Set(Object.keys(registry.documents));

  const legacyRoot = join(projectRoot, "reviews");
  if (await pathExists(legacyRoot)) {
    const { readdir } = await import("node:fs/promises");
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
          paths.add(rel);
        }
      }
    }
    await walk(legacyRoot, "");
  }

  return [...paths].sort();
}

export async function reviewQueueInitialized(projectRoot: string): Promise<boolean> {
  const paths = reviewQueuePaths(projectRoot);
  return pathExists(paths.registry);
}
