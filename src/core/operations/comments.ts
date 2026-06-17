import { resolveProjectPaths } from "../util/paths.js";
import { normalizeLogicalPath } from "../comments/paths.js";
import {
  buildCommentFacets,
  formatFacetsForChat,
  type CommentListFilters,
} from "../comments/filters.js";
import {
  buildCommentBatchPlanPayload,
  buildCommentInboxPayload,
  buildCommentPlan,
  pickIdForThread,
  resolvePickId,
  resolvePickIds,
} from "../comments/plan.js";
import { formatBatchPlanForChat } from "../comments/batch.js";
import type { CommentBatchPlan } from "../comments/batch.js";
import {
  findThreadById,
  getThread,
  listThreads,
  resolveThread,
  type ResolveThreadResult,
} from "../comments/storage.js";
import type { AnchorState, CommentType } from "../comments/types.js";
import type { CommentInbox, CommentResolvePlan } from "../comments/inbox.js";
import type { WorkflowToolGuidance } from "../workflow/guidance.js";
import {
  buildCommentsPlanWorkflowGuidance,
  buildCommentsResolveWorkflowGuidance,
} from "../workflow/guidance.js";

export interface CommentFilterOptions {
  filePath?: string;
  pathPrefix?: string;
  commentTypes?: CommentType[];
  status?: "open" | "resolved" | "all";
  screen?: string;
  branch?: string;
  anchorState?: AnchorState;
  groupByScreen?: boolean;
}

export function toCommentListFilters(opts: CommentFilterOptions): CommentListFilters {
  return {
    filePath: opts.filePath,
    pathPrefix: opts.pathPrefix,
    commentTypes: opts.commentTypes,
    status: opts.status ?? "open",
    screen: opts.screen,
    originBranch: opts.branch,
    anchorState: opts.anchorState,
  };
}

export interface CommentsListOptions extends CommentFilterOptions {
  root?: string;
}

export interface CommentsListResult {
  threads: Awaited<ReturnType<typeof listThreads>>;
  count: number;
  filters: CommentListFilters;
}

export interface CommentsInboxOptions extends CommentFilterOptions {
  root?: string;
}

export interface CommentsFacetsOptions extends CommentFilterOptions {
  root?: string;
}

export interface CommentsFacetsResult {
  facets: ReturnType<typeof buildCommentFacets>;
  formatted: string;
}

export interface CommentsPlanOptions {
  root?: string;
  threadId: string;
  filePath?: string;
  pick?: string;
  filters?: CommentListFilters;
}

export interface CommentsBatchPlanOptions extends CommentFilterOptions {
  root?: string;
  batchId?: string;
  picks?: string[];
  screen?: string;
  phrase?: string;
}

export interface CommentsBatchPlanResult {
  plan: CommentBatchPlan;
  formatted: string;
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
  resolvedByUsername?: string;
  role?: "user" | "client";
  commitSha?: string;
  expectedVersion?: number;
  dryRun?: boolean;
}

export interface CommentsBatchResolveOptions extends CommentFilterOptions {
  root?: string;
  picks: string[];
  resolvedBy?: string;
  resolvedByUsername?: string;
  role?: "user" | "client";
  commitSha?: string;
  dryRun?: boolean;
}

export interface CommentsBatchResolveResult {
  resolved: ResolveThreadResult[];
  count: number;
  dryRun: boolean;
  commitMessageSuggestion: string;
}

export interface CommentResolvePlanWithGuidance extends CommentResolvePlan {
  workflowGuidance: WorkflowToolGuidance;
}

export async function runCommentsList(opts: CommentsListOptions): Promise<CommentsListResult> {
  const paths = await resolveProjectPaths(opts.root);
  const filters = toCommentListFilters(opts);
  const threads = await listThreads({
    projectRoot: paths.root,
    filters,
  });
  return { threads, count: threads.length, filters };
}

export async function runCommentsFacets(opts: CommentsFacetsOptions): Promise<CommentsFacetsResult> {
  const paths = await resolveProjectPaths(opts.root);
  const filters = toCommentListFilters({ ...opts, status: opts.status ?? "all" });
  const threads = await listThreads({
    projectRoot: paths.root,
    filters: { ...filters, status: "all" },
  });
  const facets = buildCommentFacets(threads, filters);
  return { facets, formatted: formatFacetsForChat(facets) };
}

export async function runCommentsInbox(opts: CommentsInboxOptions): Promise<CommentInbox> {
  const paths = await resolveProjectPaths(opts.root);
  return buildCommentInboxPayload({
    projectRoot: paths.root,
    filters: toCommentListFilters(opts),
    groupByScreen: opts.groupByScreen,
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
      filters: opts.filters ?? { status: "open" },
    });
    const item = resolvePickId(inbox, token);
    if (!item) {
      throw new Error(`Unknown pick id or thread: ${token}. Run: npx ai-spector comments inbox --json`);
    }
    threadId = item.threadId;
    filePath = item.filePath;
    pickId = item.pickId;
  } else if (!filePath) {
    const inbox = await buildCommentInboxPayload({
      projectRoot: paths.root,
      filters: { status: "open" },
    });
    pickId = pickIdForThread(inbox, threadId);
  }

  const plan = await buildCommentPlan({
    projectRoot: paths.root,
    graphPath: paths.graph,
    rulesPath: paths.rulesImpact,
    threadId,
    filePath,
    pickId,
    filters: opts.filters,
  });
  return {
    ...plan,
    workflowGuidance: buildCommentsPlanWorkflowGuidance(threadId),
  };
}

export async function runCommentsBatchPlan(
  opts: CommentsBatchPlanOptions,
): Promise<CommentsBatchPlanResult> {
  const paths = await resolveProjectPaths(opts.root);
  const plan = await buildCommentBatchPlanPayload({
    projectRoot: paths.root,
    filters: toCommentListFilters({
      ...opts,
      commentTypes: opts.commentTypes ?? ["prototype"],
      status: opts.status ?? "open",
    }),
    groupByScreen: opts.groupByScreen ?? true,
    batchId: opts.batchId,
    picks: opts.picks,
    screen: opts.screen,
    phrase: opts.phrase,
  });
  return { plan, formatted: formatBatchPlanForChat(plan) };
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
    resolvedByUsername: opts.resolvedByUsername,
    role: opts.role,
    resolvedInCommitSha: opts.commitSha,
    expectedVersion: opts.expectedVersion,
    dryRun: opts.dryRun,
  });
  return {
    ...result,
    workflowGuidance: buildCommentsResolveWorkflowGuidance(opts.threadId),
  };
}

export async function runCommentsBatchResolve(
  opts: CommentsBatchResolveOptions,
): Promise<CommentsBatchResolveResult> {
  const paths = await resolveProjectPaths(opts.root);
  const filters = toCommentListFilters({
    ...opts,
    commentTypes: opts.commentTypes ?? ["prototype"],
    status: opts.status ?? "open",
  });

  const inbox = await buildCommentInboxPayload({
    projectRoot: paths.root,
    filters,
    groupByScreen: true,
  });

  const items = resolvePickIds(inbox, opts.picks);
  if (items.length === 0) {
    throw new Error(
      `No threads matched picks: ${opts.picks.join(", ")}. Run comments inbox --group screen --json`,
    );
  }

  const resolved: ResolveThreadResult[] = [];
  for (const item of items) {
    const result = await resolveThread({
      projectRoot: paths.root,
      logicalPath: normalizeLogicalPath(item.filePath),
      threadId: item.threadId,
      resolvedBy: opts.resolvedBy,
      resolvedByUsername: opts.resolvedByUsername,
      role: opts.role,
      resolvedInCommitSha: opts.commitSha,
      expectedVersion: item.version,
      dryRun: opts.dryRun,
    });
    resolved.push(result);
  }

  const picks = items.map((i) => i.pickId).join(", ");
  const screens = [...new Set(items.map((i) => i.location?.split(" @ ").pop() ?? i.lines))];
  const commitMessageSuggestion =
    `resolve prototype comments ${picks} on ${screens.join(", ")}`;

  return {
    resolved,
    count: resolved.length,
    dryRun: opts.dryRun === true,
    commitMessageSuggestion,
  };
}
