import { resolveProjectPaths } from "../util/paths.js";
import { formatInboxForChat, formatPlanForChat } from "../comments/inbox.js";
import { normalizeLogicalPath } from "../comments/paths.js";
import {
  buildCommentInboxPayload,
  buildCommentPlan,
  pickIdForThread,
  resolvePickId,
} from "../comments/plan.js";
import {
  findThreadById,
  formatThreadListText,
  getThread,
  listThreads,
  resolveThread,
} from "../comments/storage.js";

export interface CommentsListOptions {
  root?: string;
  filePath?: string;
  status?: "open" | "resolved" | "all";
  json?: boolean;
}

export interface CommentsInboxOptions {
  root?: string;
  filePath?: string;
  status?: "open" | "resolved" | "all";
  json?: boolean;
}

export interface CommentsPlanOptions {
  root?: string;
  threadId: string;
  filePath?: string;
  pick?: string;
  json?: boolean;
}

export interface CommentsShowOptions {
  root?: string;
  threadId: string;
  filePath?: string;
  json?: boolean;
}

export interface CommentsResolveOptions {
  root?: string;
  threadId: string;
  filePath: string;
  resolvedBy?: string;
  commitSha?: string;
  expectedVersion?: number;
  dryRun?: boolean;
  json?: boolean;
}

export async function runCommentsList(opts: CommentsListOptions): Promise<void> {
  const paths = await resolveProjectPaths(opts.root);
  const threads = await listThreads({
    projectRoot: paths.root,
    filePath: opts.filePath,
    status: opts.status ?? "open",
  });

  if (opts.json) {
    console.log(JSON.stringify({ threads, count: threads.length }, null, 2));
    return;
  }

  console.log(formatThreadListText(threads));
  console.log("");
  console.log(`${threads.length} thread(s)`);
}

export async function runCommentsInbox(opts: CommentsInboxOptions): Promise<void> {
  const paths = await resolveProjectPaths(opts.root);
  const inbox = await buildCommentInboxPayload({
    projectRoot: paths.root,
    filePath: opts.filePath,
    status: opts.status ?? "open",
  });

  if (opts.json) {
    console.log(JSON.stringify(inbox, null, 2));
    console.error("");
    console.error("IDE: render inbox.idePresentation.markdown in chat only (see idePresentation.rules).");
    return;
  }

  console.log(formatInboxForChat(inbox));
}

export async function runCommentsPlan(opts: CommentsPlanOptions): Promise<void> {
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
      throw new Error(`Unknown pick id or thread: ${token}. Run: ai-spector comments inbox --json`);
    }
    threadId = item.threadId;
    filePath = item.filePath;
    pickId = item.pickId;
  } else if (!filePath) {
    const inbox = await buildCommentInboxPayload({
      projectRoot: paths.root,
      status: "open",
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
  });

  if (opts.json) {
    console.log(JSON.stringify(plan, null, 2));
    return;
  }

  console.log(formatPlanForChat(plan));
}

export async function runCommentsShow(opts: CommentsShowOptions): Promise<void> {
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

  if (opts.json) {
    console.log(JSON.stringify(thread, null, 2));
    return;
  }

  console.log(`Thread: ${thread.threadId}`);
  console.log(`File: ${thread.filePath}`);
  console.log(`Doc: ${thread.docPath ?? "(unknown)"}`);
  console.log(`Status: ${thread.status} (v${thread.version})`);
  console.log(
    `Anchor: lines ${thread.anchor.startLine}-${thread.anchor.endLine} (${thread.anchor.language}) on ${thread.anchor.branchName}@${thread.anchor.baseCommitSha.slice(0, 7)}`,
  );
  if (thread.anchor.lineExcerpt) {
    console.log(`Excerpt: ${thread.anchor.lineExcerpt}`);
  }
  console.log("");
  console.log("Comments:");
  for (const c of thread.comments) {
    console.log(`  [${c.createdAt}] ${c.authorId}: ${c.body}`);
  }
  if (thread.events.length > 0) {
    console.log("");
    console.log("Events:");
    for (const e of thread.events) {
      console.log(`  ${e.at} ${e.type}${e.by != null ? ` by ${e.by}` : ""}`);
    }
  }
}

export async function runCommentsResolve(opts: CommentsResolveOptions): Promise<void> {
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

  if (opts.json) {
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  const prefix = result.dryRun ? "[dry-run] " : "";
  console.log(`${prefix}Resolved thread ${opts.threadId} on ${result.thread.filePath}`);
  console.log(`Suggested commit message: ${result.commitMessageSuggestion}`);
  if (result.dryRun) {
    console.log("No files written (--dry-run).");
  } else {
    console.log(`Updated: comments/${result.thread.filePath}/${opts.threadId}/meta_data.json`);
    console.log(`Appended: comments/${result.thread.filePath}/${opts.threadId}/events.jsonl`);
  }
}
