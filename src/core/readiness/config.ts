import { join } from "node:path";
import type { DocflowConfig, PackManifest, ReadinessConfig } from "../config/types.js";
import { loadDocflowConfig, resolveActivePackManifest } from "../config/load.js";
import { pathExists } from "../util/fs.js";
import { listReadinessProfiles } from "./profiles.js";
import { resolveCriteriaFilePath } from "./criteria-path.js";

export type ProfileSource =
  | "config.docTypes"
  | "config.profile"
  | "inferred.arc42"
  | "inferred.general";

export interface ResolvedDocTypeReadiness {
  docType: string;
  enabled: boolean;
  profile: string;
  profileSource: ProfileSource;
  packName: string | null;
  criteriaPath: string | null;
  completenessRulesPath: string | null;
}

export interface ReadinessConfigStatus {
  configured: boolean;
  configPath: string;
  readiness: ReadinessConfig;
  packs: { srs: string; basicDesign: string };
  docTypes: ResolvedDocTypeReadiness[];
  availableProfiles: Awaited<ReturnType<typeof listReadinessProfiles>>;
  profileDrift: {
    detected: boolean;
    lastScannedProfile?: string;
    lastScannedAt?: string;
    lastScannedDocType?: string;
    currentProfile?: string;
    message?: string;
  };
  suggestions: string[];
}

const DEFAULT_DOC_TYPES = ["srs", "basic-design"] as const;

export function isReadinessExplicitlyConfigured(config: DocflowConfig): boolean {
  const r = config.readiness;
  if (!r) return false;
  if (r.profile) return true;
  if (r.docTypes && Object.keys(r.docTypes).length > 0) return true;
  return false;
}

export function resolveProfileForDocType(
  config: DocflowConfig,
  manifest: PackManifest | null,
  docType: string,
): { profile: string; profileSource: ProfileSource } {
  const perDoc = config.readiness?.docTypes?.[docType];
  if (perDoc?.profile) {
    return { profile: perDoc.profile, profileSource: "config.docTypes" };
  }
  if (config.readiness?.profile) {
    return { profile: config.readiness.profile, profileSource: "config.profile" };
  }
  const purpose = (manifest?.purpose ?? "").toLowerCase();
  if (docType === "arc42" || purpose.includes("arc42") || purpose.includes("architecture")) {
    return { profile: "arc42", profileSource: "inferred.arc42" };
  }
  return { profile: "general", profileSource: "inferred.general" };
}

export function isDocTypeEnabled(config: DocflowConfig, docType: string): boolean {
  const perDoc = config.readiness?.docTypes?.[docType];
  if (perDoc?.enabled === false) return false;
  return true;
}

async function completenessRulesPath(
  root: string,
  docType: string,
  packName: string | null,
): Promise<string | null> {
  const configDir = join(root, ".ai-spector/.docflow/config");
  if (packName) {
    const p = join(configDir, `completeness-rules.${packName}.json`);
    if (await pathExists(p)) return p.replace(root + "/", "");
    const packP = join(root, ".ai-spector/packs", packName, "completeness-rules.json");
    if (await pathExists(packP)) return packP.replace(root + "/", "");
  }
  const builtin = join(configDir, `completeness-rules.${docType}.json`);
  if (await pathExists(builtin)) return builtin.replace(root + "/", "");
  return null;
}

export async function resolveReadinessConfigStatus(opts: {
  root?: string;
}): Promise<ReadinessConfigStatus> {
  const { root, config, configFile } = await loadDocflowConfig(opts.root);
  const manifest = await resolveActivePackManifest(root, config);
  const readiness: ReadinessConfig = config.readiness ?? {};
  const suggestions: string[] = [];

  if (!isReadinessExplicitlyConfigured(config)) {
    suggestions.push(
      'Set readiness in docflow.config.json — e.g. { "readiness": { "profile": "regulated" } }',
    );
  }

  const docTypeKeys = new Set<string>([...DEFAULT_DOC_TYPES]);
  if (manifest?.docType) docTypeKeys.add(manifest.docType);
  if (readiness.docTypes) {
    for (const k of Object.keys(readiness.docTypes)) docTypeKeys.add(k);
  }

  const docTypes: ResolvedDocTypeReadiness[] = [];
  for (const docType of docTypeKeys) {
    const { profile, profileSource } = resolveProfileForDocType(config, manifest, docType);
    const enabled = isDocTypeEnabled(config, docType);
    const criteriaResolved = await resolveCriteriaFilePath(root, config, docType);
    const packName =
      docType === "srs"
        ? config.packs.srs === "builtin"
          ? null
          : config.packs.srs
        : docType === "basic-design"
          ? config.packs.basicDesign === "builtin"
            ? null
            : config.packs.basicDesign
          : criteriaResolved.packName;

    docTypes.push({
      docType,
      enabled,
      profile,
      profileSource,
      packName,
      criteriaPath: (await pathExists(criteriaResolved.path))
        ? criteriaResolved.path.replace(root + "/", "")
        : null,
      completenessRulesPath: await completenessRulesPath(root, docType, packName),
    });
  }

  const primary = docTypes.find((d) => d.docType === "srs") ?? docTypes[0];
  const lastScan = readiness.lastScan;
  let profileDrift: ReadinessConfigStatus["profileDrift"] = { detected: false };

  if (lastScan?.profile && primary && lastScan.profile !== primary.profile) {
    profileDrift = {
      detected: true,
      lastScannedProfile: lastScan.profile,
      lastScannedAt: lastScan.scannedAt,
      lastScannedDocType: lastScan.docType,
      currentProfile: primary.profile,
      message: `Profile changed from "${lastScan.profile}" to "${primary.profile}" — run readiness_scan to check existing documents.`,
    };
    suggestions.push(profileDrift.message!);
  } else if (!lastScan?.scannedAt && isReadinessExplicitlyConfigured(config)) {
    suggestions.push("Run readiness_scan after configuring profile to validate existing documents.");
  }

  return {
    configured: isReadinessExplicitlyConfigured(config),
    configPath: configFile.replace(root + "/", ""),
    readiness,
    packs: { srs: config.packs.srs, basicDesign: config.packs.basicDesign },
    docTypes,
    availableProfiles: await listReadinessProfiles(),
    profileDrift,
    suggestions,
  };
}

export async function persistReadinessLastScan(
  root: string,
  docType: string,
  profile: string,
): Promise<void> {
  const { configFile } = await loadDocflowConfig(root);
  const { readJson, writeJson } = await import("../util/fs.js");
  const raw = await readJson<Record<string, unknown>>(configFile);
  const readiness = (raw.readiness as ReadinessConfig | undefined) ?? {};
  readiness.lastScan = {
    profile,
    docType,
    scannedAt: new Date().toISOString(),
  };
  raw.readiness = readiness;
  await writeJson(configFile, raw);
}
