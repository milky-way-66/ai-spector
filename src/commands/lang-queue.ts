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
  formatFailedTable,
  formatPendingTable,
  formatResolvedTable,
  reconcileTranslationQueue,
} from "../lang/queue.js";

export interface LangQueueOptions {
  root?: string;
  lang?: string;
  json?: boolean;
  limit?: number;
}

export async function runLangQueueScan(opts: LangQueueOptions = {}): Promise<void> {
  const { root: projectRoot, config } = await loadDocflowConfig(
    opts.root ? resolve(opts.root) : undefined,
  );
  const result = await reconcileTranslationQueue(projectRoot, config);
  if (result.skipped) {
    console.log(`Translation queue: skipped (${result.skipReason})`);
    return;
  }
  console.log(
    `Translation queue: ${result.pendingCount} pending, +${result.enqueued} enqueued, ${result.resolved} resolved, ${result.failed} failed`,
  );
}

export async function runLangQueuePending(opts: LangQueueOptions = {}): Promise<void> {
  const projectRoot = resolve(opts.root ?? (await loadDocflowConfig()).root);
  const paths = await ensureQueueDir(projectRoot);
  const pending = await loadPendingQueue(paths);
  const jobs = filterJobsByLang(pending.jobs, opts.lang);

  if (opts.json) {
    console.log(JSON.stringify({ jobs }, null, 2));
    return;
  }
  console.log(formatPendingTable(jobs));
}

export async function runLangQueueResolved(opts: LangQueueOptions = {}): Promise<void> {
  const projectRoot = resolve(opts.root ?? (await loadDocflowConfig()).root);
  const paths = await ensureQueueDir(projectRoot);
  const resolved = await loadResolvedQueue(paths.resolved);
  let jobs = resolved.jobs;
  if (opts.limit && opts.limit > 0) {
    jobs = jobs.slice(-opts.limit);
  }

  if (opts.json) {
    console.log(JSON.stringify({ jobs }, null, 2));
    return;
  }
  console.log(formatResolvedTable(jobs));
}

export async function runLangQueueFailed(opts: LangQueueOptions = {}): Promise<void> {
  const projectRoot = resolve(opts.root ?? (await loadDocflowConfig()).root);
  const paths = await ensureQueueDir(projectRoot);
  const failed = await loadFailedQueue(paths.failed);
  let jobs = failed.jobs;
  if (opts.limit && opts.limit > 0) {
    jobs = jobs.slice(-opts.limit);
  }

  if (opts.json) {
    console.log(JSON.stringify({ jobs }, null, 2));
    return;
  }
  console.log(formatFailedTable(jobs));
}

export async function runLangQueueFail(
  jobId: string,
  opts: LangQueueOptions & { reason?: string; message?: string } = {},
): Promise<void> {
  const projectRoot = resolve(opts.root ?? (await loadDocflowConfig()).root);
  const reason = (opts.reason ?? "dismissed") as FailReason;
  const message = opts.message ?? "Manually dismissed";
  const ok = await failPendingJob(projectRoot, jobId, reason, message);
  if (!ok) {
    throw new Error(`Pending job not found: ${jobId}`);
  }
  console.log(`Moved job ${jobId} to failed (${reason})`);
}

export async function runLangQueueRetry(
  jobId: string,
  opts: LangQueueOptions = {},
): Promise<void> {
  const projectRoot = resolve(opts.root ?? (await loadDocflowConfig()).root);
  const paths = await ensureQueueDir(projectRoot);
  const job = await retryFailedJob(paths, jobId);
  if (!job) {
    throw new Error(`Failed job not found: ${jobId}`);
  }
  console.log(`Moved job ${jobId} back to pending`);
}
