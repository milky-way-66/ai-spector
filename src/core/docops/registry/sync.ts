import { mkdir, unlink } from "node:fs/promises";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import type { PrototypeScreenMap } from "../../prototype/types.js";
import type { DocopsConfig } from "../types.js";
import { loadOrDeriveDocopsConfig } from "../config.js";
import { resolveDocopsPath } from "../paths.js";
import { pathExists, readJson, writeJsonAtomic } from "../../util/fs.js";
import { discoverDocumentsFromTree } from "./discover.js";
import {
  findDocumentEntityIdForPaths,
  listDocumentEntities,
  loadRegistryIndex,
  normalizeLogicalKey,
  normalizeRepoKey,
} from "./load.js";
import {
  documentEntityRel,
  registryDocumentsDirRel,
  registryManifestRel,
  registryRootRel,
  registryScreensDirRel,
  screenEntityRel,
} from "./paths.js";
import type { DocumentEntity, RegistryManifest, RegistrySyncResult, ScreenEntity } from "./types.js";

export interface RegistrySyncOptions {
  projectRoot: string;
  dryRun?: boolean;
  importScreenMap?: boolean;
}

function isoNow(): string {
  return new Date().toISOString();
}

function repoDocsEqual(a: Record<string, string>, b: Record<string, string>): boolean {
  const keysA = Object.keys(a).sort();
  const keysB = Object.keys(b).sort();
  if (keysA.length !== keysB.length) return false;
  return keysA.every((k, i) => k === keysB[i] && normalizeRepoKey(a[k]!) === normalizeRepoKey(b[k]!));
}

async function syncDocumentEntities(
  projectRoot: string,
  config: DocopsConfig,
  dryRun: boolean,
  actions: string[],
  warnings: string[],
): Promise<{ created: number; updated: number; index: Awaited<ReturnType<typeof loadRegistryIndex>> }> {
  const discovered = await discoverDocumentsFromTree(projectRoot, config);
  const existing = await listDocumentEntities(projectRoot, config);
  const byLogical = new Map(existing.map((d) => [normalizeLogicalKey(d.logicalPath), d]));

  let created = 0;
  let updated = 0;
  const documentsDir = join(projectRoot, registryDocumentsDirRel(config));
  if (!dryRun) {
    await mkdir(documentsDir, { recursive: true });
  }

  for (const disc of discovered) {
    const key = normalizeLogicalKey(disc.logicalPath);
    const prev = byLogical.get(key);
    const now = isoNow();

    if (!prev) {
      const entity: DocumentEntity = {
        schemaVersion: 1,
        entityId: randomUUID(),
        kind: "document",
        docType: disc.docType,
        logicalPath: disc.logicalPath,
        repoDocs: { ...disc.repoDocs },
        displayName: disc.displayName,
        aliases: [],
        createdAt: now,
        updatedAt: now,
      };
      const rel = documentEntityRel(config, entity.entityId);
      actions.push(`create document entity ${entity.logicalPath} → ${rel}`);
      if (!dryRun) {
        await writeJsonAtomic(join(projectRoot, rel), entity);
      }
      byLogical.set(key, entity);
      created++;
      continue;
    }

    const needsUpdate =
      prev.docType !== disc.docType ||
      !repoDocsEqual(prev.repoDocs, disc.repoDocs) ||
      (prev.displayName && disc.displayName && prev.displayName !== disc.displayName);

    if (!needsUpdate) continue;

    const entity: DocumentEntity = {
      ...prev,
      docType: disc.docType,
      logicalPath: disc.logicalPath,
      repoDocs: { ...disc.repoDocs },
      displayName: disc.displayName,
      updatedAt: now,
    };
    const rel = documentEntityRel(config, entity.entityId);
    actions.push(`update document entity ${entity.logicalPath}`);
    if (!dryRun) {
      await writeJsonAtomic(join(projectRoot, rel), entity);
    }
    byLogical.set(key, entity);
    updated++;
  }

  const index = await loadRegistryIndex(projectRoot, config);
  if (discovered.length === 0) {
    warnings.push("No markdown documents discovered under enabled docTypes paths.");
  }
  return { created, updated, index };
}

function screenMapCandidates(screen: {
  screenDocPath?: string;
  screenDocs?: Record<string, string>;
  screenDoc?: string;
}): string[] {
  const out: string[] = [];
  if (screen.screenDocPath?.trim()) out.push(screen.screenDocPath.trim());
  if (screen.screenDoc?.trim()) out.push(screen.screenDoc.trim());
  for (const p of Object.values(screen.screenDocs ?? {})) {
    if (p?.trim()) out.push(p.trim());
  }
  return out;
}

async function importScreensFromMap(
  projectRoot: string,
  config: DocopsConfig,
  dryRun: boolean,
  actions: string[],
  warnings: string[],
  docIndex: Awaited<ReturnType<typeof loadRegistryIndex>>,
  screenMap: PrototypeScreenMap,
): Promise<{ created: number; updated: number; manifest: RegistryManifest | null }> {
  const screensDir = join(projectRoot, registryScreensDirRel(config));
  if (!dryRun) {
    await mkdir(screensDir, { recursive: true });
  }

  let created = 0;
  let updated = 0;
  const now = isoNow();

  for (const screen of screenMap.screens ?? []) {
    const screenId = screen.screenId?.trim();
    if (!screenId) continue;

    const candidates = screenMapCandidates(screen);
    const documentEntityId = findDocumentEntityIdForPaths(docIndex, candidates);
    if (!documentEntityId && candidates.length > 0) {
      warnings.push(
        `Screen ${screenId}: no document entity for spec path(s): ${candidates.join(", ")}`,
      );
    }

    const prev = docIndex.screensById.get(screenId);
    const next: ScreenEntity = {
      schemaVersion: 1,
      screenId,
      kind: "prototype_screen",
      displayName: screen.displayName,
      documentEntityId: documentEntityId ?? prev?.documentEntityId ?? null,
      prototypePath: (screen.prototypePath ?? "").replace(/^\/+/, ""),
      route_exists: screen.route_exists ?? false,
      reviewUrl: screen.reviewUrl ?? null,
      updatedAt: now,
    };

    const rel = screenEntityRel(config, screenId);
    if (!prev) {
      actions.push(`create screen entity ${screenId} → ${rel}`);
      created++;
    } else if (
      prev.prototypePath !== next.prototypePath ||
      prev.route_exists !== next.route_exists ||
      prev.documentEntityId !== next.documentEntityId ||
      prev.displayName !== next.displayName
    ) {
      actions.push(`update screen entity ${screenId}`);
      updated++;
    } else {
      continue;
    }

    if (!dryRun) {
      await writeJsonAtomic(join(projectRoot, rel), next);
    }
    docIndex.screensById.set(screenId, next);
  }

  const manifest: RegistryManifest = {
    schemaVersion: 1,
    buildMode: screenMap.buildMode ?? "static",
    ...(screenMap.defaultScreenId ? { defaultScreenId: screenMap.defaultScreenId } : {}),
    ...(screenMap.reviewHost ? { reviewHost: screenMap.reviewHost } : {}),
    ...(screenMap.projectId ? { projectId: screenMap.projectId } : {}),
    ...(screenMap.deployVersion ? { deployVersion: screenMap.deployVersion } : {}),
    ...(typeof screenMap.directReviewUrl === "boolean"
      ? { directReviewUrl: screenMap.directReviewUrl }
      : {}),
    ...(screenMap.themeName ? { themeName: screenMap.themeName } : {}),
  };

  return { created, updated, manifest };
}

async function resolveScreenMapFile(
  projectRoot: string,
  config: DocopsConfig,
): Promise<{ mapAbs: string; screenMap: PrototypeScreenMap } | null> {
  const screenMapRel = resolveDocopsPath(config.paths, "prototypeScreenMap", { legacy: false });
  const legacyRel = resolveDocopsPath(config.paths, "prototypeScreenMap", { legacy: true });
  for (const rel of [screenMapRel, legacyRel]) {
    const abs = join(projectRoot, rel);
    if (await pathExists(abs)) {
      const screenMap = await readJson<PrototypeScreenMap>(abs);
      return { mapAbs: abs, screenMap };
    }
  }
  return null;
}

async function removeScreenMapFiles(
  projectRoot: string,
  config: DocopsConfig,
  dryRun: boolean,
  actions: string[],
): Promise<boolean> {
  const rels = [
    resolveDocopsPath(config.paths, "prototypeScreenMap", { legacy: false }),
    resolveDocopsPath(config.paths, "prototypeScreenMap", { legacy: true }),
  ];
  let removed = false;
  for (const rel of rels) {
    const abs = join(projectRoot, rel);
    if (!(await pathExists(abs))) continue;
    actions.push(`remove legacy screen-map → ${rel}`);
    if (!dryRun) {
      await unlink(abs);
    }
    removed = true;
  }
  return removed;
}

/** Write prototype screens from an in-memory screen-map into registry/screens/. */
export async function writeRegistryScreensFromScreenMap(
  projectRoot: string,
  screenMap: PrototypeScreenMap,
  opts?: { dryRun?: boolean },
): Promise<void> {
  const config = await loadOrDeriveDocopsConfig(projectRoot);
  const dryRun = opts?.dryRun ?? false;
  const actions: string[] = [];
  const warnings: string[] = [];
  const docIndex = await loadRegistryIndex(projectRoot, config);
  const screenResult = await importScreensFromMap(
    projectRoot,
    config,
    dryRun,
    actions,
    warnings,
    docIndex,
    screenMap,
  );
  if (screenResult.manifest) {
    const manifestRel = registryManifestRel(config);
    actions.push(`write registry manifest → ${manifestRel}`);
    if (!dryRun) {
      await writeJsonAtomic(join(projectRoot, manifestRel), screenResult.manifest);
    }
  }
}

async function importScreensFromScreenMap(
  projectRoot: string,
  config: DocopsConfig,
  dryRun: boolean,
  actions: string[],
  warnings: string[],
  docIndex: Awaited<ReturnType<typeof loadRegistryIndex>>,
): Promise<{
  created: number;
  updated: number;
  manifest: RegistryManifest | null;
  importedFrom: string | null;
}> {
  const resolved = await resolveScreenMapFile(projectRoot, config);
  if (!resolved) {
    return { created: 0, updated: 0, manifest: docIndex.manifest, importedFrom: null };
  }

  const result = await importScreensFromMap(
    projectRoot,
    config,
    dryRun,
    actions,
    warnings,
    docIndex,
    resolved.screenMap,
  );
  return { ...result, importedFrom: resolved.mapAbs };
}

export async function syncDocopsRegistry(
  opts: RegistrySyncOptions,
): Promise<RegistrySyncResult> {
  const config = await loadOrDeriveDocopsConfig(opts.projectRoot);
  const dryRun = opts.dryRun ?? false;
  const actions: string[] = [];
  const warnings: string[] = [];

  const registryDir = join(opts.projectRoot, registryRootRel(config));
  if (!dryRun) {
    await mkdir(registryDir, { recursive: true });
  }

  const docResult = await syncDocumentEntities(
    opts.projectRoot,
    config,
    dryRun,
    actions,
    warnings,
  );

  let screensCreated = 0;
  let screensUpdated = 0;
  let manifestWritten = false;
  let screenMapRemoved = false;
  let manifest: RegistryManifest | null = docResult.index.manifest;

  const shouldImportScreens =
    opts.importScreenMap !== false &&
    (docResult.index.screens.length === 0 || (await screenMapExists(opts.projectRoot, config)));

  if (shouldImportScreens) {
    const screenResult = await importScreensFromScreenMap(
      opts.projectRoot,
      config,
      dryRun,
      actions,
      warnings,
      docResult.index,
    );
    screensCreated = screenResult.created;
    screensUpdated = screenResult.updated;
    if (screenResult.manifest) {
      manifest = screenResult.manifest;
      const manifestRel = registryManifestRel(config);
      actions.push(`write registry manifest → ${manifestRel}`);
      if (!dryRun) {
        await writeJsonAtomic(join(opts.projectRoot, manifestRel), manifest);
      }
      manifestWritten = true;
    }
    if (screenResult.importedFrom) {
      screenMapRemoved = await removeScreenMapFiles(
        opts.projectRoot,
        config,
        dryRun,
        actions,
      );
    }
  }

  return {
    documentsCreated: docResult.created,
    documentsUpdated: docResult.updated,
    screensCreated,
    screensUpdated,
    manifestWritten,
    screenMapRemoved,
    warnings,
    actions,
  };
}

async function screenMapExists(projectRoot: string, config: DocopsConfig): Promise<boolean> {
  for (const rel of [
    resolveDocopsPath(config.paths, "prototypeScreenMap", { legacy: false }),
    resolveDocopsPath(config.paths, "prototypeScreenMap", { legacy: true }),
  ]) {
    if (await pathExists(join(projectRoot, rel))) return true;
  }
  return false;
}
