import { mkdir, unlink } from "node:fs/promises";
import { join } from "node:path";
import { readJson, writeJson } from "../util/fs.js";
import { fileChangesFileName } from "./paths.js";
import type {
  ChangeHistoryFile,
  DocType,
  FailedQueueFile,
  FailedTranslationJob,
  FileChangeRecord,
  FileChangesDocument,
  FingerprintsFile,
  PendingQueueFile,
  QueuePaths,
  ResolvedQueueFile,
  ResolvedTranslationJob,
  TranslationJob,
} from "./queue-types.js";

export function queuePaths(projectRoot: string): QueuePaths {
  const dir = join(projectRoot, ".ai-spector/.docflow/translation-queue");
  return {
    dir,
    fingerprints: join(dir, "fingerprints.json"),
    pending: join(dir, "pending.json"),
    resolved: join(dir, "resolved.json"),
    failed: join(dir, "failed.json"),
    changeHistory: join(dir, "change-history.json"),
    changesDir: join(dir, "changes"),
  };
}

export function fileChangesPath(
  paths: QueuePaths,
  docType: DocType,
  relativePath: string,
): string {
  return join(paths.changesDir, fileChangesFileName(docType, relativePath));
}

export async function ensureQueueDir(projectRoot: string): Promise<QueuePaths> {
  const paths = queuePaths(projectRoot);
  await mkdir(paths.dir, { recursive: true });
  await mkdir(paths.changesDir, { recursive: true });
  return paths;
}

const EMPTY_FINGERPRINTS: FingerprintsFile = { version: 1, files: {} };
const EMPTY_PENDING: PendingQueueFile = { version: 1, jobs: [] };
const EMPTY_RESOLVED: ResolvedQueueFile = { version: 1, jobs: [] };
const EMPTY_FAILED: FailedQueueFile = { version: 1, jobs: [] };
const EMPTY_CHANGE_HISTORY: ChangeHistoryFile = { version: 1, entries: [] };

export async function loadFingerprints(path: string): Promise<FingerprintsFile> {
  const raw = await readJson<
    Partial<FingerprintsFile & { sections?: Record<string, { hash: string; scannedAt: string }> }>
  >(path).catch(() => EMPTY_FINGERPRINTS);
  const files: FingerprintsFile["files"] = {};
  for (const [filePath, entry] of Object.entries(raw.files ?? {})) {
    files[filePath] = {
      hash: entry.hash,
      scannedAt: entry.scannedAt,
      version: entry.version ?? 1,
      content: entry.content,
    };
  }
  return { version: 1, files };
}

export async function loadChangeHistory(path: string): Promise<ChangeHistoryFile> {
  const raw = await readJson<Partial<ChangeHistoryFile>>(path).catch(() => EMPTY_CHANGE_HISTORY);
  return { version: 1, entries: Array.isArray(raw.entries) ? raw.entries : [] };
}

export async function appendChangeHistory(
  path: string,
  entries: Array<FileChangeRecord & { docType: DocType; relativePath: string; jobId?: string }>,
): Promise<void> {
  if (entries.length === 0) {
    return;
  }
  const history = await loadChangeHistory(path);
  history.entries.push(...entries);
  await writeJson(path, history);
}

type StoredPendingJob = Omit<TranslationJob, "changes"> & { changes?: FileChangeRecord[] };

export async function loadFileChangesDocument(
  paths: QueuePaths,
  docType: DocType,
  relativePath: string,
): Promise<FileChangesDocument | null> {
  const path = fileChangesPath(paths, docType, relativePath);
  const raw = await readJson<Partial<FileChangesDocument>>(path).catch(() => null);
  if (!raw || !Array.isArray(raw.changes)) {
    return null;
  }
  return {
    version: 1,
    docType,
    relativePath,
    jobId: raw.jobId ?? "",
    updatedAt: raw.updatedAt ?? "",
    changes: raw.changes,
  };
}

export async function saveFileChangesDocument(
  paths: QueuePaths,
  job: TranslationJob,
): Promise<void> {
  const doc: FileChangesDocument = {
    version: 1,
    docType: job.docType,
    relativePath: job.relativePath,
    jobId: job.id,
    updatedAt: job.updatedAt,
    changes: job.changes ?? [],
  };
  await writeJson(fileChangesPath(paths, job.docType, job.relativePath), doc);
}

export async function deleteFileChangesDocument(
  paths: QueuePaths,
  docType: DocType,
  relativePath: string,
): Promise<void> {
  const path = fileChangesPath(paths, docType, relativePath);
  await unlink(path).catch(() => undefined);
}

async function hydratePendingJobs(
  paths: QueuePaths,
  jobs: StoredPendingJob[],
): Promise<TranslationJob[]> {
  const hydrated: TranslationJob[] = [];
  for (const job of jobs) {
    const fileDoc = await loadFileChangesDocument(paths, job.docType, job.relativePath);
    hydrated.push({
      ...job,
      changes: fileDoc?.changes ?? job.changes ?? [],
    });
  }
  return hydrated;
}

function stripChangesForStore(jobs: TranslationJob[]): StoredPendingJob[] {
  return jobs.map(({ changes: _changes, ...job }) => job);
}

export async function loadPendingQueue(pathOrPaths: string | QueuePaths): Promise<PendingQueueFile> {
  const pendingPath = typeof pathOrPaths === "string" ? pathOrPaths : pathOrPaths.pending;
  const paths = typeof pathOrPaths === "string" ? undefined : pathOrPaths;
  const raw = await readJson<Partial<PendingQueueFile>>(pendingPath).catch(() => EMPTY_PENDING);
  const stored = Array.isArray(raw.jobs) ? (raw.jobs as StoredPendingJob[]) : [];
  const jobs = paths ? await hydratePendingJobs(paths, stored) : (stored as TranslationJob[]);
  return { version: 1, jobs };
}

export async function loadResolvedQueue(path: string): Promise<ResolvedQueueFile> {
  const raw = await readJson<Partial<ResolvedQueueFile>>(path).catch(() => EMPTY_RESOLVED);
  return { version: 1, jobs: Array.isArray(raw.jobs) ? raw.jobs : [] };
}

export async function loadFailedQueue(path: string): Promise<FailedQueueFile> {
  const raw = await readJson<Partial<FailedQueueFile>>(path).catch(() => EMPTY_FAILED);
  return { version: 1, jobs: Array.isArray(raw.jobs) ? raw.jobs : [] };
}

export async function saveFingerprints(path: string, data: FingerprintsFile): Promise<void> {
  await writeJson(path, data);
}

export async function savePendingQueue(
  pathOrPaths: string | QueuePaths,
  data: PendingQueueFile,
): Promise<void> {
  if (typeof pathOrPaths === "string") {
    await writeJson(pathOrPaths, data);
    return;
  }
  for (const job of data.jobs) {
    await saveFileChangesDocument(pathOrPaths, job);
  }
  await writeJson(pathOrPaths.pending, {
    version: 1,
    jobs: stripChangesForStore(data.jobs),
  });
}

export async function saveResolvedQueue(path: string, data: ResolvedQueueFile): Promise<void> {
  await writeJson(path, data);
}

export async function saveFailedQueue(path: string, data: FailedQueueFile): Promise<void> {
  await writeJson(path, data);
}

export async function moveJobToResolved(
  paths: QueuePaths,
  job: TranslationJob,
): Promise<void> {
  const pending = await loadPendingQueue(paths);
  const resolved = await loadResolvedQueue(paths.resolved);
  const now = new Date().toISOString();
  const syncedLangs = job.targets.filter((t) => t.status === "synced").map((t) => t.lang);
  const resolvedJob: ResolvedTranslationJob = {
    ...job,
    resolvedAt: now,
    syncedLangs,
  };
  pending.jobs = pending.jobs.filter((j) => j.id !== job.id);
  resolved.jobs.push(resolvedJob);
  await savePendingQueue(paths, pending);
  await deleteFileChangesDocument(paths, job.docType, job.relativePath);
  await saveResolvedQueue(paths.resolved, resolved);
}

export async function moveJobToFailed(
  paths: QueuePaths,
  job: TranslationJob,
  reason: FailedTranslationJob["reason"],
  message: string,
  changedLangs?: string[],
): Promise<void> {
  const pending = await loadPendingQueue(paths);
  const failed = await loadFailedQueue(paths.failed);
  const now = new Date().toISOString();
  const failedJob: FailedTranslationJob = {
    ...job,
    failedAt: now,
    reason,
    message,
    changedLangs,
  };
  pending.jobs = pending.jobs.filter((j) => j.id !== job.id);
  failed.jobs.push(failedJob);
  await savePendingQueue(paths, pending);
  await saveFailedQueue(paths.failed, failed);
}

export async function retryFailedJob(paths: QueuePaths, jobId: string): Promise<TranslationJob | null> {
  const failed = await loadFailedQueue(paths.failed);
  const pending = await loadPendingQueue(paths);
  const idx = failed.jobs.findIndex((j) => j.id === jobId);
  if (idx < 0) {
    return null;
  }
  const failedJob = failed.jobs[idx]!;
  const now = new Date().toISOString();
  const fileDoc = await loadFileChangesDocument(
    paths,
    failedJob.docType,
    failedJob.relativePath,
  );
  const job: TranslationJob = {
    id: failedJob.id,
    docType: failedJob.docType,
    relativePath: failedJob.relativePath,
    direction: failedJob.direction,
    origin: failedJob.origin,
    targets: failedJob.targets.map((t) => ({
      ...t,
      status: "pending" as const,
      syncedAt: undefined,
      hash: undefined,
    })),
    changes: fileDoc?.changes ?? failedJob.changes ?? [],
    createdAt: failedJob.createdAt,
    updatedAt: now,
  };
  failed.jobs.splice(idx, 1);
  const existing = pending.jobs.findIndex((j) => j.id === jobId);
  if (existing >= 0) {
    pending.jobs[existing] = job;
  } else {
    pending.jobs.push(job);
  }
  await saveFailedQueue(paths.failed, failed);
  await savePendingQueue(paths, pending);
  return job;
}
