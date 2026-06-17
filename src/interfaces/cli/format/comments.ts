import type { CommentsListResult } from "@/core/operations/comments.js";
import type { CommentInbox, CommentResolvePlan } from "@/core/comments/inbox.js";
import type { ResolveThreadResult } from "@/core/comments/storage.js";
import { formatInboxForChat, formatPlanForChat } from "@/core/comments/inbox.js";
import { formatThreadListText } from "@/core/comments/storage.js";
import {
  isDocumentAnchor,
  isPrototypeAnchor,
  threadCommentType,
} from "@/core/comments/types.js";

export function formatCommentsList(result: CommentsListResult): string {
  return [formatThreadListText(result.threads), "", `${result.count} thread(s)`].join("\n");
}

export function formatCommentsInbox(inbox: CommentInbox): string {
  return formatInboxForChat(inbox);
}

export function formatCommentsPlan(plan: CommentResolvePlan): string {
  return formatPlanForChat(plan);
}

export function formatCommentsShow(thread: NonNullable<unknown>): string {
  const t = thread as {
    threadId: string;
    filePath: string;
    docPath?: string;
    status: string;
    version: number;
    anchor: import("@/core/comments/types.js").CommentAnchor;
    comments: Array<{ createdAt: string; authorId: string; body: string }>;
    events: Array<{ at: string; type: string; by?: string; username?: string; role?: string }>;
  };
  const commentType = threadCommentType(t);
  const lines: string[] = [];
  lines.push(`Thread: ${t.threadId}`);
  lines.push(`Type: ${commentType}`);
  lines.push(`File: ${t.filePath}`);
  lines.push(`Target: ${t.docPath ?? "(unknown)"}`);
  lines.push(`Status: ${t.status} (v${t.version})`);
  if (isPrototypeAnchor(t.anchor)) {
    lines.push(
      `Anchor: ${t.anchor.selector} @ ${t.anchor.url} on ${t.anchor.branchName}@${t.anchor.baseCommitSha.slice(0, 7)}`,
    );
    if (t.anchor.textExcerpt) lines.push(`Excerpt: ${t.anchor.textExcerpt}`);
  } else if (isDocumentAnchor(t.anchor)) {
    lines.push(
      `Anchor: lines ${t.anchor.startLine}-${t.anchor.endLine} (${t.anchor.language}) on ${t.anchor.branchName}@${t.anchor.baseCommitSha.slice(0, 7)}`,
    );
    if (t.anchor.lineExcerpt) lines.push(`Excerpt: ${t.anchor.lineExcerpt}`);
  }
  lines.push("", "Comments:");
  for (const c of t.comments) lines.push(`  [${c.createdAt}] ${c.authorId}: ${c.body}`);
  if (t.events.length > 0) {
    lines.push("", "Events:");
    for (const e of t.events) {
      const who =
        e.username && e.by ? `${e.username} <${e.by}>` : e.by != null ? String(e.by) : null;
      lines.push(`  ${e.at} ${e.type}${who != null ? ` by ${who}` : ""}${e.role ? ` (${e.role})` : ""}`);
    }
  }
  return lines.join("\n");
}

export function formatCommentsResolve(result: ResolveThreadResult, threadId: string): string {
  const prefix = result.dryRun ? "[dry-run] " : "";
  const lines = [
    `${prefix}Resolved thread ${threadId} on ${result.thread.filePath}`,
    `Suggested commit message: ${result.commitMessageSuggestion}`,
  ];
  if (result.dryRun) {
    lines.push("No files written (--dry-run).");
  } else {
    lines.push(`Updated: comments/${result.thread.filePath}/${threadId}/meta_data.json`);
    lines.push(`Appended: comments/${result.thread.filePath}/${threadId}/events.jsonl`);
  }
  return lines.join("\n");
}
