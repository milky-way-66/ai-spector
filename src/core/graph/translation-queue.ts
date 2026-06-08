import type { ImpactEntry, ImpactResult } from "./impact.js";

export type SyncDirection = "outbound" | "inbound";
export type FailReason = "conflict" | "dismissed" | "sync_error" | "timeout";
export type DocType = "srs" | "basic-design";

export interface FileChangeRecord {
  lang: string;
  path: string;
  hash: string;
  previousHash: string;
  previousVersion: number;
  version: number;
  changedAt: string;
  mtimeMs: number;
  sequence: number;
  diff: string;
  linesAdded: number;
  linesRemoved: number;
}

export interface TranslationTarget {
  lang: string;
  path: string;
  status: "pending" | "synced";
  baselineHash?: string;
  syncedAt?: string;
  hash?: string;
}

export interface TranslationJob {
  id: string;
  docType: DocType;
  relativePath: string;
  direction: SyncDirection;
  origin: {
    lang: string;
    path: string;
    hash: string;
    changedAt: string;
    mergedLangs?: string[];
  };
  targets: TranslationTarget[];
  changes: FileChangeRecord[];
  createdAt: string;
  updatedAt: string;
}

export interface PendingQueueFile {
  version: 1;
  jobs: TranslationJob[];
}

export interface ResolvedTranslationJob extends TranslationJob {
  resolvedAt: string;
  syncedLangs: string[];
}

export interface FailedTranslationJob extends TranslationJob {
  failedAt: string;
  reason: FailReason;
  message: string;
  changedLangs?: string[];
}

export interface FileFingerprint {
  hash: string;
  scannedAt: string;
  version: number;
  content?: string;
}

export interface FingerprintsFile {
  version: 1;
  files: Record<string, FileFingerprint>;
}

export interface TranslationQueueBundleInput {
  pending?: unknown;
  failed?: unknown;
  resolved?: unknown;
  fingerprints?: unknown;
}

export interface TranslationQueueData {
  pending: TranslationJob[];
  failed: FailedTranslationJob[];
  resolved: ResolvedTranslationJob[];
  fingerprints: FingerprintsFile | null;
}

export interface TranslationQueueStats {
  pending: number;
  failed: number;
  resolved: number;
  pendingByDocType: Record<string, number>;
  pendingTargetsByLang: Record<string, number>;
}

export interface StaleTranslationLink {
  impact: ImpactEntry;
  jobs: TranslationJob[];
  projectionPath?: string;
}

export function resolveDocPath(
  docType: DocType,
  lang: string,
  relativePath: string,
): string {
  return `docs/${docType}/${lang}/${relativePath}`.replace(/\\/g, "/");
}

export function parseDocFilePath(
  filePath: string,
): { docType: DocType; lang: string; relativePath: string } | null {
  const norm = filePath.replace(/\\/g, "/");
  const m = norm.match(/^docs\/(srs|basic-design)\/([^/]+)\/(.+\.md)$/i);
  if (!m) {
    return null;
  }
  return {
    docType: m[1] as DocType,
    lang: m[2]!,
    relativePath: m[3]!,
  };
}

export function jobGroupKey(docType: DocType, relativePath: string): string {
  return `${docType}|${relativePath}`;
}

function parseJobArray<T>(json: unknown): T[] {
  if (!json) {
    return [];
  }
  if (Array.isArray(json)) {
    return json as T[];
  }
  if (typeof json === "object" && Array.isArray((json as { jobs?: unknown }).jobs)) {
    return (json as { jobs: T[] }).jobs;
  }
  return [];
}

export function parsePendingQueue(json: unknown): PendingQueueFile {
  if (!json || typeof json !== "object") {
    return { version: 1, jobs: [] };
  }
  const raw = json as Partial<PendingQueueFile>;
  return {
    version: 1,
    jobs: Array.isArray(raw.jobs) ? raw.jobs : [],
  };
}

export function parseFailedJobs(json: unknown): FailedTranslationJob[] {
  return parseJobArray<FailedTranslationJob>(json);
}

export function parseResolvedJobs(json: unknown): ResolvedTranslationJob[] {
  return parseJobArray<ResolvedTranslationJob>(json);
}

export function parseFingerprints(json: unknown): FingerprintsFile | null {
  if (!json || typeof json !== "object") {
    return null;
  }
  const raw = json as Partial<FingerprintsFile>;
  if (!raw.files || typeof raw.files !== "object") {
    return null;
  }
  return { version: 1, files: raw.files };
}

export function parseTranslationQueueBundle(
  input: TranslationQueueBundleInput = {},
): TranslationQueueData {
  return {
    pending: parsePendingQueue(input.pending).jobs,
    failed: parseFailedJobs(input.failed),
    resolved: parseResolvedJobs(input.resolved),
    fingerprints: parseFingerprints(input.fingerprints),
  };
}

export function computeTranslationQueueStats(
  data: TranslationQueueData,
): TranslationQueueStats {
  const pendingByDocType: Record<string, number> = {};
  const pendingTargetsByLang: Record<string, number> = {};

  for (const job of data.pending) {
    pendingByDocType[job.docType] = (pendingByDocType[job.docType] ?? 0) + 1;
    for (const t of job.targets) {
      if (t.status === "pending") {
        pendingTargetsByLang[t.lang] = (pendingTargetsByLang[t.lang] ?? 0) + 1;
      }
    }
  }

  return {
    pending: data.pending.length,
    failed: data.failed.length,
    resolved: data.resolved.length,
    pendingByDocType,
    pendingTargetsByLang,
  };
}

/** Match pending jobs whose logical document overlaps a repo projection path. */
export function jobsForProjectionPath(
  jobs: TranslationJob[],
  projectionPath: string,
): TranslationJob[] {
  const parsed = parseDocFilePath(projectionPath);
  if (!parsed) {
    return [];
  }
  return jobs.filter(
    (j) => j.docType === parsed.docType && j.relativePath === parsed.relativePath,
  );
}

/** Link impact stale translation entries to pending translation jobs. */
export function linkStaleTranslationsToQueue(
  impact: Pick<ImpactResult, "staleTranslations">,
  pendingJobs: TranslationJob[],
): StaleTranslationLink[] {
  if (!impact.staleTranslations?.length) {
    return [];
  }
  const links: StaleTranslationLink[] = [];
  for (const entry of impact.staleTranslations) {
    const path = entry.projectionPath;
    const jobs = path ? jobsForProjectionPath(pendingJobs, path) : [];
    links.push({ impact: entry, jobs, projectionPath: path });
  }
  return links;
}

/** Pending target languages for a job. */
export function pendingTargetLangs(job: TranslationJob): string[] {
  return job.targets.filter((t) => t.status === "pending").map((t) => t.lang);
}
