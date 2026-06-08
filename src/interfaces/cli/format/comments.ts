import type { CommentsListResult } from "../../../commands/comments.js";
import type { CommentInbox, CommentResolvePlan } from "../../../comments/inbox.js";
import type { ResolveThreadResult } from "../../../comments/storage.js";
import { formatInboxForChat, formatPlanForChat } from "../../../comments/inbox.js";
import { formatThreadListText } from "../../../comments/storage.js";

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
    anchor: { startLine: number; endLine: number; language: string; branchName: string; baseCommitSha: string; lineExcerpt?: string };
    comments: Array<{ createdAt: string; authorId: string; body: string }>;
    events: Array<{ at: string; type: string; by?: string }>;
  };
  const lines: string[] = [];
  lines.push(`Thread: ${t.threadId}`);
  lines.push(`File: ${t.filePath}`);
  lines.push(`Doc: ${t.docPath ?? "(unknown)"}`);
  lines.push(`Status: ${t.status} (v${t.version})`);
  lines.push(`Anchor: lines ${t.anchor.startLine}-${t.anchor.endLine} (${t.anchor.language}) on ${t.anchor.branchName}@${t.anchor.baseCommitSha.slice(0, 7)}`);
  if (t.anchor.lineExcerpt) lines.push(`Excerpt: ${t.anchor.lineExcerpt}`);
  lines.push("", "Comments:");
  for (const c of t.comments) lines.push(`  [${c.createdAt}] ${c.authorId}: ${c.body}`);
  if (t.events.length > 0) {
    lines.push("", "Events:");
    for (const e of t.events) lines.push(`  ${e.at} ${e.type}${e.by != null ? ` by ${e.by}` : ""}`);
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
