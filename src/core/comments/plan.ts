import { computeImpact } from "../graph/impact.js";
import { loadImpactRules } from "../graph/impact-loader.js";
import { loadInMemoryGraph } from "../graph/loadGraph.js";
import {
  pickPrimaryImpactOrigin,
  resolveImpactOrigins,
} from "../graph/resolve.js";
import { readDocAnchorContext, readPrototypeAnchorContext } from "./anchor.js";
import type { CommentListFilters } from "./filters.js";
import { parseScreenFromPhrase } from "./filters.js";
import {
  buildCommentBatchPlan,
  resolveBatchPickId,
  resolveThreadPicks,
} from "./batch.js";
import type { CommentInboxItem } from "./inbox.js";
import {
  buildCommentInbox,
  buildResolvePlan,
  enrichInboxPreviews,
  type CommentInbox,
  type CommentResolvePlan,
} from "./inbox.js";
import { normalizeLogicalPath } from "./paths.js";
import {
  findThreadById,
  getThread,
  listThreads,
  loadCommentBodiesForThreads,
} from "./storage.js";
import { isDocumentAnchor, isPrototypeAnchor, threadCommentType } from "./types.js";

export interface BuildInboxOptions {
  projectRoot: string;
  filters?: CommentListFilters;
  /** @deprecated Use filters */
  filePath?: string;
  /** @deprecated Use filters */
  commentTypes?: import("./types.js").CommentType[];
  /** @deprecated Use filters */
  status?: "open" | "resolved" | "all";
  groupByScreen?: boolean;
}

function resolveInboxFilters(opts: BuildInboxOptions): CommentListFilters {
  if (opts.filters) {
    return opts.filters;
  }
  return {
    filePath: opts.filePath,
    commentTypes: opts.commentTypes,
    status: opts.status ?? "open",
  };
}

export async function buildCommentInboxPayload(
  opts: BuildInboxOptions,
): Promise<CommentInbox> {
  const filters = resolveInboxFilters(opts);
  const threads = await listThreads({
    projectRoot: opts.projectRoot,
    filters,
  });

  const firstComments = await loadCommentBodiesForThreads(opts.projectRoot, threads);
  const base = buildCommentInbox(threads, { groupByScreen: opts.groupByScreen });
  return enrichInboxPreviews(base, firstComments);
}

export interface BuildPlanOptions {
  projectRoot: string;
  graphPath: string;
  rulesPath: string;
  threadId: string;
  filePath?: string;
  pickId?: string;
  filters?: CommentListFilters;
}

export async function buildCommentPlan(
  opts: BuildPlanOptions,
): Promise<CommentResolvePlan> {
  const thread = opts.filePath
    ? await getThread(
        opts.projectRoot,
        normalizeLogicalPath(opts.filePath),
        opts.threadId,
      )
    : await findThreadById(opts.projectRoot, opts.threadId);

  if (!thread) {
    throw new Error(
      opts.filePath
        ? `Thread not found: ${opts.threadId} under ${normalizeLogicalPath(opts.filePath)}`
        : `Thread not found: ${opts.threadId}`,
    );
  }

  const commentType = threadCommentType(thread);
  let anchor: Awaited<ReturnType<typeof readDocAnchorContext>> | Awaited<
    ReturnType<typeof readPrototypeAnchorContext>
  > | null = null;

  if (commentType === "prototype" && isPrototypeAnchor(thread.anchor)) {
    anchor = await readPrototypeAnchorContext(
      opts.projectRoot,
      thread.filePath,
      thread.anchor,
    );
  } else if (isDocumentAnchor(thread.anchor)) {
    anchor = await readDocAnchorContext(
      opts.projectRoot,
      thread.filePath,
      thread.anchor.startLine,
      thread.anchor.endLine,
    );
  }

  let impact = null;
  let resolvedFrom: { id: string; type: string; reason: string } | undefined;

  if (commentType === "document") {
    try {
      const g = await loadInMemoryGraph(opts.graphPath);
      const docAnchor = anchor && "docPath" in anchor ? anchor : null;
      const origins = resolveImpactOrigins(g, {
        file: docAnchor?.docPath ?? thread.docPath ?? undefined,
        heading: docAnchor?.heading,
        sectionAnchor: docAnchor?.sectionAnchor,
        text: isDocumentAnchor(thread.anchor) ? thread.anchor.lineExcerpt : undefined,
      });
      const primary = pickPrimaryImpactOrigin(origins);
      if (primary) {
        resolvedFrom = primary;
        const rules = await loadImpactRules(opts.rulesPath);
        impact = computeImpact(g, primary.id, "content_change", rules);
        impact.resolvedFrom = primary;
      }
    } catch {
      /* graph missing or invalid — plan still usable without impact */
    }
  }

  return buildResolvePlan(thread, anchor, impact, resolvedFrom, opts.pickId);
}

export interface BuildBatchPlanOptions {
  projectRoot: string;
  filters?: CommentListFilters;
  groupByScreen?: boolean;
  batchId?: string;
  picks?: string[];
  screen?: string;
  phrase?: string;
}

export async function buildCommentBatchPlanPayload(opts: BuildBatchPlanOptions) {
  const filters: CommentListFilters = {
    ...(opts.filters ?? { status: "open", commentTypes: ["prototype"] }),
    commentTypes: opts.filters?.commentTypes ?? ["prototype"],
    status: opts.filters?.status ?? "open",
  };

  const screen =
    opts.screen ?? (opts.phrase ? parseScreenFromPhrase(opts.phrase) ?? undefined : undefined);

  const inbox = await buildCommentInboxPayload({
    projectRoot: opts.projectRoot,
    filters,
    groupByScreen: opts.groupByScreen ?? true,
  });

  return buildCommentBatchPlan({
    projectRoot: opts.projectRoot,
    inbox,
    batchId: opts.batchId,
    picks: opts.picks,
    screen,
    filters,
  });
}

export function resolvePickId(
  inbox: CommentInbox,
  token: string,
): CommentInboxItem | undefined {
  const t = token.trim();
  const batch = resolveBatchPickId(inbox, t);
  if (batch) {
    return undefined;
  }
  const byPick = inbox.inbox.find(
    (i) => i.pickId.toLowerCase() === t.toLowerCase(),
  );
  if (byPick) {
    return byPick;
  }
  return inbox.inbox.find((i) => i.threadId === t || i.threadId.startsWith(t));
}

export function resolvePickIds(inbox: CommentInbox, tokens: string[]): CommentInboxItem[] {
  return resolveThreadPicks(inbox, tokens);
}

export function pickIdForThread(inbox: CommentInbox, threadId: string): string | undefined {
  return inbox.inbox.find((i) => i.threadId === threadId)?.pickId;
}
