import { loadOrDeriveDocopsConfig } from "../docops/config.js";
import {
  findDocumentEntityIdForPaths,
  loadRegistryIndex,
  normalizeLogicalKey,
} from "../docops/registry/index.js";
import { loadRegistry, saveRegistry } from "./storage.js";
import type { ApprovalRecord, ApprovalRecordV4, RegistryFile, RegistryFileV4 } from "./types.js";
import { normalizeApprovalRecord } from "./normalize.js";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export interface ReviewRegistryV4MigrateResult {
  migrated: boolean;
  rekeyed: number;
  warnings: string[];
}

function toV4Entry(record: ApprovalRecord): ApprovalRecordV4 {
  const normalized = normalizeApprovalRecord(record);
  return {
    contentHash: normalized.contentHash,
    overallStatus: normalized.overallStatus,
    internal: normalized.internal,
    client: normalized.client,
    snapshotRef: normalized.snapshotRef,
    baselineAnchor: normalized.baselineAnchor,
    lastEventAt: normalized.lastEventAt,
  };
}

/** Rekey review registry v3 (logicalPath keys) → v4 (entityId keys). */
export async function migrateReviewRegistryToV4(
  projectRoot: string,
  opts: { dryRun?: boolean } = {},
): Promise<ReviewRegistryV4MigrateResult> {
  const registry = await loadRegistry(projectRoot);
  if (registry.version === 4) {
    return { migrated: false, rekeyed: 0, warnings: [] };
  }

  const warnings: string[] = [];
  let index: Awaited<ReturnType<typeof loadRegistryIndex>> | null = null;
  try {
    const config = await loadOrDeriveDocopsConfig(projectRoot);
    index = await loadRegistryIndex(projectRoot, config);
  } catch {
    warnings.push("Docops registry unavailable — run `docops registry sync` before review rekey");
  }

  const nextDocuments: Record<string, ApprovalRecordV4> = {};
  let rekeyed = 0;

  for (const [key, record] of Object.entries(registry.documents)) {
    const normalized = normalizeApprovalRecord({ ...record, logicalPath: record.logicalPath ?? key });
    let entityId: string | undefined;

    if (UUID_RE.test(key)) {
      entityId = key;
    } else if (index) {
      entityId = findDocumentEntityIdForPaths(index, [key, normalized.logicalPath]);
    }

    if (!entityId) {
      warnings.push(`No document entity for review entry "${key}" — entry skipped`);
      continue;
    }

    if (entityId !== key) {
      rekeyed++;
    }
    nextDocuments[entityId] = toV4Entry({ ...normalized, logicalPath: normalized.logicalPath });
  }

  const next: RegistryFileV4 = { version: 4, documents: nextDocuments };
  const migrated = Object.keys(nextDocuments).length > 0 || Object.keys(registry.documents).length > 0;
  if (!opts.dryRun && migrated) {
    await saveRegistry(projectRoot, next as RegistryFile);
  }

  return {
    migrated,
    rekeyed,
    warnings,
  };
}

export function approvalFromV4(
  entityId: string,
  logicalPath: string,
  record: ApprovalRecordV4,
): ApprovalRecord {
  return normalizeApprovalRecord({
    version: 3,
    logicalPath,
    contentHash: record.contentHash,
    overallStatus: record.overallStatus,
    internal: record.internal,
    client: record.client,
    snapshotRef: record.snapshotRef,
    baselineAnchor: record.baselineAnchor,
    lastEventAt: record.lastEventAt,
  });
}

export function isEntityRegistryKey(key: string): boolean {
  return UUID_RE.test(key.trim());
}

export function logicalPathFromRegistryKey(
  key: string,
  record: ApprovalRecord | ApprovalRecordV4,
): string {
  if ("logicalPath" in record && record.logicalPath) {
    return record.logicalPath;
  }
  return key;
}

export function normalizeLogicalRegistryKey(key: string): string {
  return normalizeLogicalKey(key);
}
