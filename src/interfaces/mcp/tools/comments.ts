import { resolveProjectPaths } from "@/core/util/paths.js";

function warnDeprecated(oldTool: string, action: string): void {
  process.stderr.write(
    `[ai-spector-mcp] DEPRECATED: "${oldTool}" is deprecated — use contract_comments with action="${action}" instead.\n`,
  );
}
import {
  getThread,
  findThreadById,
  resolveThread,
} from "@/core/comments/storage.js";
import { normalizeLogicalPath } from "@/core/comments/paths.js";
import {
  runCommentsBatchPlan,
  runCommentsBatchResolve,
  runCommentsFacets,
  runCommentsInbox,
  runCommentsList,
  toCommentListFilters,
} from "@/core/operations/comments.js";
import { buildCommentInboxPayload, buildCommentPlan } from "@/core/comments/plan.js";
import type {
  CommentsBatchPlanSchema,
  CommentsBatchResolveSchema,
  CommentsFacetsSchema,
  CommentsInboxSchema,
  CommentsListSchema,
  CommentsResolveSchema,
  CommentsShowSchema,
} from "../schemas.js";
import type { z } from "zod";

function filtersFromInput(input: {
  filePath?: string;
  pathPrefix?: string;
  commentTypes?: ("document" | "prototype")[];
  screen?: string;
  originBranch?: string;
  anchorState?: "active" | "drifted" | "missing";
  status?: "open" | "resolved" | "all";
}) {
  return toCommentListFilters({
    filePath: input.filePath,
    pathPrefix: input.pathPrefix,
    commentTypes: input.commentTypes,
    screen: input.screen,
    branch: input.originBranch,
    anchorState: input.anchorState,
    status: input.status,
  });
}

export async function toolCommentsList(input: z.infer<typeof CommentsListSchema>) {
  warnDeprecated("comments_list", "list");
  const result = await runCommentsList({
    root: input.root,
    ...toCommentListFilters({
      filePath: input.filePath,
      pathPrefix: input.pathPrefix,
      commentTypes: input.commentTypes,
      screen: input.screen,
      branch: input.originBranch,
      anchorState: input.anchorState,
      status: input.status,
    }),
  });
  return result;
}

export async function toolCommentsFacets(input: z.infer<typeof CommentsFacetsSchema>) {
  warnDeprecated("comments_facets", "facets");
  return runCommentsFacets({
    root: input.root,
    ...toCommentListFilters({
      filePath: input.filePath,
      pathPrefix: input.pathPrefix,
      commentTypes: input.commentTypes,
      screen: input.screen,
      branch: input.originBranch,
      status: "all",
    }),
  });
}

export async function toolCommentsInbox(input: z.infer<typeof CommentsInboxSchema>) {
  warnDeprecated("comments_inbox", "inbox");
  return runCommentsInbox({
    root: input.root,
    ...toCommentListFilters({
      filePath: input.filePath,
      pathPrefix: input.pathPrefix,
      commentTypes: input.commentTypes,
      screen: input.screen,
      branch: input.originBranch,
      anchorState: input.anchorState,
      status: input.status,
    }),
    groupByScreen: input.groupByScreen,
  });
}

export async function toolCommentsBatchPlan(input: z.infer<typeof CommentsBatchPlanSchema>) {
  warnDeprecated("comments_batch_plan", "batch_plan");
  return runCommentsBatchPlan({
    root: input.root,
    ...toCommentListFilters({
      filePath: input.filePath,
      pathPrefix: input.pathPrefix,
      commentTypes: input.commentTypes ?? ["prototype"],
      screen: input.screen,
      branch: input.originBranch,
      anchorState: input.anchorState,
      status: input.status,
    }),
    batchId: input.batchId,
    picks: input.picks,
    screen: input.screen,
    phrase: input.phrase,
    groupByScreen: input.groupByScreen ?? true,
  });
}

export async function toolCommentsBatchResolve(input: z.infer<typeof CommentsBatchResolveSchema>) {
  warnDeprecated("comments_batch_resolve", "batch_resolve");
  return runCommentsBatchResolve({
    root: input.root,
    picks: input.picks,
    commentTypes: ["prototype"],
    resolvedBy: input.by ?? input.resolvedBy,
    resolvedByUsername: input.username,
    role: input.role,
    dryRun: input.dryRun,
  });
}

export async function toolCommentsShow(input: z.infer<typeof CommentsShowSchema>) {
  warnDeprecated("comments_show", "show");
  const paths = await resolveProjectPaths(input.root);
  const thread = input.filePath
    ? await getThread(paths.root, normalizeLogicalPath(input.filePath), input.threadId)
    : await findThreadById(paths.root, input.threadId);
  if (!thread) {
    throw new Error(`Thread not found: ${input.threadId}`);
  }
  return thread;
}

export async function toolCommentsResolve(input: z.infer<typeof CommentsResolveSchema>) {
  warnDeprecated("comments_resolve", "resolve");
  const paths = await resolveProjectPaths(input.root);
  const result = await resolveThread({
    projectRoot: paths.root,
    logicalPath: normalizeLogicalPath(input.filePath),
    threadId: input.threadId,
    resolvedBy: input.by ?? input.resolvedBy,
    resolvedByUsername: input.username,
    role: input.role,
    dryRun: input.dryRun,
  });
  return result;
}

// Legacy exports used by plan flow
export { buildCommentInboxPayload, buildCommentPlan, filtersFromInput };
