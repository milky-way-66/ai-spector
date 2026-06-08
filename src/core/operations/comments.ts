import { resolveProjectPaths } from "../util/paths.js";
import { normalizeLogicalPath } from "../comments/paths.js";
import {
  buildCommentInboxPayload,
  buildCommentPlan,
  pickIdForThread,
  resolvePickId,
} from "../comments/plan.js";
import {
  findThreadById,
  getThread,
  listThreads,
  resolveThread,
} from "../comments/storage.js";
import type { ThreadSummary } from "../comments/types.js";
import type { CommentInbox, CommentResolvePlan } from "../comments/inbox.js";
import type { ResolveThreadResult } from "../comments/storage.js";

export interface CommentsListOptions {
  root?: string;
  filePath?: string;
  status?: "open" | "resolved" | "all";
}

export interface CommentsListResult {
  threads: ThreadSummary[];
  count: number;
}

export interface CommentsInboxOptions {
  root?: string;
  filePath?: string;
  status?: "open" | "resolved" | "all";
}

export interface CommentsPlanOptions {
  root?: string;
  threadId: string;
  filePath?: string;
  pick?: string;
}

export interface CommentsShowOptions {
  root?: string;
  threadId: string;
  filePath?: string;
}

export interface CommentsResolveOptions {
  root?: string;
  threadId: string;
  filePath: string;
  resolvedBy?: string;
  commitSha?: string;
  expectedVersion?: number;
  dryRun?: boolean;
}

export async function runCommentsList(opts: CommentsListOptions): Promise<CommentsListResult> {
  const paths = await resolveProjectPaths(opts.root);
  const threads = await listThreads({
    projectRoot: paths.root,
    filePath: opts.filePath,
    status: opts.status ?? "open",
  });
  return { threads, count: threads.length };
}

export async function runCommentsInbox(opts: CommentsInboxOptions): Promise<CommentInbox> {
  const paths = await resolveProjectPaths(opts.root);
  return buildCommentInboxPayload({
    projectRoot: paths.root,
    filePath: opts.filePath,
    status: opts.status ?? "open",
  });
}

export async function runCommentsPlan(opts: CommentsPlanOptions): Promise<CommentResolvePlan> {
  const paths = await resolveProjectPaths(opts.root);

  let threadId = opts.threadId;
  let filePath = opts.filePath;
  let pickId = opts.pick;

  if (pickId || /^C-\d{3}$/i.test(threadId)) {
    const token = pickId ?? threadId;
    const inbox = await buildCommentInboxPayload({
      projectRoot: paths.root,
      filePath: opts.filePath,
      status: "open",
    });
    const item = resolvePickId(inbox, token);
    if (!item) {
      throw new Error(`Unknown pick id or thread: ${token}. Run: npx ai-spector comments inbox --json`);
    }
    threadId = item.threadId;
    filePath = item.filePath;
    pickId = item.pickId;
  } else if (!filePath) {
    const inbox = await buildCommentInboxPayload({ projectRoot: paths.root, status: "open" });
    pickId = pickIdForThread(inbox, threadId);
  }

  return buildCommentPlan({
    projectRoot: paths.root,
    graphPath: paths.graph,
    rulesPath: paths.rulesImpact,
    threadId,
    filePath,
    pickId,
  });
}

export async function runCommentsShow(opts: CommentsShowOptions): Promise<NonNullable<Awaited<ReturnType<typeof getThread>>>> {
  const paths = await resolveProjectPaths(opts.root);
  const thread = opts.filePath
    ? await getThread(paths.root, normalizeLogicalPath(opts.filePath), opts.threadId)
    : await findThreadById(paths.root, opts.threadId);
  if (!thread) {
    throw new Error(
      opts.filePath
        ? `Thread not found: ${opts.threadId} under ${normalizeLogicalPath(opts.filePath)}`
        : `Thread not found: ${opts.threadId}`,
    );
  }
  return thread;
}

export async function runCommentsResolve(opts: CommentsResolveOptions): Promise<ResolveThreadResult> {
  const paths = await resolveProjectPaths(opts.root);
  return resolveThread({
    projectRoot: paths.root,
    logicalPath: normalizeLogicalPath(opts.filePath),
    threadId: opts.threadId,
    resolvedBy: opts.resolvedBy,
    resolvedInCommitSha: opts.commitSha,
    expectedVersion: opts.expectedVersion,
    dryRun: opts.dryRun,
  });
}
