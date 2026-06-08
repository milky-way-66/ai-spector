import { resolve } from "node:path";
import { loadDocflowConfig } from "../config/load.js";
import type { FailReason } from "../lang/queue-types.js";
import {
  ensureQueueDir,
  loadFailedQueue,
  loadPendingQueue,
  loadResolvedQueue,
  retryFailedJob,
} from "../lang/queue-store.js";
import {
  failPendingJob,
  filterJobsByLang,
  reconcileTranslationQueue,
} from "../lang/queue.js";
import type { TranslationJob } from "../lang/queue-types.js";

export interface LangQueueOptions {
  root?: string;
  lang?: string;
  limit?: number;
}

export interface QueueScanResult {
  skipped: boolean;
  skipReason?: string;
  pendingCount?: number;
  enqueued?: number;
  resolved?: number;
  failed?: number;
}

export async function runLangQueueScan(opts: LangQueueOptions = {}): Promise<QueueScanResult> {
  const { root: projectRoot, config } = await loadDocflowConfig(
    opts.root ? resolve(opts.root) : undefined,
  );
  const result = await reconcileTranslationQueue(projectRoot, config);
  if (result.skipped) return { skipped: true, skipReason: result.skipReason };
  return { skipped: false, pendingCount: result.pendingCount, enqueued: result.enqueued, resolved: result.resolved, failed: result.failed };
}

export async function runLangQueuePending(opts: LangQueueOptions = {}): Promise<TranslationJob[]> {
  const projectRoot = resolve(opts.root ?? (await loadDocflowConfig()).root);
  const paths = await ensureQueueDir(projectRoot);
  const pending = await loadPendingQueue(paths);
  return filterJobsByLang(pending.jobs, opts.lang);
}

export async function runLangQueueResolved(opts: LangQueueOptions = {}): Promise<unknown[]> {
  const projectRoot = resolve(opts.root ?? (await loadDocflowConfig()).root);
  const paths = await ensureQueueDir(projectRoot);
  const resolved = await loadResolvedQueue(paths.resolved);
  const jobs = resolved.jobs;
  return opts.limit && opts.limit > 0 ? jobs.slice(-opts.limit) : jobs;
}

export async function runLangQueueFailed(opts: LangQueueOptions = {}): Promise<unknown[]> {
  const projectRoot = resolve(opts.root ?? (await loadDocflowConfig()).root);
  const paths = await ensureQueueDir(projectRoot);
  const failed = await loadFailedQueue(paths.failed);
  const jobs = failed.jobs;
  return opts.limit && opts.limit > 0 ? jobs.slice(-opts.limit) : jobs;
}

export async function runLangQueueFail(
  jobId: string,
  opts: LangQueueOptions & { reason?: string; message?: string } = {},
): Promise<{ jobId: string; reason: FailReason }> {
  const projectRoot = resolve(opts.root ?? (await loadDocflowConfig()).root);
  const reason = (opts.reason ?? "dismissed") as FailReason;
  const message = opts.message ?? "Manually dismissed";
  const ok = await failPendingJob(projectRoot, jobId, reason, message);
  if (!ok) throw new Error(`Pending job not found: ${jobId}`);
  return { jobId, reason };
}

export async function runLangQueueRetry(
  jobId: string,
  opts: LangQueueOptions = {},
): Promise<TranslationJob> {
  const projectRoot = resolve(opts.root ?? (await loadDocflowConfig()).root);
  const paths = await ensureQueueDir(projectRoot);
  const job = await retryFailedJob(paths, jobId);
  if (!job) throw new Error(`Failed job not found: ${jobId}`);
  return job;
}
