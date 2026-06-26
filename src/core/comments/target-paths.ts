import { join } from "node:path";
import { DEFAULT_DOCOPS_PATHS } from "../docops/paths.js";
import { normalizeLogicalPath } from "./paths.js";

export const COMMENTS_DOCUMENTS_SEGMENT = "documents";
export const COMMENTS_SCREENS_SEGMENT = "screens";

export type CommentTargetKind = "document" | "prototype_screen" | "legacy";

export interface CommentStorageLocation {
  kind: CommentTargetKind;
  /** Canonical list key — entity UUID, screenId, or legacy logical path. */
  targetId: string;
  /** Path under comments root (no leading slash). */
  storagePath: string;
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isDocumentEntityId(id: string): boolean {
  return UUID_RE.test(id.trim());
}

export function documentThreadsDirRel(
  entityId: string,
  commentsRoot: string = DEFAULT_DOCOPS_PATHS.comments,
): string {
  return `${commentsRootRel(commentsRoot)}/${COMMENTS_DOCUMENTS_SEGMENT}/${entityId.trim()}`;
}

export function screenThreadsDirRel(
  screenId: string,
  commentsRoot: string = DEFAULT_DOCOPS_PATHS.comments,
): string {
  const safe = screenId.trim().replace(/[/\\]/g, "_");
  return `${commentsRootRel(commentsRoot)}/${COMMENTS_SCREENS_SEGMENT}/${safe}`;
}

function commentsRootRel(commentsRoot: string): string {
  return commentsRoot.replace(/\\/g, "/").replace(/\/+$/, "");
}

export function threadDirForLocation(
  location: CommentStorageLocation,
  threadId: string,
  commentsRoot: string = DEFAULT_DOCOPS_PATHS.comments,
): string {
  return join(commentsRoot, location.storagePath, threadId.trim()).replace(/\\/g, "/");
}

export function threadMetaForLocation(
  location: CommentStorageLocation,
  threadId: string,
  commentsRoot: string = DEFAULT_DOCOPS_PATHS.comments,
): string {
  return `${threadDirForLocation(location, threadId, commentsRoot)}/meta_data.json`;
}

/** Parse relative path under comments root into a storage location. */
export function parseCommentStoragePath(relativePath: string): CommentStorageLocation | null {
  const p = relativePath.replace(/\\/g, "/").replace(/^\/+|\/+$/g, "");
  if (!p) return null;

  const parts = p.split("/");
  if (parts[0] === COMMENTS_DOCUMENTS_SEGMENT && parts.length >= 2) {
    const entityId = parts[1]!;
    if (!isDocumentEntityId(entityId)) return null;
    return {
      kind: "document",
      targetId: entityId,
      storagePath: `${COMMENTS_DOCUMENTS_SEGMENT}/${entityId}`,
    };
  }
  if (parts[0] === COMMENTS_SCREENS_SEGMENT && parts.length >= 2) {
    const screenId = parts[1]!;
    return {
      kind: "prototype_screen",
      targetId: screenId,
      storagePath: `${COMMENTS_SCREENS_SEGMENT}/${screenId}`,
    };
  }
  return {
    kind: "legacy",
    targetId: p,
    storagePath: p,
  };
}

export function locationFromRelativeThreadDir(
  commentsRoot: string,
  threadDirAbs: string,
  projectRoot: string,
): CommentStorageLocation {
  const root = join(projectRoot, commentsRoot).replace(/\\/g, "/");
  const rel = threadDirAbs.replace(/\\/g, "/").replace(root, "").replace(/^\/+/, "");
  const parent = rel.split("/").slice(0, -1).join("/");
  return parseCommentStoragePath(parent) ?? {
    kind: "legacy",
    targetId: normalizeLogicalPath(parent),
    storagePath: parent,
  };
}

export function legacyLocation(logicalPath: string): CommentStorageLocation {
  const lp = normalizeLogicalPath(logicalPath);
  return { kind: "legacy", targetId: lp, storagePath: lp };
}

export function documentLocation(entityId: string): CommentStorageLocation {
  const id = entityId.trim();
  return {
    kind: "document",
    targetId: id,
    storagePath: `${COMMENTS_DOCUMENTS_SEGMENT}/${id}`,
  };
}

export function screenLocation(screenId: string): CommentStorageLocation {
  const id = screenId.trim().replace(/[/\\]/g, "_");
  return {
    kind: "prototype_screen",
    targetId: id,
    storagePath: `${COMMENTS_SCREENS_SEGMENT}/${id}`,
  };
}
