import { cp, mkdir, readdir, rm } from "node:fs/promises";
import { basename, dirname, join } from "node:path";
import { loadOrDeriveDocopsConfig } from "../docops/config.js";
import {
  findDocumentEntityIdForPaths,
  loadRegistryIndex,
  type RegistryIndex,
} from "../docops/registry/index.js";
import { pathExists, readJson, writeJsonAtomic } from "../util/fs.js";
import { normalizeThreadMeta } from "./meta.js";
import { normalizeLogicalPath, screenStemFromPrototypeUrl } from "./paths.js";
import {
  COMMENTS_DOCUMENTS_SEGMENT,
  COMMENTS_SCREENS_SEGMENT,
  documentLocation,
  legacyLocation,
  locationFromRelativeThreadDir,
  parseCommentStoragePath,
  screenLocation,
  threadDirForLocation,
  type CommentStorageLocation,
} from "./target-paths.js";
import { isPrototypeAnchor, threadCommentType } from "./types.js";

export interface CommentsMigrateOptions {
  projectRoot: string;
  dryRun?: boolean;
}

export interface CommentsMigrateResult {
  moved: number;
  skipped: number;
  warnings: string[];
  actions: string[];
}

function resolveDocumentTarget(
  index: RegistryIndex,
  filePath: string,
): CommentStorageLocation | null {
  const candidates = [filePath, normalizeLogicalPath(filePath)];
  const entityId = findDocumentEntityIdForPaths(index, candidates);
  if (!entityId) return null;
  return documentLocation(entityId);
}

function resolveScreenTarget(
  index: RegistryIndex,
  meta: ReturnType<typeof normalizeThreadMeta>,
): CommentStorageLocation | null {
  if (!meta) return null;
  if (isPrototypeAnchor(meta.anchor)) {
    const url = meta.anchor.url?.trim();
    for (const screen of index.screens) {
      const path = screen.prototypePath?.replace(/^\/+/, "") ?? "";
      if (url && (path === url || screenStemFromPrototypeUrl(path) === screenStemFromPrototypeUrl(url))) {
        return screenLocation(screen.screenId);
      }
    }
    if (meta.targetId && index.screensById.has(meta.targetId)) {
      return screenLocation(meta.targetId);
    }
  }
  return null;
}

function resolveTargetLocation(
  index: RegistryIndex,
  storagePath: string,
  meta: ReturnType<typeof normalizeThreadMeta>,
): CommentStorageLocation | null {
  const parsed = parseCommentStoragePath(storagePath);
  if (parsed?.kind === "document") return parsed;
  if (parsed?.kind === "prototype_screen") return parsed;

  if (!meta) return null;
  const commentType = threadCommentType(meta);
  if (commentType === "prototype") {
    return resolveScreenTarget(index, meta);
  }
  return resolveDocumentTarget(index, meta.filePath);
}

async function copyThreadDir(src: string, dest: string): Promise<void> {
  await mkdir(dirname(dest), { recursive: true });
  await cp(src, dest, { recursive: true, force: true });
}

async function discoverLegacyThreadDirs(
  projectRoot: string,
  commentsRoot: string,
): Promise<string[]> {
  const rootAbs = join(projectRoot, commentsRoot);
  if (!(await pathExists(rootAbs))) return [];

  const out: string[] = [];

  async function walk(dir: string): Promise<void> {
    const entries = await readdir(dir, { withFileTypes: true });
    const hasMeta = entries.some((e) => e.isFile() && e.name === "meta_data.json");
    if (hasMeta) {
      out.push(dir);
      return;
    }
    for (const ent of entries) {
      if (ent.isDirectory()) {
        await walk(join(dir, ent.name));
      }
    }
  }

  const top = await readdir(rootAbs, { withFileTypes: true });
  for (const ent of top) {
    if (!ent.isDirectory()) continue;
    if (ent.name === COMMENTS_DOCUMENTS_SEGMENT || ent.name === COMMENTS_SCREENS_SEGMENT) {
      continue;
    }
    await walk(join(rootAbs, ent.name));
  }

  const prototypeDir = join(rootAbs, "prototype");
  if (await pathExists(prototypeDir)) {
    await walk(prototypeDir);
  }

  return out;
}

function upgradedMeta(
  meta: NonNullable<ReturnType<typeof normalizeThreadMeta>>,
  location: CommentStorageLocation,
): Record<string, unknown> {
  return {
    ...meta,
    targetId: location.targetId,
    commentType: location.kind === "prototype_screen" ? "prototype" : "document",
  };
}

export async function migrateCommentsToTargetIds(
  opts: CommentsMigrateOptions,
): Promise<CommentsMigrateResult> {
  const config = await loadOrDeriveDocopsConfig(opts.projectRoot);
  const commentsRoot = config.paths.comments;
  const dryRun = opts.dryRun ?? false;
  const actions: string[] = [];
  const warnings: string[] = [];
  let moved = 0;
  let skipped = 0;

  const index = await loadRegistryIndex(opts.projectRoot, config);
  if (index.documents.length === 0) {
    warnings.push("Registry has no document entities — run `docops registry sync` first.");
  }

  const legacyDirs = await discoverLegacyThreadDirs(opts.projectRoot, commentsRoot);

  for (const threadDirAbs of legacyDirs) {
    const metaPath = join(threadDirAbs, "meta_data.json");
    const raw = await readJson<unknown>(metaPath);
    const meta = normalizeThreadMeta(raw);
    if (!meta) {
      warnings.push(`Skip invalid meta: ${metaPath}`);
      skipped++;
      continue;
    }

    const parentRel = locationFromRelativeThreadDir(
      commentsRoot,
      threadDirAbs,
      opts.projectRoot,
    );
    if (parentRel.kind !== "legacy") {
      skipped++;
      continue;
    }

    const target = resolveTargetLocation(index, parentRel.storagePath, meta);
    if (!target) {
      warnings.push(
        `No registry target for thread ${meta.threadId} (${meta.filePath || parentRel.storagePath})`,
      );
      skipped++;
      continue;
    }

    const threadId = basename(threadDirAbs);
    const destDir = join(
      opts.projectRoot,
      threadDirForLocation(target, threadId, commentsRoot),
    );

    if (await pathExists(destDir)) {
      actions.push(`skip ${threadId} — destination exists (${target.storagePath})`);
      skipped++;
      continue;
    }

    actions.push(`move ${parentRel.storagePath}/${threadId} → ${target.storagePath}/${threadId}`);

    if (!dryRun) {
      await copyThreadDir(threadDirAbs, destDir);
      const newMeta = upgradedMeta(meta, target);
      await writeJsonAtomic(join(destDir, "meta_data.json"), newMeta);
      await rm(threadDirAbs, { recursive: true, force: true });
    }
    moved++;
  }

  return { moved, skipped, warnings, actions };
}

/** Resolve list/get location: prefer ID-based dir when registry knows entity. */
export async function resolveCommentListLocation(
  projectRoot: string,
  filters: {
    entityId?: string;
    screenId?: string;
    filePath?: string;
  },
): Promise<CommentStorageLocation | null> {
  const config = await loadOrDeriveDocopsConfig(projectRoot);
  if (filters.entityId?.trim()) {
    return documentLocation(filters.entityId.trim());
  }
  if (filters.screenId?.trim()) {
    return screenLocation(filters.screenId.trim());
  }
  if (!filters.filePath?.trim()) return null;

  const index = await loadRegistryIndex(projectRoot, config);
  const fp = filters.filePath.trim();
  if (fp === "prototype" || fp.startsWith("prototype/")) {
    return legacyLocation(fp);
  }

  const entityId = findDocumentEntityIdForPaths(index, [fp, normalizeLogicalPath(fp)]);
  if (entityId) {
    return documentLocation(entityId);
  }
  return legacyLocation(fp);
}
