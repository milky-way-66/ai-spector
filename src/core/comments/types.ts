export type ThreadStatus = "open" | "resolved";

export type AnchorState = "active" | "drifted" | "missing";

export type CommentType = "document" | "prototype";

export interface DocumentCommentAnchor {
  branchName: string;
  baseCommitSha: string;
  filePath: string;
  language: string;
  startLine: number;
  endLine: number;
  lineExcerpt?: string;
  anchorState?: AnchorState;
}

export interface PrototypeCommentAnchor {
  url: string;
  selector: string;
  textExcerpt?: string;
  tagName?: string;
  baseCommitSha: string;
  branchName: string;
  filePath: string;
  anchorState?: AnchorState;
}

export type CommentAnchor = DocumentCommentAnchor | PrototypeCommentAnchor;

/** @deprecated Use DocumentCommentAnchor — kept for gradual migration in callers. */
export type CommentAnchorLegacy = DocumentCommentAnchor;

export interface ThreadMeta {
  threadId: string;
  filePath: string;
  commentType?: CommentType;
  originBranch: string;
  status: ThreadStatus;
  version: number;
  createdAt: string;
  updatedAt: string;
  createdBy: number | string;
  resolvedAt: string | null;
  /** Resolver email (audit). */
  resolvedBy: number | string | null;
  resolvedByUsername?: string | null;
  resolvedByRole?: "user" | "client" | null;
  resolvedInCommitSha: string | null;
  anchor: CommentAnchor;
}

export function isPrototypeAnchor(anchor: CommentAnchor): anchor is PrototypeCommentAnchor {
  return "selector" in anchor && "url" in anchor && !("startLine" in anchor);
}

export function isDocumentAnchor(anchor: CommentAnchor): anchor is DocumentCommentAnchor {
  return "startLine" in anchor && typeof anchor.startLine === "number";
}

export function threadCommentType(meta: Pick<ThreadMeta, "commentType" | "anchor">): CommentType {
  if (meta.commentType === "prototype" || meta.commentType === "document") {
    return meta.commentType;
  }
  return isPrototypeAnchor(meta.anchor) ? "prototype" : "document";
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
  /** Actor email. */
  by?: number | string;
  username?: string;
  role?: "user" | "client";
  commentId?: string;
  resolvedInCommitSha?: string;
}

export interface ThreadSummary extends ThreadMeta {
  replyCount: number;
  threadDir: string;
  /** Repo-relative target file (doc or prototype HTML), when known. */
  docPath: string | null;
}

export interface ThreadDetail extends ThreadSummary {
  comments: CommentBody[];
  events: CommentEvent[];
}
