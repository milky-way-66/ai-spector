import { readdir } from "node:fs/promises";
import { join } from "node:path";
import { migrateReviewRegistryToV4, isEntityRegistryKey } from "../reviews/registry-v4.js";
import { loadRegistry, saveRegistry } from "../reviews/storage.js";
import { pathExists } from "../util/fs.js";
import { loadOrDeriveDocopsConfig } from "./config.js";
import { discoverDocumentsFromTree } from "./registry/discover.js";
import { listDocumentEntities } from "./registry/load.js";
import { syncDocopsRegistry } from "./registry/sync.js";

export type EntityKeying = "entityId" | "logicalPath";

/** True when comments/review still use path keys (legacy layout). */
export async function isLegacyPathKeyedProject(projectRoot: string): Promise<boolean> {
  const legacyComments = join(projectRoot, "comments");
  if (await pathExists(legacyComments)) {
    try {
      const entries = await readdir(legacyComments, { withFileTypes: true });
      const hasPathKeyed = entries.some(
        (e) =>
          e.isDirectory() &&
          e.name !== "documents" &&
          e.name !== "screens" &&
          !e.name.startsWith("."),
      );
      if (hasPathKeyed) return true;
    } catch {
      // ignore unreadable legacy folder
    }
  }

  const registry = await loadRegistry(projectRoot);
  if (registry.version === 4) {
    return false;
  }

  const keys = Object.keys(registry.documents ?? {});
  if (keys.length === 0) {
    return false;
  }

  return keys.some((key) => !isEntityRegistryKey(key));
}

export async function detectEntityKeying(projectRoot: string): Promise<EntityKeying> {
  return (await isLegacyPathKeyedProject(projectRoot)) ? "logicalPath" : "entityId";
}

export interface EntityRegistryStatus {
  keying: EntityKeying;
  documentCount: number;
  expectedCount: number;
  synced: boolean;
}

export async function assessEntityRegistry(
  projectRoot: string,
): Promise<EntityRegistryStatus | null> {
  const config = await loadOrDeriveDocopsConfig(projectRoot);
  const caps = config.capabilities ?? {};
  if (!caps.comments && !caps.review) {
    return null;
  }

  const keying = await detectEntityKeying(projectRoot);
  const expected = (await discoverDocumentsFromTree(projectRoot, config)).length;
  const documents = await listDocumentEntities(projectRoot, config);
  const documentCount = documents.length;

  return {
    keying,
    documentCount,
    expectedCount: expected,
    synced: keying === "logicalPath" || (expected === 0 ? documentCount === 0 : documentCount >= expected),
  };
}

export interface BootstrapEntityRegistryResult {
  skipped: boolean;
  skipReason?: string;
  registrySynced: boolean;
  reviewRegistryV4: boolean;
}

/** Greenfield bootstrap: sync entity registry and ensure review registry v4. */
export async function bootstrapEntityRegistry(
  projectRoot: string,
  opts: { dryRun?: boolean; actions?: string[] } = {},
): Promise<BootstrapEntityRegistryResult> {
  const actions = opts.actions;
  const dryRun = opts.dryRun ?? false;

  if (await isLegacyPathKeyedProject(projectRoot)) {
    const reason =
      "legacy path-keyed project — run docops registry sync, comments migrate, review-registry migrate";
    actions?.push(`skip entity registry — ${reason}`);
    return { skipped: true, skipReason: reason, registrySynced: false, reviewRegistryV4: false };
  }

  const config = await loadOrDeriveDocopsConfig(projectRoot);
  const discovered = await discoverDocumentsFromTree(projectRoot, config);
  let registrySynced = false;

  if (discovered.length > 0) {
    const existing = await listDocumentEntities(projectRoot, config);
    if (existing.length < discovered.length) {
      const result = await syncDocopsRegistry({ projectRoot, dryRun });
      for (const line of result.actions) {
        actions?.push(`entity-registry — ${line}`);
      }
      registrySynced = !dryRun && (result.documentsCreated > 0 || result.documentsUpdated > 0);
    }
  }

  const registry = await loadRegistry(projectRoot);
  let reviewRegistryV4 = registry.version === 4;
  if (!reviewRegistryV4) {
    if (dryRun) {
      actions?.push("entity-registry — would upgrade review-queue/registry.json → v4");
    } else if (Object.keys(registry.documents).length === 0) {
      await saveRegistry(projectRoot, { version: 4, documents: {} });
      actions?.push("entity-registry — review-queue/registry.json → v4 (empty scaffold)");
      reviewRegistryV4 = true;
    } else {
      const migrated = await migrateReviewRegistryToV4(projectRoot, { dryRun: false });
      if (migrated.migrated) {
        actions?.push(
          `entity-registry — review-queue/registry.json → v4 (${migrated.rekeyed} rekeyed)`,
        );
        reviewRegistryV4 = true;
      }
      for (const warning of migrated.warnings) {
        actions?.push(`entity-registry warn — ${warning}`);
      }
    }
  }

  return { skipped: false, registrySynced, reviewRegistryV4 };
}

export async function refreshEntityRegistryIfStale(
  projectRoot: string,
): Promise<{ synced: boolean; detail: string }> {
  if (await isLegacyPathKeyedProject(projectRoot)) {
    return { synced: false, detail: "legacy path-keyed project — run entity registry migration" };
  }

  const config = await loadOrDeriveDocopsConfig(projectRoot);
  const discovered = await discoverDocumentsFromTree(projectRoot, config);
  if (discovered.length === 0) {
    return { synced: false, detail: "no design documents on disk" };
  }

  const existing = await listDocumentEntities(projectRoot, config);
  if (existing.length >= discovered.length) {
    return {
      synced: false,
      detail: `${existing.length} entity file(s), ${discovered.length} document(s) on disk`,
    };
  }

  const result = await syncDocopsRegistry({ projectRoot });
  const created = result.documentsCreated;
  const updated = result.documentsUpdated;
  return {
    synced: created > 0 || updated > 0,
    detail: `+${created} ~${updated} entity file(s) (${existing.length} → ${existing.length + created})`,
  };
}
