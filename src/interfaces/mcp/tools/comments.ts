import { resolveProjectPaths } from "@/core/util/paths.js";
import {
  listThreads,
  getThread,
  findThreadById,
  resolveThread,
} from "@/core/comments/storage.js";
import { buildCommentInboxPayload } from "@/core/comments/plan.js";
import { normalizeLogicalPath } from "@/core/comments/paths.js";
import type {
  CommentsListSchema,
  CommentsInboxSchema,
  CommentsShowSchema,
  CommentsResolveSchema,
} from "../schemas.js";
import type { z } from "zod";

export async function toolCommentsList(input: z.infer<typeof CommentsListSchema>) {
  const paths = await resolveProjectPaths(input.root);
  const threads = await listThreads({
    projectRoot: paths.root,
    filePath: input.filePath,
    commentTypes: input.commentTypes,
    status: input.status ?? "open",
  });
  return { threads, count: threads.length };
}

export async function toolCommentsInbox(input: z.infer<typeof CommentsInboxSchema>) {
  const paths = await resolveProjectPaths(input.root);
  const inbox = await buildCommentInboxPayload({
    projectRoot: paths.root,
    filePath: input.filePath,
    commentTypes: input.commentTypes,
    status: input.status ?? "open",
  });
  return inbox;
}

export async function toolCommentsShow(input: z.infer<typeof CommentsShowSchema>) {
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
