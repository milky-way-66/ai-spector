import { execFile } from "node:child_process";
import { readdir, readFile, writeFile } from "node:fs/promises";
import { basename, dirname, join, relative, resolve } from "node:path";
import { promisify } from "node:util";
import { pathExists, readJson, writeJson } from "../util/fs.js";
import {
  logicalPathToDocPath,
  normalizeLogicalPath,
  threadDirRel,
  threadEventsRel,
  threadMetaRel,
} from "./paths.js";
import type {
  CommentBody,
  CommentEvent,
  ThreadDetail,
  ThreadMeta,
  ThreadStatus,
  ThreadSummary,
} from "./types.js";

const exec = promisify(execFile);

export interface ListThreadsOptions {
  projectRoot: string;
  filePath?: string;
  status?: ThreadStatus | "all";
}

export interface ResolveThreadOptions {
  projectRoot: string;
  logicalPath: string;
  threadId: string;
  resolvedBy?: number | string;
  resolvedInCommitSha?: string;
  dryRun?: boolean;
  /** Expected meta_data.json version for optimistic locking */
  expectedVersion?: number;
}

export interface ResolveThreadResult {
  thread: ThreadSummary;
  commitMessageSuggestion: string;
  dryRun: boolean;
}

function isThreadMeta(raw: unknown): raw is ThreadMeta {
  if (!raw || typeof raw !== "object") {
    return false;
  }
  const m = raw as ThreadMeta;
  return (
    typeof m.threadId === "string" &&
    typeof m.filePath === "string" &&
    typeof m.status === "string" &&
    typeof m.version === "number" &&
    m.anchor != null &&
    typeof m.anchor.startLine === "number"
  );
}

function isCommentBody(raw: unknown): raw is CommentBody {
  if (!raw || typeof raw !== "object") {
    return false;
  }
  const c = raw as CommentBody;
  return typeof c.commentId === "string" && typeof c.body === "string";
}

async function readEvents(eventsPath: string): Promise<CommentEvent[]> {
  if (!(await pathExists(eventsPath))) {
    return [];
  }
  const raw = await readFile(eventsPath, "utf8");
  const events: CommentEvent[] = [];
  for (const line of raw.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) {
      continue;
    }
    try {
      events.push(JSON.parse(trimmed) as CommentEvent);
    } catch {
      /* skip malformed lines */
    }
  }
  return events;
}

async function countCommentFiles(threadDir: string): Promise<number> {
  let count = 0;
  const entries = await readdir(threadDir, { withFileTypes: true });
  for (const ent of entries) {
    if (!ent.isFile()) {
      continue;
    }
    if (ent.name === "meta_data.json" || ent.name === "events.jsonl") {
      continue;
    }
    count += 1;
  }
  return count;
}

async function loadCommentBodies(threadDir: string): Promise<CommentBody[]> {
  const comments: CommentBody[] = [];
  const entries = await readdir(threadDir, { withFileTypes: true });
  for (const ent of entries) {
    if (!ent.isFile()) {
      continue;
    }
    if (ent.name === "meta_data.json" || ent.name === "events.jsonl") {
      continue;
    }
    const raw = await readJson<unknown>(join(threadDir, ent.name));
    if (isCommentBody(raw)) {
      comments.push(raw);
    }
  }
  comments.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  return comments;
}

function toSummary(
  projectRoot: string,
  logicalPath: string,
  meta: ThreadMeta,
  replyCount: number,
): ThreadSummary {
  const threadDir = threadDirRel(logicalPath, meta.threadId);
  return {
    ...meta,
    replyCount,
    threadDir,
    docPath: logicalPathToDocPath(meta.filePath),
  };
}

async function discoverThreadMetas(
  projectRoot: string,
): Promise<Array<{ logicalPath: string; threadId: string; metaPath: string }>> {
  const commentsRoot = join(projectRoot, "comments");
  if (!(await pathExists(commentsRoot))) {
    return [];
  }

  const found: Array<{ logicalPath: string; threadId: string; metaPath: string }> =
    [];

  async function walk(dir: string): Promise<void> {
    let entries;
    try {
      entries = await readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const ent of entries) {
      const abs = join(dir, ent.name);
      if (ent.isDirectory()) {
        await walk(abs);
        continue;
      }
      if (ent.name !== "meta_data.json") {
        continue;
      }
      const threadDir = dirname(abs);
      const threadId = basename(threadDir);
      const logicalPath = relative(commentsRoot, dirname(threadDir)).replace(/\\/g, "/");
      found.push({ logicalPath, threadId, metaPath: abs });
    }
  }

  await walk(commentsRoot);
  return found;
}

export async function listThreads(opts: ListThreadsOptions): Promise<ThreadSummary[]> {
  const fileFilter = opts.filePath ? normalizeLogicalPath(opts.filePath) : undefined;
  const statusFilter = opts.status ?? "open";
  const discovered = await discoverThreadMetas(opts.projectRoot);
  const summaries: ThreadSummary[] = [];

  for (const item of discovered) {
    if (fileFilter && normalizeLogicalPath(item.logicalPath) !== fileFilter) {
      continue;
    }
    const meta = await readJson<unknown>(item.metaPath);
    if (!isThreadMeta(meta)) {
      continue;
    }
    if (statusFilter !== "all" && meta.status !== statusFilter) {
      continue;
    }
    const replyCount = await countCommentFiles(dirname(item.metaPath));
    summaries.push(toSummary(opts.projectRoot, item.logicalPath, meta, replyCount));
  }

  summaries.sort((a, b) => {
    const lineDiff = a.anchor.startLine - b.anchor.startLine;
    if (lineDiff !== 0) {
      return lineDiff;
    }
    return a.updatedAt.localeCompare(b.updatedAt);
  });

  return summaries;
}

export async function getThread(
  projectRoot: string,
  logicalPath: string,
  threadId: string,
): Promise<ThreadDetail | null> {
  const lp = normalizeLogicalPath(logicalPath);
  const metaPath = join(projectRoot, threadMetaRel(lp, threadId));
  if (!(await pathExists(metaPath))) {
    return null;
  }
  const meta = await readJson<unknown>(metaPath);
  if (!isThreadMeta(meta)) {
    return null;
  }
  const threadDir = join(projectRoot, threadDirRel(lp, threadId));
  const replyCount = await countCommentFiles(threadDir);
  const comments = await loadCommentBodies(threadDir);
  const events = await readEvents(join(threadDir, "events.jsonl"));
  return {
    ...toSummary(projectRoot, lp, meta, replyCount),
    comments,
    events,
  };
}

export async function findThreadById(
  projectRoot: string,
  threadId: string,
): Promise<ThreadDetail | null> {
  const discovered = await discoverThreadMetas(projectRoot);
  const match = discovered.find((d) => d.threadId === threadId);
  if (!match) {
    return null;
  }
  return getThread(projectRoot, match.logicalPath, threadId);
}

export async function resolveThread(
  opts: ResolveThreadOptions,
): Promise<ResolveThreadResult> {
  const lp = normalizeLogicalPath(opts.logicalPath);
  const metaPath = join(opts.projectRoot, threadMetaRel(lp, opts.threadId));
  if (!(await pathExists(metaPath))) {
    throw new Error(`Thread not found: comments/${lp}/${opts.threadId}/meta_data.json`);
  }

  const meta = await readJson<ThreadMeta>(metaPath);
  if (opts.expectedVersion != null && meta.version !== opts.expectedVersion) {
    throw new Error(
      `Stale thread version: expected ${opts.expectedVersion}, found ${meta.version}. Re-read meta_data.json and retry.`,
    );
  }
  if (meta.status === "resolved") {
    throw new Error(`Thread ${opts.threadId} is already resolved.`);
  }

  const commitSha =
    opts.resolvedInCommitSha?.trim() || (await getGitHeadSha(opts.projectRoot));
  const now = new Date().toISOString();
  const resolvedBy = opts.resolvedBy ?? "local";
  const nextVersion = meta.version + 1;

  const updated: ThreadMeta = {
    ...meta,
    status: "resolved",
    resolvedAt: now,
    resolvedBy,
    resolvedInCommitSha: commitSha,
    updatedAt: now,
    version: nextVersion,
  };

  const event: CommentEvent = {
    at: now,
    type: "resolved",
    resolvedInCommitSha: commitSha ?? undefined,
    by: resolvedBy,
  };

  const threadDir = join(opts.projectRoot, threadDirRel(lp, opts.threadId));
  const eventsPath = join(opts.projectRoot, threadEventsRel(lp, opts.threadId));
  const commitMessageSuggestion =
    `resolve comment thread ${opts.threadId} on ${meta.filePath} ` +
    `(lines ${meta.anchor.startLine}-${meta.anchor.endLine})`;

  if (!opts.dryRun) {
    await writeJson(metaPath, updated);
    const line = `${JSON.stringify(event)}\n`;
    if (await pathExists(eventsPath)) {
      await writeFile(eventsPath, line, { flag: "a" });
    } else {
      await writeFile(eventsPath, line, "utf8");
    }
  }

  const replyCount = await countCommentFiles(threadDir);
  return {
    thread: toSummary(opts.projectRoot, lp, updated, replyCount),
    commitMessageSuggestion,
    dryRun: opts.dryRun === true,
  };
}

export async function getGitHeadSha(projectRoot: string): Promise<string | null> {
  try {
    const { stdout } = await exec("git", ["rev-parse", "HEAD"], {
      cwd: projectRoot,
      encoding: "utf8",
    });
    const sha = stdout.trim();
    return sha || null;
  } catch {
    return null;
  }
}

/** First non-deleted comment body per thread (for inbox previews). */
export async function loadCommentBodiesForThreads(
  projectRoot: string,
  threads: ThreadSummary[],
): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  for (const t of threads) {
    const detail = await getThread(projectRoot, t.filePath, t.threadId);
    const first = detail?.comments.find((c) => !c.deletedAt);
    if (first) {
      map.set(t.threadId, first.body);
    }
  }
  return map;
}

export function formatThreadListText(threads: ThreadSummary[]): string {
  if (threads.length === 0) {
    return "No comment threads found.";
  }
  const lines = threads.map((t) => {
    const doc = t.docPath ?? "(unknown doc path)";
    return [
      `${t.threadId}`,
      `  file: ${t.filePath} → ${doc}`,
      `  status: ${t.status} | lines ${t.anchor.startLine}-${t.anchor.endLine} | lang ${t.anchor.language}`,
      `  branch: ${t.originBranch} | replies: ${t.replyCount}`,
      t.anchor.lineExcerpt ? `  excerpt: ${t.anchor.lineExcerpt}` : null,
    ]
      .filter(Boolean)
      .join("\n");
  });
  return lines.join("\n\n");
}
