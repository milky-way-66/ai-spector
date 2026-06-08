import { mkdir, rename, unlink } from "node:fs/promises";
import { basename, join } from "node:path";
import { pathExists, readJson, writeJson } from "../util/fs.js";
import {
  dateFolder,
  failedJobFileName,
  historyEntryFileName,
  jobIdMatchesFileName,
  listJsonFilesRecursive,
  resolvedJobFileName,
} from "./queue-layout.js";
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
    resolved: join(dir, "resolved"),
    failed: join(dir, "failed"),
    changeHistory: join(dir, "history"),
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

async function ensureArchiveDirs(paths: QueuePaths): Promise<void> {
  await mkdir(paths.resolved, { recursive: true });
  await mkdir(paths.failed, { recursive: true });
  await mkdir(paths.changeHistory, { recursive: true });
  await mkdir(paths.changesDir, { recursive: true });
}

/** One-time migration from monolithic resolved/failed/history JSON files. */
async function migrateLegacyQueueFiles(paths: QueuePaths): Promise<void> {
  await ensureArchiveDirs(paths);

  const legacyResolved = join(paths.dir, "resolved.json");
  if (await pathExists(legacyResolved)) {
    const raw = await readJson<Partial<ResolvedQueueFile>>(legacyResolved).catch(() => null);
    for (const job of raw?.jobs ?? []) {
      await writeResolvedJob(paths, job);
    }
    await rename(legacyResolved, `${legacyResolved}.migrated`).catch(() => undefined);
  }

  const legacyFailed = join(paths.dir, "failed.json");
  if (await pathExists(legacyFailed)) {
    const raw = await readJson<Partial<FailedQueueFile>>(legacyFailed).catch(() => null);
    for (const job of raw?.jobs ?? []) {
      await writeFailedJob(paths, job);
    }
    await rename(legacyFailed, `${legacyFailed}.migrated`).catch(() => undefined);
  }

  const legacyHistory = join(paths.dir, "change-history.json");
  if (await pathExists(legacyHistory)) {
    const raw = await readJson<Partial<ChangeHistoryFile>>(legacyHistory).catch(() => null);
    for (const entry of raw?.entries ?? []) {
      const outDir = join(paths.changeHistory, dateFolder(entry.changedAt));
      const fileName = historyEntryFileName(
        entry.changedAt,
        entry.sequence,
        entry.lang,
        entry.jobId,
      );
      await writeJson(join(outDir, fileName), { version: 1, entry });
    }
    await rename(legacyHistory, `${legacyHistory}.migrated`).catch(() => undefined);
  }
}

export async function ensureQueueDir(projectRoot: string): Promise<QueuePaths> {
  const paths = queuePaths(projectRoot);
  await mkdir(paths.dir, { recursive: true });
  await migrateLegacyQueueFiles(paths);
  return paths;
}

const EMPTY_FINGERPRINTS: FingerprintsFile = { version: 1, files: {} };
const EMPTY_PENDING: PendingQueueFile = { version: 1, jobs: [] };

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

export async function loadChangeHistory(dir: string): Promise<ChangeHistoryFile> {
  const files = await listJsonFilesRecursive(dir);
  const entries: ChangeHistoryFile["entries"] = [];
  for (const file of files) {
    const raw = await readJson<{ entry?: ChangeHistoryFile["entries"][number] }>(file).catch(
      () => null,
    );
    if (raw?.entry) {
      entries.push(raw.entry);
    }
  }
  entries.sort((a, b) => {
    const time = a.changedAt.localeCompare(b.changedAt);
    if (time !== 0) return time;
    return a.sequence - b.sequence;
  });
  return { version: 1, entries };
}

export async function appendChangeHistory(
  dir: string,
  entries: Array<FileChangeRecord & { docType: DocType; relativePath: string; jobId?: string }>,
): Promise<void> {
  if (entries.length === 0) {
    return;
  }
  await mkdir(dir, { recursive: true });
  for (const entry of entries) {
    const outDir = join(dir, dateFolder(entry.changedAt));
    const fileName = historyEntryFileName(
      entry.changedAt,
      entry.sequence,
      entry.lang,
      entry.jobId,
    );
    await writeJson(join(outDir, fileName), { version: 1, entry });
  }
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

async function loadArchivedJobs<T>(dir: string): Promise<T[]> {
  const files = await listJsonFilesRecursive(dir);
  const jobs: T[] = [];
  for (const file of files) {
    const raw = await readJson<{ job?: T } & T>(file).catch(() => null);
    if (!raw) continue;
    if (raw.job) {
      jobs.push(raw.job);
    } else if (typeof (raw as { id?: string }).id === "string") {
      jobs.push(raw as T);
    }
  }
  return jobs;
}

function sortByIso<T>(jobs: T[], field: keyof T): T[] {
  return [...jobs].sort((a, b) =>
    String(a[field] ?? "").localeCompare(String(b[field] ?? "")),
  );
}

export async function loadResolvedQueue(dir: string): Promise<ResolvedQueueFile> {
  const jobs = sortByIso(
    await loadArchivedJobs<ResolvedTranslationJob>(dir),
    "resolvedAt",
  );
  return { version: 1, jobs };
}

export async function loadFailedQueue(dir: string): Promise<FailedQueueFile> {
  const jobs = sortByIso(await loadArchivedJobs<FailedTranslationJob>(dir), "failedAt");
  return { version: 1, jobs };
}

async function writeResolvedJob(paths: QueuePaths, job: ResolvedTranslationJob): Promise<void> {
  const outDir = join(paths.resolved, dateFolder(job.resolvedAt));
  const fileName = resolvedJobFileName(job.resolvedAt, job.id);
  await writeJson(join(outDir, fileName), { version: 1, job });
}

async function writeFailedJob(paths: QueuePaths, job: FailedTranslationJob): Promise<void> {
  const outDir = join(paths.failed, dateFolder(job.failedAt));
  const fileName = failedJobFileName(job.failedAt, job.id);
  await writeJson(join(outDir, fileName), { version: 1, job });
}

async function findArchivedJobFile(
  dir: string,
  jobId: string,
): Promise<string | null> {
  const files = await listJsonFilesRecursive(dir);
  for (const file of files) {
    if (jobIdMatchesFileName(basename(file), jobId)) {
      return file;
    }
  }
  return null;
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

export async function moveJobToResolved(
  paths: QueuePaths,
  job: TranslationJob,
): Promise<void> {
  const pending = await loadPendingQueue(paths);
  const now = new Date().toISOString();
  const syncedLangs = job.targets.filter((t) => t.status === "synced").map((t) => t.lang);
  const resolvedJob: ResolvedTranslationJob = {
    ...job,
    resolvedAt: now,
    syncedLangs,
  };
  pending.jobs = pending.jobs.filter((j) => j.id !== job.id);
  await savePendingQueue(paths, pending);
  await deleteFileChangesDocument(paths, job.docType, job.relativePath);
  await writeResolvedJob(paths, resolvedJob);
}

export async function moveJobToFailed(
  paths: QueuePaths,
  job: TranslationJob,
  reason: FailedTranslationJob["reason"],
  message: string,
  changedLangs?: string[],
): Promise<void> {
  const pending = await loadPendingQueue(paths);
  const now = new Date().toISOString();
  const failedJob: FailedTranslationJob = {
    ...job,
    failedAt: now,
    reason,
    message,
    changedLangs,
  };
  pending.jobs = pending.jobs.filter((j) => j.id !== job.id);
  await savePendingQueue(paths, pending);
  await writeFailedJob(paths, failedJob);
}

export async function retryFailedJob(paths: QueuePaths, jobId: string): Promise<TranslationJob | null> {
  const failedFile = await findArchivedJobFile(paths.failed, jobId);
  if (!failedFile) {
    return null;
  }
  const raw = await readJson<{ job: FailedTranslationJob }>(failedFile);
  const failedJob = raw.job;
  const pending = await loadPendingQueue(paths);
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
  await unlink(failedFile).catch(() => undefined);
  const existing = pending.jobs.findIndex((j) => j.id === jobId || j.id.startsWith(jobId));
  if (existing >= 0) {
    pending.jobs[existing] = job;
  } else {
    pending.jobs.push(job);
  }
  await savePendingQueue(paths, pending);
  return job;
}
