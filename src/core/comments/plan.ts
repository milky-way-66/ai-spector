import { computeImpact, loadImpactRules } from "../graph/impact.js";
import { loadInMemoryGraph } from "../graph/loadGraph.js";
import {
  pickPrimaryImpactOrigin,
  resolveImpactOrigins,
} from "../graph/resolve.js";
import { readDocAnchorContext } from "./anchor.js";
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

export interface BuildInboxOptions {
  projectRoot: string;
  filePath?: string;
  status?: "open" | "resolved" | "all";
}

export async function buildCommentInboxPayload(
  opts: BuildInboxOptions,
): Promise<CommentInbox> {
  const threads = await listThreads({
    projectRoot: opts.projectRoot,
    filePath: opts.filePath,
    status: opts.status ?? "open",
  });

  const firstComments = await loadCommentBodiesForThreads(opts.projectRoot, threads);
  const base = buildCommentInbox(threads);
  return enrichInboxPreviews(base, firstComments);
}

export interface BuildPlanOptions {
  projectRoot: string;
  graphPath: string;
  rulesPath: string;
  threadId: string;
  filePath?: string;
  pickId?: string;
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

  const anchor = await readDocAnchorContext(
    opts.projectRoot,
    thread.filePath,
    thread.anchor.startLine,
    thread.anchor.endLine,
  );

  let impact = null;
  let resolvedFrom: { id: string; type: string; reason: string } | undefined;

  try {
    const g = await loadInMemoryGraph(opts.graphPath);
    const origins = resolveImpactOrigins(g, {
      file: anchor?.docPath ?? thread.docPath ?? undefined,
      heading: anchor?.heading,
      sectionAnchor: anchor?.sectionAnchor,
      text: thread.anchor.lineExcerpt,
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

  return buildResolvePlan(thread, anchor, impact, resolvedFrom, opts.pickId);
}

export function resolvePickId(
  inbox: CommentInbox,
  token: string,
): CommentInboxItem | undefined {
  const t = token.trim();
  const byPick = inbox.inbox.find(
    (i) => i.pickId.toLowerCase() === t.toLowerCase(),
  );
  if (byPick) {
    return byPick;
  }
  return inbox.inbox.find((i) => i.threadId === t || i.threadId.startsWith(t));
}

export function pickIdForThread(inbox: CommentInbox, threadId: string): string | undefined {
  return inbox.inbox.find((i) => i.threadId === threadId)?.pickId;
}
