import { randomUUID } from "node:crypto";
import { stat } from "node:fs/promises";
import { resolve } from "node:path";
import { primaryLanguage } from "../config/load.js";
import type { DocflowConfig } from "../config/types.js";
import { discoverMarkdownFiles } from "../index/docs-build.js";
import { resolveGitRef } from "../sync/git-diff.js";
import type { DocAnchor } from "../sync/drift-types.js";
import type {
  DocType,
  FailedTranslationJob,
  FileChangeRecord,
  FingerprintsFile,
  ReconcileResult,
  SyncDirection,
  TranslationJob,
  TranslationTarget,
} from "./queue-types.js";
import {
  appendChangeHistory,
  ensureQueueDir,
  loadFingerprints,
  loadPendingQueue,
  moveJobToFailed,
  moveJobToResolved,
  queuePaths,
  saveFingerprints,
  savePendingQueue,
} from "./queue-store.js";
import {
  jobGroupKey,
  parseDocFilePath,
  parseJobGroupKey,
  resolveDocPath,
} from "./paths.js";

export { queuePaths } from "./queue-store.js";
export type { ReconcileResult } from "./queue-types.js";

interface FileScan {
  docType: DocType;
  lang: string;
  relativePath: string;
  filePath: string;
  hash: string;
  mtimeMs: number;
}

interface FileChange {
  docType: DocType;
  relativePath: string;
  lang: string;
  filePath: string;
  hash: string;
  previousHash: string;
  previousVersion: number;
  version: number;
  mtimeMs: number;
  anchor: DocAnchor;
}

const DOC_TYPES: DocType[] = ["srs", "basic-design"];

export async function reconcileTranslationQueue(
  projectRoot: string,
  config: DocflowConfig,
): Promise<ReconcileResult> {
  if (config.languages.length < 2) {
    return {
      skipped: true,
      skipReason: "single language",
      enqueued: 0,
      resolved: 0,
      failed: 0,
      pendingCount: 0,
    };
  }

  const root = resolve(projectRoot);
  const paths = await ensureQueueDir(root);
  const fingerprints = await loadFingerprints(paths.fingerprints);
  const pending = await loadPendingQueue(paths);

  const primary = primaryLanguage(config);

  const scans = await scanAllFiles(root, config);
  const changes = await detectChanges(root, scans, fingerprints);

  let enqueued = 0;
  const scanByPath = new Map(scans.map((s) => [s.filePath, s]));

  const changesByGroup = groupChanges(changes);
  for (const [groupKey, groupChanges] of changesByGroup) {
    const { docType, relativePath } = parseJobGroupKey(groupKey);
    const existingJob = pending.jobs.find(
      (j) => j.docType === docType && j.relativePath === relativePath,
    );

    const enqueueChanges = groupChanges.filter((change) => {
      if (!existingJob) {
        return true;
      }
      if (existingJob.origin.lang === change.lang) {
        return true;
      }
      const target = existingJob.targets.find((t) => t.lang === change.lang);
      if (target?.status === "pending") {
        return false;
      }
      return true;
    });

    if (enqueueChanges.length === 0) {
      continue;
    }

    const changedLangs = [...new Set(enqueueChanges.map((c) => c.lang))];
    if (changedLangs.length === 0) {
      continue;
    }

    const originChange = pickLatestChange(enqueueChanges, scanByPath);
    const mergedLangs = changedLangs.length > 1 ? changedLangs : undefined;
    const direction: SyncDirection =
      originChange.lang === primary.code ? "outbound" : "inbound";
    const allLangCodes = config.languages.map((l) => l.code);
    const targets = buildTargets(
      docType,
      relativePath,
      originChange.lang,
      allLangCodes,
      fingerprints,
    );

    const existingIdx = existingJob
      ? pending.jobs.findIndex((j) => j.id === existingJob.id)
      : -1;

    const now = new Date().toISOString();
    const jobId = existingIdx >= 0 ? pending.jobs[existingIdx]!.id : randomUUID();
    const incomingChanges = buildChangeRecords(enqueueChanges, now);
    const mergedChanges = mergeChangeRecords(
      existingIdx >= 0 ? pending.jobs[existingIdx]!.changes ?? [] : [],
      incomingChanges,
    );

    const job: TranslationJob = {
      id: jobId,
      docType,
      relativePath,
      direction,
      origin: {
        lang: originChange.lang,
        path: originChange.filePath,
        hash: originChange.hash,
        changedAt: now,
        mergedLangs,
      },
      targets,
      changes: mergedChanges,
      createdAt: existingIdx >= 0 ? pending.jobs[existingIdx]!.createdAt : now,
      updatedAt: now,
    };

    await appendChangeHistory(
      paths.changeHistory,
      incomingChanges.map((c) => ({
        ...c,
        docType,
        relativePath,
        jobId,
      })),
    );

    if (existingIdx >= 0) {
      pending.jobs[existingIdx] = job;
    } else {
      pending.jobs.push(job);
      enqueued++;
    }
  }

  let resolved = 0;
  const jobsToResolve: TranslationJob[] = [];
  const hashByPath = new Map(scans.map((s) => [s.filePath, s.hash]));

  for (const job of pending.jobs) {
    let anyUpdated = false;

    for (const target of job.targets) {
      if (target.status === "synced") {
        continue;
      }
      if (job.origin.mergedLangs?.includes(target.lang)) {
        continue;
      }
      const current = hashByPath.get(target.path);
      if (!current) {
        continue;
      }
      const baseline = target.baselineHash ?? "__missing__";
      if (current !== baseline) {
        target.status = "synced";
        target.hash = current;
        target.syncedAt = new Date().toISOString();
        anyUpdated = true;
      }
    }

    if (anyUpdated) {
      job.updatedAt = new Date().toISOString();
    }

    const allSynced = job.targets.every((t) => t.status === "synced");
    if (allSynced && job.targets.length > 0) {
      jobsToResolve.push(job);
    }
  }

  await savePendingQueue(paths, pending);

  for (const job of jobsToResolve) {
    await moveJobToResolved(paths, job);
    resolved++;
  }

  updateFingerprints(fingerprints, scans, changes);
  await saveFingerprints(paths.fingerprints, fingerprints);

  const pendingAfter = await loadPendingQueue(paths);

  return {
    skipped: false,
    enqueued,
    resolved,
    failed: 0,
    pendingCount: pendingAfter.jobs.length,
  };
}

async function scanAllFiles(projectRoot: string, config: DocflowConfig): Promise<FileScan[]> {
  const scans: FileScan[] = [];

  for (const docType of DOC_TYPES) {
    for (const lang of config.languages) {
      const sourceRoot = `docs/${docType}/${lang.code}`;
      const files = await discoverMarkdownFiles(projectRoot, sourceRoot).catch(() => []);
      for (const file of files) {
        const parsed = parseDocFilePath(file.relativePath);
        if (!parsed) {
          continue;
        }
        const st = await stat(file.absolutePath);
        scans.push({
          docType,
          lang: lang.code,
          relativePath: parsed.relativePath,
          filePath: file.relativePath.replace(/\\/g, "/"),
          hash: file.contentHash,
          mtimeMs: st.mtimeMs,
        });
      }
    }
  }

  return scans;
}

async function detectChanges(
  projectRoot: string,
  scans: FileScan[],
  fingerprints: FingerprintsFile,
): Promise<FileChange[]> {
  const changes: FileChange[] = [];
  const gitRef = await resolveGitRef(projectRoot, "HEAD");
  const anchoredAt = new Date().toISOString();

  for (const scan of scans) {
    const previous = fingerprints.files[scan.filePath];
    if (previous === undefined) {
      continue;
    }
    if (previous.hash !== scan.hash) {
      const previousVersion = previous.version ?? 1;
      changes.push({
        docType: scan.docType,
        relativePath: scan.relativePath,
        lang: scan.lang,
        filePath: scan.filePath,
        hash: scan.hash,
        previousHash: previous.hash,
        previousVersion,
        version: previousVersion + 1,
        mtimeMs: scan.mtimeMs,
        anchor: {
          path: scan.filePath,
          hash: previous.hash,
          gitRef,
          anchoredAt,
        },
      });
    }
  }

  return changes;
}

function groupChanges(changes: FileChange[]): Map<string, FileChange[]> {
  const map = new Map<string, FileChange[]>();
  for (const change of changes) {
    const key = jobGroupKey(change.docType, change.relativePath);
    const list = map.get(key) ?? [];
    list.push(change);
    map.set(key, list);
  }
  return map;
}

function pickLatestChange(
  changes: FileChange[],
  scanByPath: Map<string, FileScan>,
): FileChange {
  return changes.reduce((latest, current) => {
    const latestMtime = scanByPath.get(latest.filePath)?.mtimeMs ?? 0;
    const currentMtime = scanByPath.get(current.filePath)?.mtimeMs ?? 0;
    return currentMtime >= latestMtime ? current : latest;
  });
}

function buildTargets(
  docType: DocType,
  relativePath: string,
  originLang: string,
  allLangCodes: string[],
  fingerprints: FingerprintsFile,
): TranslationTarget[] {
  return allLangCodes
    .filter((lang) => lang !== originLang)
    .map((lang) => {
    const path = resolveDocPath(docType, lang, relativePath);
      return {
        lang,
        path,
        status: "pending" as const,
        baselineHash: fingerprints.files[path]?.hash ?? "__missing__",
      };
    });
}

function buildChangeRecords(changes: FileChange[], changedAt: string): FileChangeRecord[] {
  const sorted = [...changes].sort((a, b) => a.mtimeMs - b.mtimeMs);
  return sorted.map((c, index) => ({
    lang: c.lang,
    path: c.filePath,
    hash: c.hash,
    previousHash: c.previousHash,
    previousVersion: c.previousVersion,
    version: c.version,
    changedAt,
    mtimeMs: c.mtimeMs,
    sequence: index + 1,
    anchor: c.anchor,
  }));
}

function mergeChangeRecords(
  existing: FileChangeRecord[],
  incoming: FileChangeRecord[],
): FileChangeRecord[] {
  const byLang = new Map(existing.map((r) => [r.lang, r]));
  for (const record of incoming) {
    byLang.set(record.lang, record);
  }
  return [...byLang.values()].sort(
    (a, b) => a.sequence - b.sequence || a.lang.localeCompare(b.lang),
  );
}

function updateFingerprints(
  fingerprints: FingerprintsFile,
  scans: FileScan[],
  changes: FileChange[],
): void {
  const now = new Date().toISOString();
  const changeByPath = new Map(changes.map((c) => [c.filePath, c]));
  for (const scan of scans) {
    const prev = fingerprints.files[scan.filePath];
    const change = changeByPath.get(scan.filePath);
    const version = change?.version ?? prev?.version ?? 1;
    fingerprints.files[scan.filePath] = {
      hash: scan.hash,
      scannedAt: now,
      version,
    };
  }
}

export function filterJobsByLang<T extends { origin: { lang: string }; targets: TranslationTarget[] }>(
  jobs: T[],
  lang?: string,
): T[] {
  if (!lang) {
    return jobs;
  }
  return jobs.filter(
    (j) => j.origin.lang === lang || j.targets.some((t) => t.lang === lang && t.status === "pending"),
  );
}

export function formatPendingTable(jobs: TranslationJob[]): string {
  if (jobs.length === 0) {
    return "No pending translation jobs.";
  }
  const lines = [
    "ID         Document              Dir       Origin  Outdated targets  Changes (lang:v)",
    ...jobs.map((j) => {
      const id = j.id.slice(0, 8);
      const doc = `${j.docType}/${j.relativePath}`.padEnd(20).slice(0, 20);
      const pendingTargets = j.targets.filter((t) => t.status === "pending").map((t) => t.lang);
      const changeSummary = (j.changes ?? [])
        .map((c) => `${c.lang}:v${c.previousVersion}→v${c.version}`)
        .join(", ");
      return `${id.padEnd(10)} ${doc} ${j.direction.padEnd(9)} ${j.origin.lang.padEnd(6)}  ${pendingTargets.join(", ").padEnd(16)}  ${changeSummary}`;
    }),
  ];
  return lines.join("\n");
}

export function formatFailedTable(jobs: FailedTranslationJob[]): string {
  if (jobs.length === 0) {
    return "No failed translation jobs.";
  }
  const lines = [
    "ID         Document              Reason     Message",
    ...jobs.map((j) => {
      const id = j.id.slice(0, 8);
      const doc = `${j.docType}/${j.relativePath}`.padEnd(20).slice(0, 20);
      return `${id.padEnd(10)} ${doc} ${j.reason.padEnd(10)} ${j.message}`;
    }),
  ];
  return lines.join("\n");
}

export function formatResolvedTable(jobs: import("./queue-types.js").ResolvedTranslationJob[]): string {
  if (jobs.length === 0) {
    return "No resolved translation jobs.";
  }
  const lines = [
    "ID         Document              Resolved    Synced langs",
    ...jobs.map((j) => {
      const id = j.id.slice(0, 8);
      const doc = `${j.docType}/${j.relativePath}`.padEnd(20).slice(0, 20);
      const resolvedAt = j.resolvedAt.slice(0, 10);
      return `${id.padEnd(10)} ${doc} ${resolvedAt}  ${j.syncedLangs.join(", ")}`;
    }),
  ];
  return lines.join("\n");
}

export async function failPendingJob(
  projectRoot: string,
  jobId: string,
  reason: FailedTranslationJob["reason"],
  message: string,
): Promise<boolean> {
  const paths = queuePaths(projectRoot);
  const pending = await loadPendingQueue(paths);
  const job = pending.jobs.find((j) => j.id === jobId || j.id.startsWith(jobId));
  if (!job) {
    return false;
  }
  await moveJobToFailed(paths, job, reason, message);
  return true;
}

export async function addLangToPendingJobs(
  projectRoot: string,
  langCode: string,
  config: DocflowConfig,
): Promise<void> {
  const paths = queuePaths(projectRoot);
  const pending = await loadPendingQueue(paths);
  if (pending.jobs.length === 0) {
    return;
  }
  const fingerprints = await loadFingerprints(paths.fingerprints);
  let changed = false;

  for (const job of pending.jobs) {
    if (job.targets.some((t) => t.lang === langCode)) {
      continue;
    }
    if (job.origin.lang === langCode) {
      continue;
    }
    const path = resolveDocPath(job.docType, langCode, job.relativePath);
    job.targets.push({
      lang: langCode,
      path,
      status: "pending",
      baselineHash: fingerprints.files[path]?.hash ?? "__missing__",
    });
    job.updatedAt = new Date().toISOString();
    changed = true;
  }

  if (changed) {
    await savePendingQueue(paths, pending);
  }
}
