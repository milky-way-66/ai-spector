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
  type ResolveThreadResult,
} from "../comments/storage.js";
import type { ThreadSummary } from "../comments/types.js";
import type { CommentInbox, CommentResolvePlan } from "../comments/inbox.js";
import type { WorkflowToolGuidance } from "../workflow/guidance.js";
import {
  buildCommentsPlanWorkflowGuidance,
  buildCommentsResolveWorkflowGuidance,
} from "../workflow/guidance.js";
export interface CommentResolvePlanWithGuidance extends CommentResolvePlan {
  workflowGuidance: WorkflowToolGuidance;
}

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

export async function runCommentsPlan(opts: CommentsPlanOptions): Promise<CommentResolvePlanWithGuidance> {
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

  const plan = await buildCommentPlan({
    projectRoot: paths.root,
    graphPath: paths.graph,
    rulesPath: paths.rulesImpact,
    threadId,
    filePath,
    pickId,
  });
  return {
    ...plan,
    workflowGuidance: buildCommentsPlanWorkflowGuidance(threadId),
  };
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

export interface CommentsResolveResult extends ResolveThreadResult {
  workflowGuidance: WorkflowToolGuidance;
}

export async function runCommentsResolve(opts: CommentsResolveOptions): Promise<CommentsResolveResult> {
  const paths = await resolveProjectPaths(opts.root);
  const result = await resolveThread({
    projectRoot: paths.root,
    logicalPath: normalizeLogicalPath(opts.filePath),
    threadId: opts.threadId,
    resolvedBy: opts.resolvedBy,
    resolvedInCommitSha: opts.commitSha,
    expectedVersion: opts.expectedVersion,
    dryRun: opts.dryRun,
  });
  return {
    ...result,
    workflowGuidance: buildCommentsResolveWorkflowGuidance(opts.threadId),
  };
}
