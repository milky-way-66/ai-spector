import { join } from "node:path";
import type { DocopsConfig } from "../types.js";
import { pathExists, readJson } from "../../util/fs.js";
import type { DocumentEntity, RegistryManifest, ScreenEntity } from "./types.js";
import {
  documentEntityRel,
  registryDocumentsDirRel,
  registryManifestRel,
  registryScreensDirRel,
  screenEntityRel,
} from "./paths.js";

export interface RegistryIndex {
  documents: DocumentEntity[];
  documentsById: Map<string, DocumentEntity>;
  documentsByLogicalPath: Map<string, DocumentEntity>;
  documentsByRepoPath: Map<string, DocumentEntity>;
  screens: ScreenEntity[];
  screensById: Map<string, ScreenEntity>;
  manifest: RegistryManifest | null;
}

function indexDocuments(entities: DocumentEntity[]): Pick<
  RegistryIndex,
  "documentsById" | "documentsByLogicalPath" | "documentsByRepoPath"
> {
  const documentsById = new Map<string, DocumentEntity>();
  const documentsByLogicalPath = new Map<string, DocumentEntity>();
  const documentsByRepoPath = new Map<string, DocumentEntity>();

  for (const doc of entities) {
    documentsById.set(doc.entityId, doc);
    documentsByLogicalPath.set(normalizeLogicalKey(doc.logicalPath), doc);
    for (const alias of doc.aliases ?? []) {
      documentsByLogicalPath.set(normalizeLogicalKey(alias), doc);
    }
    for (const repoPath of Object.values(doc.repoDocs)) {
      documentsByRepoPath.set(normalizeRepoKey(repoPath), doc);
    }
  }

  return { documentsById, documentsByLogicalPath, documentsByRepoPath };
}

export function normalizeLogicalKey(path: string): string {
  let p = path.trim().replace(/\\/g, "/").replace(/^\/+|\/+$/g, "");
  if (p.startsWith("docs/")) {
    p = p.slice("docs/".length);
  }
  if (!p.endsWith(".md")) {
    p = `${p}.md`;
  }
  return p.toLowerCase();
}

export function normalizeRepoKey(path: string): string {
  return path.trim().replace(/\\/g, "/").replace(/^\/+/, "").toLowerCase();
}

export async function loadDocumentEntity(
  projectRoot: string,
  config: DocopsConfig,
  entityId: string,
): Promise<DocumentEntity | null> {
  const rel = documentEntityRel(config, entityId);
  const abs = join(projectRoot, rel);
  if (!(await pathExists(abs))) {
    return null;
  }
  return readJson<DocumentEntity>(abs);
}

export async function loadScreenEntity(
  projectRoot: string,
  config: DocopsConfig,
  screenId: string,
): Promise<ScreenEntity | null> {
  const rel = screenEntityRel(config, screenId);
  const abs = join(projectRoot, rel);
  if (!(await pathExists(abs))) {
    return null;
  }
  const raw = await readJson<ScreenEntity>(abs);
  return { ...raw, screenId: raw.screenId || screenId };
}

export async function loadRegistryIndex(
  projectRoot: string,
  config: DocopsConfig,
): Promise<RegistryIndex> {
  const documents = await listDocumentEntities(projectRoot, config);
  const screens = await listScreenEntities(projectRoot, config);
  const docIndex = indexDocuments(documents);
  const screensById = new Map(screens.map((s) => [s.screenId, s]));

  let manifest: RegistryManifest | null = null;
  const manifestAbs = join(projectRoot, registryManifestRel(config));
  if (await pathExists(manifestAbs)) {
    manifest = await readJson<RegistryManifest>(manifestAbs);
  }

  return {
    documents,
    screens,
    manifest,
    ...docIndex,
    screensById,
  };
}

export async function listDocumentEntities(
  projectRoot: string,
  config: DocopsConfig,
): Promise<DocumentEntity[]> {
  const dirRel = registryDocumentsDirRel(config);
  const dirAbs = join(projectRoot, dirRel);
  if (!(await pathExists(dirAbs))) {
    return [];
  }
  const { readdir } = await import("node:fs/promises");
  const entries = await readdir(dirAbs, { withFileTypes: true });
  const out: DocumentEntity[] = [];
  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith(".json")) continue;
    const entity = await readJson<DocumentEntity>(join(dirAbs, entry.name));
    if (entity?.entityId) {
      out.push(entity);
    }
  }
  return out.sort((a, b) => a.logicalPath.localeCompare(b.logicalPath));
}

export async function listScreenEntities(
  projectRoot: string,
  config: DocopsConfig,
): Promise<ScreenEntity[]> {
  const dirRel = registryScreensDirRel(config);
  const dirAbs = join(projectRoot, dirRel);
  if (!(await pathExists(dirAbs))) {
    return [];
  }
  const { readdir } = await import("node:fs/promises");
  const entries = await readdir(dirAbs, { withFileTypes: true });
  const out: ScreenEntity[] = [];
  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith(".json")) continue;
    const entity = await readJson<ScreenEntity>(join(dirAbs, entry.name));
    if (entity?.screenId) {
      out.push(entity);
    }
  }
  return out.sort((a, b) => a.screenId.localeCompare(b.screenId));
}

/** Resolve linked document for a screen entity. */
export function resolveScreenDocument(
  index: RegistryIndex,
  screen: ScreenEntity,
): DocumentEntity | null {
  const id = screen.documentEntityId?.trim();
  if (!id) return null;
  return index.documentsById.get(id) ?? null;
}

export function findDocumentEntityIdForPaths(
  index: Pick<RegistryIndex, "documentsByLogicalPath" | "documentsByRepoPath">,
  candidates: string[],
): string | undefined {
  for (const raw of candidates) {
    const logical = normalizeLogicalKey(raw);
    const byLogical = index.documentsByLogicalPath.get(logical);
    if (byLogical) return byLogical.entityId;

    const repo = normalizeRepoKey(raw);
    const byRepo = index.documentsByRepoPath.get(repo);
    if (byRepo) return byRepo.entityId;
  }
  return undefined;
}
