export type ThreadStatus = "open" | "resolved";

export type AnchorState = "active" | "drifted" | "missing";

export interface CommentAnchor {
  branchName: string;
  baseCommitSha: string;
  filePath: string;
  language: string;
  startLine: number;
  endLine: number;
  lineExcerpt?: string;
  anchorState?: AnchorState;
}

export interface ThreadMeta {
  threadId: string;
  filePath: string;
  originBranch: string;
  status: ThreadStatus;
  version: number;
  createdAt: string;
  updatedAt: string;
  createdBy: number | string;
  resolvedAt: string | null;
  resolvedBy: number | string | null;
  resolvedInCommitSha: string | null;
  anchor: CommentAnchor;
}

export interface CommentBody {
  commentId: string;
  threadId: string;
  body: string;
  authorId: number | string;
  createdAt: string;
  parentCommentId: string | null;
  editedAt: string | null;
  deletedAt: string | null;
}

export type CommentEventType =
  | "thread_created"
  | "reply_added"
  | "comment_edited"
  | "comment_deleted"
  | "resolved"
  | "reopened";

export interface CommentEvent {
  at: string;
  type: CommentEventType;
  by?: number | string;
  commentId?: string;
  resolvedInCommitSha?: string;
}

export interface ThreadSummary extends ThreadMeta {
  replyCount: number;
  threadDir: string;
  docPath: string | null;
}

export interface ThreadDetail extends ThreadSummary {
  comments: CommentBody[];
  events: CommentEvent[];
}
