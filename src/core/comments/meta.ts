import type { CommentType, ThreadMeta } from "./types.js";
import { isDocumentAnchor, isPrototypeAnchor, threadCommentType } from "./types.js";

export interface NormalizedThreadMeta extends ThreadMeta {
  targetId: string;
  commentType: CommentType;
}

function readTargetId(raw: Record<string, unknown>, commentType: CommentType): string | null {
  const targetId = String(raw.targetId ?? raw.entityId ?? "").trim();
  if (targetId) return targetId;
  if (commentType === "prototype") {
    const screenId = String(raw.screenId ?? "").trim();
    if (screenId) return screenId;
  }
  return null;
}

/** Normalize thread meta from disk (legacy or new shape). */
export function normalizeThreadMeta(raw: unknown): NormalizedThreadMeta | null {
  if (!raw || typeof raw !== "object") return null;
  const m = raw as Record<string, unknown>;
  if (typeof m.threadId !== "string" || typeof m.status !== "string" || m.anchor == null) {
    return null;
  }
  const anchor = m.anchor as ThreadMeta["anchor"];
  if (!isDocumentAnchor(anchor) && !isPrototypeAnchor(anchor)) {
    return null;
  }

  const partial = m as Partial<ThreadMeta>;
  const commentType = threadCommentType({
    commentType: partial.commentType,
    anchor,
  });
  const targetId = readTargetId(m, commentType);
  const filePath =
    typeof m.filePath === "string" && m.filePath.trim()
      ? m.filePath.trim()
      : commentType === "prototype"
        ? "prototype"
        : "";

  if (!targetId && !filePath) return null;
  if (typeof m.version !== "number") return null;

  return {
    ...(m as unknown as ThreadMeta),
    commentType,
    targetId: targetId ?? filePath,
    filePath: filePath || (commentType === "prototype" ? "prototype" : targetId ?? ""),
    anchor,
  };
}

export function isNormalizedThreadMeta(raw: unknown): raw is NormalizedThreadMeta {
  return normalizeThreadMeta(raw) !== null;
}
