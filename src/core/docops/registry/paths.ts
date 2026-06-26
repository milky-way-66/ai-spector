import type { DocopsConfig } from "../types.js";
import { resolveDocopsPath } from "../paths.js";

export const REGISTRY_MANIFEST = "manifest.json";
export const REGISTRY_DOCUMENTS_DIR = "documents";
export const REGISTRY_SCREENS_DIR = "screens";

export function registryRootRel(config: Pick<DocopsConfig, "paths">): string {
  return resolveDocopsPath(config.paths, "registry").replace(/\\/g, "/").replace(/\/+$/, "");
}

export function registryManifestRel(config: Pick<DocopsConfig, "paths">): string {
  return `${registryRootRel(config)}/${REGISTRY_MANIFEST}`;
}

export function documentEntityRel(config: Pick<DocopsConfig, "paths">, entityId: string): string {
  return `${registryRootRel(config)}/${REGISTRY_DOCUMENTS_DIR}/${entityId.trim()}.json`;
}

export function screenEntityRel(config: Pick<DocopsConfig, "paths">, screenId: string): string {
  const safe = screenId.trim().replace(/[/\\]/g, "_");
  return `${registryRootRel(config)}/${REGISTRY_SCREENS_DIR}/${safe}.json`;
}

export function registryDocumentsDirRel(config: Pick<DocopsConfig, "paths">): string {
  return `${registryRootRel(config)}/${REGISTRY_DOCUMENTS_DIR}`;
}

export function registryScreensDirRel(config: Pick<DocopsConfig, "paths">): string {
  return `${registryRootRel(config)}/${REGISTRY_SCREENS_DIR}`;
}
