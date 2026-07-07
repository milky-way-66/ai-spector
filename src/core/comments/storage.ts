import { execFile } from "node:child_process";
import { readdir, readFile, writeFile, mkdir } from "node:fs/promises";
import { basename, dirname, join, relative, resolve } from "node:path";
import { promisify } from "node:util";
import { pathExists, readJson, writeJson } from "../util/fs.js";
import {
  logicalPathToTargetPath,
  normalizeLogicalPath,
  threadDirRel,
  threadMetaRel,
} from "./paths.js";
import { normalizeThreadMeta } from "./meta.js";
import {
  parseCommentStoragePath,
  threadDirForLocation,
  threadMetaForLocation,
  type CommentStorageLocation,
} from "./target-paths.js";
import { resolveCommentListLocation } from "./migrate.js";
import { loadOrDeriveDocopsConfig } from "../docops/config.js";
import type { CommentListFilters } from "./filters.js";
import { threadMatchesFilters } from "./filters.js";
import type {
  CommentBody,
  CommentEvent,
  CommentType,
  ThreadDetail,
  ThreadMeta,
  ThreadStatus,
  ThreadSummary,
} from "./types.js";
import {
  isDocumentAnchor,
  isPrototypeAnchor,
  threadCommentType,
} from "./types.js";
import { resolveAuditActor } from "../util/audit-actor.js";
import { generateTimestampUuid, threadRootCommentId } from "./ids.js";
import { readDocAnchorContext } from "./anchor.js";

const exec = promisify(execFile);

export interface ListThreadsOptions {
  projectRoot: string;
  filters?: CommentListFilters;
  /** @deprecated Prefer filters.filePath */
  filePath?: string;
  /** @deprecated Prefer filters.commentTypes */
  commentTypes?: CommentType[];
  /** @deprecated Prefer filters.status */
  status?: ThreadStatus | "all";
}

function resolveListFilters(opts: ListThreadsOptions): CommentListFilters {
  if (opts.filters) {
    return opts.filters;
  }
  return {
    filePath: opts.filePath,
    commentTypes: opts.commentTypes,
    status: opts.status ?? "open",
  };
}

export interface ResolveThreadOptions {
  projectRoot: string;
  logicalPath: string;
  threadId: string;
  entityId?: string;
  screenId?: string;
  /** Resolver email override. */
  resolvedBy?: number | string;
  resolvedByUsername?: string;
  role?: "user" | "client";
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

export interface CreateThreadOptions {
  projectRoot: string;
  logicalPath: string;
  body: string;
  entityId?: string;
  screenId?: string;
  startLine?: number;
  endLine?: number;
  language?: string;
  originBranch?: string;
  authorBy?: string;
  authorUsername?: string;
  role?: "user" | "client";
  dryRun?: boolean;
}

export interface CreateThreadResult {
  thread: ThreadDetail;
  comment: CommentBody;
  commitMessageSuggestion: string;
  dryRun: boolean;
}

export interface AddReplyOptions {
  projectRoot: string;
  logicalPath: string;
  threadId: string;
  body: string;
  entityId?: string;
  screenId?: string;
  authorBy?: string;
  authorUsername?: string;
  role?: "user" | "client";
  expectedVersion?: number;
  dryRun?: boolean;
}

export interface AddReplyResult {
  thread: ThreadDetail;
  comment: CommentBody;
  commitMessageSuggestion: string;
  dryRun: boolean;
}

function isThreadMeta(raw: unknown): raw is ThreadMeta {
  return normalizeThreadMeta(raw) !== null;
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
  location: CommentStorageLocation,
  meta: ThreadMeta,
  replyCount: number,
  commentsRoot: string,
): ThreadSummary {
  const normalized = normalizeThreadMeta(meta)!;
  const threadDir = threadDirForLocation(location, meta.threadId, commentsRoot);
  return {
    ...normalized,
    replyCount,
    threadDir,
    docPath: logicalPathToTargetPath(normalized.filePath),
  };
}

async function commentReadRoots(projectRoot: string): Promise<string[]> {
  const config = await loadOrDeriveDocopsConfig(projectRoot);
  return [config.paths.comments];
}

async function discoverThreadMetas(
  projectRoot: string,
): Promise<
  Array<{ location: CommentStorageLocation; threadId: string; metaPath: string; commentsRoot: string }>
> {
  const roots = await commentReadRoots(projectRoot);
  const found: Array<{
    location: CommentStorageLocation;
    threadId: string;
    metaPath: string;
    commentsRoot: string;
  }> = [];
  const seen = new Set<string>();

  for (const commentsRootRelPath of roots) {
    const commentsRoot = join(projectRoot, commentsRootRelPath);
    if (!(await pathExists(commentsRoot))) {
      continue;
    }

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
        const storagePath = relative(commentsRoot, dirname(threadDir)).replace(/\\/g, "/");
        const location =
          parseCommentStoragePath(storagePath) ?? {
            kind: "legacy" as const,
            targetId: storagePath,
            storagePath,
          };
        const key = `${location.storagePath}\0${threadId}`;
        if (seen.has(key)) {
          continue;
        }
        seen.add(key);
        found.push({
          location,
          threadId,
          metaPath: abs,
          commentsRoot: commentsRootRelPath,
        });
      }
    }

    await walk(commentsRoot);
  }

  return found;
}

export async function listThreads(opts: ListThreadsOptions): Promise<ThreadSummary[]> {
  const filters = resolveListFilters(opts);
  const discovered = await discoverThreadMetas(opts.projectRoot);
  const summaries: ThreadSummary[] = [];

  for (const item of discovered) {
    const meta = await readJson<unknown>(item.metaPath);
    if (!isThreadMeta(meta)) {
      continue;
    }
    const replyCount = await countCommentFiles(dirname(item.metaPath));
    const summary = toSummary(
      opts.projectRoot,
      item.location,
      meta,
      replyCount,
      item.commentsRoot,
    );
    if (!threadMatchesFilters(summary, filters)) {
      continue;
    }
    summaries.push(summary);
  }

  summaries.sort((a, b) => {
    const typeOrder = threadCommentType(a).localeCompare(threadCommentType(b));
    if (typeOrder !== 0) {
      return typeOrder;
    }
    if (isPrototypeAnchor(a.anchor) && isPrototypeAnchor(b.anchor)) {
      const urlDiff = a.anchor.url.localeCompare(b.anchor.url);
      if (urlDiff !== 0) {
        return urlDiff;
      }
      return a.updatedAt.localeCompare(b.updatedAt);
    }
    if (isDocumentAnchor(a.anchor) && isDocumentAnchor(b.anchor)) {
      const lineDiff = a.anchor.startLine - b.anchor.startLine;
      if (lineDiff !== 0) {
        return lineDiff;
      }
    }
    return a.updatedAt.localeCompare(b.updatedAt);
  });

  return summaries;
}

export async function getThread(
  projectRoot: string,
  logicalPath: string,
  threadId: string,
  opts?: { entityId?: string; screenId?: string },
): Promise<ThreadDetail | null> {
  const location = await resolveCommentListLocation(projectRoot, {
    filePath: logicalPath,
    entityId: opts?.entityId,
    screenId: opts?.screenId,
  });
  if (!location) {
    return null;
  }
  return getThreadAtLocation(projectRoot, location, threadId);
}

export async function getThreadAtLocation(
  projectRoot: string,
  location: CommentStorageLocation,
  threadId: string,
): Promise<ThreadDetail | null> {
  const config = await loadOrDeriveDocopsConfig(projectRoot);
  const roots = await commentReadRoots(projectRoot);
  let metaPath: string | null = null;
  let commentsRoot = config.paths.comments;
  for (const rootRel of roots) {
    const candidate = join(
      projectRoot,
      threadMetaForLocation(location, threadId, rootRel),
    );
    if (await pathExists(candidate)) {
      metaPath = candidate;
      commentsRoot = rootRel;
      break;
    }
  }
  if (!metaPath) {
    return null;
  }
  const meta = await readJson<unknown>(metaPath);
  if (!isThreadMeta(meta)) {
    return null;
  }
  const threadDir = join(
    projectRoot,
    threadDirForLocation(location, threadId, commentsRoot),
  );
  const replyCount = await countCommentFiles(threadDir);
  const comments = await loadCommentBodies(threadDir);
  const events = await readEvents(join(threadDir, "events.jsonl"));
  return {
    ...toSummary(projectRoot, location, meta, replyCount, commentsRoot),
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
  return getThreadAtLocation(projectRoot, match.location, threadId);
}

export async function resolveThread(
  opts: ResolveThreadOptions,
): Promise<ResolveThreadResult> {
  const location = await resolveCommentListLocation(opts.projectRoot, {
    filePath: opts.logicalPath,
    entityId: opts.entityId,
    screenId: opts.screenId,
  });
  if (!location) {
    throw new Error(
      `Cannot resolve comment location for: ${opts.logicalPath || opts.entityId || opts.screenId}`,
    );
  }
  const roots = await commentReadRoots(opts.projectRoot);
  let metaPath: string | null = null;
  let commentsRoot = (await loadOrDeriveDocopsConfig(opts.projectRoot)).paths.comments;
  for (const rootRel of roots) {
    const candidate = join(
      opts.projectRoot,
      threadMetaForLocation(location, opts.threadId, rootRel),
    );
    if (await pathExists(candidate)) {
      metaPath = candidate;
      commentsRoot = rootRel;
      break;
    }
  }
  if (!metaPath) {
    throw new Error(
      `Thread not found: ${threadMetaForLocation(location, opts.threadId, commentsRoot)}`,
    );
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
  const actor = await resolveAuditActor(opts.projectRoot, {
    by: opts.resolvedBy != null ? String(opts.resolvedBy) : undefined,
    username: opts.resolvedByUsername,
    role: opts.role,
  });
  const nextVersion = meta.version + 1;

  const updated: ThreadMeta = {
    ...meta,
    status: "resolved",
    resolvedAt: now,
    resolvedBy: actor.by,
    resolvedByUsername: actor.username,
    resolvedByRole: actor.role,
    resolvedInCommitSha: commitSha,
    updatedAt: now,
    version: nextVersion,
  };

  const event: CommentEvent = {
    at: now,
    type: "resolved",
    resolvedInCommitSha: commitSha ?? undefined,
    by: actor.by,
    username: actor.username,
    role: actor.role,
  };

  const threadDir = join(
    opts.projectRoot,
    threadDirForLocation(location, opts.threadId, commentsRoot),
  );
  const eventsPath = join(threadDir, "events.jsonl");
  const commitMessageSuggestion = isPrototypeAnchor(meta.anchor)
    ? `resolve prototype comment thread ${opts.threadId} on ${meta.anchor.url} (${meta.anchor.selector})`
    : `resolve comment thread ${opts.threadId} on ${meta.filePath} ` +
      `(lines ${isDocumentAnchor(meta.anchor) ? `${meta.anchor.startLine}-${meta.anchor.endLine}` : "?"})`;

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
    thread: toSummary(opts.projectRoot, location, updated, replyCount, commentsRoot),
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

export async function getGitBranchName(projectRoot: string): Promise<string | null> {
  try {
    const { stdout } = await exec("git", ["rev-parse", "--abbrev-ref", "HEAD"], {
      cwd: projectRoot,
      encoding: "utf8",
    });
    const branch = stdout.trim();
    return branch && branch !== "HEAD" ? branch : null;
  } catch {
    return null;
  }
}

export async function createThread(opts: CreateThreadOptions): Promise<CreateThreadResult> {
  const body = opts.body.trim();
  if (!body) {
    throw new Error("Comment body is required.");
  }

  const location = await resolveCommentListLocation(opts.projectRoot, {
    filePath: opts.logicalPath,
    entityId: opts.entityId,
    screenId: opts.screenId,
  });
  if (!location) {
    throw new Error(
      `Cannot resolve comment location for: ${opts.logicalPath || opts.entityId || opts.screenId}`,
    );
  }

  const config = await loadOrDeriveDocopsConfig(opts.projectRoot);
  const commentsRoot = config.paths.comments;
  const anchorFilePath = normalizeLogicalPath(opts.logicalPath);
  const startLine = Math.max(1, opts.startLine ?? 1);
  const endLine = Math.max(startLine, opts.endLine ?? startLine);
  const language = (opts.language ?? "EN").trim() || "EN";
  const originBranch =
    opts.originBranch?.trim() || (await getGitBranchName(opts.projectRoot)) || "main";
  const baseCommitSha = (await getGitHeadSha(opts.projectRoot)) ?? "unknown";

  const anchorContext = await readDocAnchorContext(
    opts.projectRoot,
    anchorFilePath,
    startLine,
    endLine,
  );
  const lineExcerpt =
    anchorContext?.anchoredText.trim().slice(0, 500) ||
    `lines ${startLine}-${endLine}`;

  const now = new Date().toISOString();
  const threadId = generateTimestampUuid(new Date(now));
  const commentId = generateTimestampUuid(new Date(now));
  const actor = await resolveAuditActor(opts.projectRoot, {
    by: opts.authorBy,
    username: opts.authorUsername,
    role: opts.role,
  });

  const anchor = {
    branchName: originBranch,
    baseCommitSha,
    filePath: anchorFilePath,
    language,
    startLine,
    endLine,
    lineExcerpt,
    anchorState: "active" as const,
  };

  const meta: ThreadMeta = {
    threadId,
    targetId: location.targetId,
    filePath: anchorFilePath,
    commentType: "document",
    originBranch,
    status: "open",
    version: 1,
    createdAt: now,
    updatedAt: now,
    createdBy: actor.by,
    resolvedAt: null,
    resolvedBy: null,
    resolvedInCommitSha: null,
    anchor,
  };

  const comment: CommentBody = {
    commentId,
    threadId,
    body,
    authorId: actor.by,
    createdAt: now,
    parentCommentId: null,
    editedAt: null,
    deletedAt: null,
  };

  const event: CommentEvent = {
    at: now,
    type: "thread_created",
    by: actor.by,
    username: actor.username,
    role: actor.role,
  };

  const threadDir = join(
    opts.projectRoot,
    threadDirForLocation(location, threadId, commentsRoot),
  );
  const metaPath = join(threadDir, "meta_data.json");
  const commentPath = join(threadDir, commentId);
  const eventsPath = join(threadDir, "events.jsonl");
  const commitMessageSuggestion = `comments: create thread ${threadId} on ${anchorFilePath}`;

  if (!opts.dryRun) {
    await mkdir(threadDir, { recursive: true });
    await writeJson(metaPath, meta);
    await writeJson(commentPath, comment);
    await writeFile(eventsPath, `${JSON.stringify(event)}\n`, "utf8");
  }

  const summary = toSummary(opts.projectRoot, location, meta, 1, commentsRoot);
  const detail: ThreadDetail = {
    ...summary,
    comments: opts.dryRun ? [comment] : (await getThreadAtLocation(opts.projectRoot, location, threadId))?.comments ?? [comment],
    events: opts.dryRun ? [event] : (await getThreadAtLocation(opts.projectRoot, location, threadId))?.events ?? [event],
  };

  return {
    thread: detail,
    comment,
    commitMessageSuggestion,
    dryRun: opts.dryRun === true,
  };
}

export async function addReply(opts: AddReplyOptions): Promise<AddReplyResult> {
  const body = opts.body.trim();
  if (!body) {
    throw new Error("Reply body is required.");
  }

  const location = await resolveCommentListLocation(opts.projectRoot, {
    filePath: opts.logicalPath,
    entityId: opts.entityId,
    screenId: opts.screenId,
  });
  if (!location) {
    throw new Error(
      `Cannot resolve comment location for: ${opts.logicalPath || opts.entityId || opts.screenId}`,
    );
  }

  const config = await loadOrDeriveDocopsConfig(opts.projectRoot);
  const commentsRoot = config.paths.comments;
  const metaPath = join(
    opts.projectRoot,
    threadMetaForLocation(location, opts.threadId, commentsRoot),
  );
  if (!(await pathExists(metaPath))) {
    throw new Error(`Thread not found: ${opts.threadId}`);
  }

  const meta = await readJson<ThreadMeta>(metaPath);
  if (meta.status === "resolved") {
    throw new Error(`Thread ${opts.threadId} is resolved — reopen before replying.`);
  }
  if (opts.expectedVersion != null && meta.version !== opts.expectedVersion) {
    throw new Error(
      `Stale thread version: expected ${opts.expectedVersion}, found ${meta.version}. Re-read meta_data.json and retry.`,
    );
  }

  const threadDir = join(
    opts.projectRoot,
    threadDirForLocation(location, opts.threadId, commentsRoot),
  );
  const existingComments = await loadCommentBodies(threadDir);
  const rootId = threadRootCommentId(existingComments);
  if (!rootId) {
    throw new Error(`Cannot reply on thread ${opts.threadId} with no root comment.`);
  }

  const now = new Date().toISOString();
  const commentId = generateTimestampUuid(new Date(now));
  const actor = await resolveAuditActor(opts.projectRoot, {
    by: opts.authorBy,
    username: opts.authorUsername,
    role: opts.role,
  });

  const comment: CommentBody = {
    commentId,
    threadId: opts.threadId,
    body,
    authorId: actor.by,
    createdAt: now,
    parentCommentId: rootId,
    editedAt: null,
    deletedAt: null,
  };

  const updatedMeta: ThreadMeta = {
    ...meta,
    version: meta.version + 1,
    updatedAt: now,
  };

  const event: CommentEvent = {
    at: now,
    type: "reply_added",
    commentId,
    by: actor.by,
    username: actor.username,
    role: actor.role,
  };

  const commentPath = join(threadDir, commentId);
  const eventsPath = join(threadDir, "events.jsonl");
  const commitMessageSuggestion = `comments: reply on thread ${opts.threadId} (${meta.filePath})`;

  if (!opts.dryRun) {
    await writeJson(metaPath, updatedMeta);
    await writeJson(commentPath, comment);
    const line = `${JSON.stringify(event)}\n`;
    if (await pathExists(eventsPath)) {
      await writeFile(eventsPath, line, { flag: "a" });
    } else {
      await writeFile(eventsPath, line, "utf8");
    }
  }

  const replyCount = existingComments.length + 1;
  const summary = toSummary(opts.projectRoot, location, updatedMeta, replyCount, commentsRoot);
  const loaded = opts.dryRun
    ? null
    : await getThreadAtLocation(opts.projectRoot, location, opts.threadId);
  const detail: ThreadDetail = loaded ?? {
    ...summary,
    comments: [...existingComments, comment],
    events: [...(await readEvents(eventsPath)), event],
  };

  return {
    thread: detail,
    comment,
    commitMessageSuggestion,
    dryRun: opts.dryRun === true,
  };
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
    const target = t.docPath ?? "(unknown target path)";
    const type = threadCommentType(t);
    const location = isPrototypeAnchor(t.anchor)
      ? `${t.anchor.selector} @ ${t.anchor.url}`
      : isDocumentAnchor(t.anchor)
        ? `lines ${t.anchor.startLine}-${t.anchor.endLine} | lang ${t.anchor.language}`
        : "(unknown anchor)";
    const excerpt = isPrototypeAnchor(t.anchor)
      ? t.anchor.textExcerpt
      : isDocumentAnchor(t.anchor)
        ? t.anchor.lineExcerpt
        : undefined;
    return [
      `${t.threadId}`,
      `  type: ${type} | file: ${t.filePath} → ${target}`,
      `  status: ${t.status} | ${location}`,
      `  branch: ${t.originBranch} | replies: ${t.replyCount}`,
      excerpt ? `  excerpt: ${excerpt}` : null,
    ]
      .filter(Boolean)
      .join("\n");
  });
  return lines.join("\n\n");
}
