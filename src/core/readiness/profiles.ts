import { readdir } from "node:fs/promises";
import { join } from "node:path";
import { readinessProfilesDir } from "../config/docflow-paths.js";
import { pathExists, readJson } from "../util/fs.js";
import type {
  ReadinessCriteriaFile,
  ReadinessCriterion,
  ReadinessSeverity,
  ReadinessTarget,
  TailoringProfile,
} from "./types.js";

export { readinessProfilesDir as bundledReadinessProfilesDir } from "../config/docflow-paths.js";

export interface ProfileSummary {
  id: string;
  title: string;
  description?: string;
  default?: boolean;
  extends?: string;
  replaceBase?: boolean;
}

function profileSummaryFromFile(profile: TailoringProfile): ProfileSummary {
  return {
    id: profile.id,
    title: profile.title,
    description: profile.description,
    default: profile.default,
    extends: profile.extends,
    replaceBase: profile.replaceBase,
  };
}

function sortProfileSummaries(profiles: ProfileSummary[]): ProfileSummary[] {
  return [...profiles].sort((a, b) => {
    if (a.default && !b.default) return -1;
    if (!a.default && b.default) return 1;
    return a.id.localeCompare(b.id);
  });
}

export async function listReadinessProfiles(): Promise<ProfileSummary[]> {
  const dir = readinessProfilesDir();
  if (!(await pathExists(dir))) {
    return [{ id: "general", title: "General (default)", default: true }];
  }
  const profiles: ProfileSummary[] = [];
  const files = await readdir(dir);
  for (const file of files) {
    if (!file.endsWith(".json")) continue;
    const profile = await readJson<TailoringProfile>(join(dir, file));
    profiles.push(profileSummaryFromFile(profile));
  }
  return sortProfileSummaries(profiles);
}

/** Profile id marked `default: true`, else `"general"`. */
export async function resolveDefaultReadinessProfileId(): Promise<string> {
  const profiles = await listReadinessProfiles();
  return profiles.find((p) => p.default)?.id ?? "general";
}

export async function loadTailoringProfile(profileId: string): Promise<TailoringProfile | null> {
  const path = join(readinessProfilesDir(), `${profileId}.json`);
  if (!(await pathExists(path))) {
    throw new Error(
      `Unknown readiness profile "${profileId}". Run readiness_profiles_list for available profiles.`,
    );
  }
  return readJson<TailoringProfile>(path);
}

function bumpCriterionSeverity(
  criterion: ReadinessCriterion,
  bumps: Record<string, ReadinessSeverity>,
): ReadinessCriterion {
  const next = bumps[criterion.id];
  return next ? { ...criterion, severity: next } : criterion;
}

function applyAssumptionPolicy(
  criterion: ReadinessCriterion,
  disabled: Set<string>,
): ReadinessCriterion {
  if (!disabled.has(criterion.id)) return criterion;
  return { ...criterion, acceptAssumption: false };
}

function mapCriteria(
  criteria: ReadinessCriterion[],
  bumps: Record<string, ReadinessSeverity>,
  disabled: Set<string>,
): ReadinessCriterion[] {
  return criteria.map((c) => applyAssumptionPolicy(bumpCriterionSeverity(c, bumps), disabled));
}

/**
 * Merge a tailoring profile onto a base readiness criteria file.
 * `arc42` with replaceBase returns the profile as the full criteria document.
 */
export function mergeTailoringProfile(
  base: ReadinessCriteriaFile,
  profile: TailoringProfile | null,
): ReadinessCriteriaFile {
  if (!profile) {
    return { ...base, appliedProfiles: ["general"] };
  }

  if (profile.replaceBase) {
    return {
      version: profile.version ?? 1,
      docType: profile.docType ?? base.docType,
      standards: profile.standards ?? base.standards,
      dimensions: profile.dimensions ?? base.dimensions,
      globalCriteria: profile.globalCriteria ?? [],
      targets: profile.targets ?? [],
      requirementQuality: profile.requirementQuality ?? base.requirementQuality,
      appliedProfiles: [profile.id],
    };
  }

  const bumps = profile.bumpSeverity ?? {};
  const disabled = new Set(profile.disableAssumptions ?? []);

  let globalCriteria = mapCriteria(base.globalCriteria ?? [], bumps, disabled);
  if (profile.addGlobalCriteria?.length) {
    globalCriteria = [...globalCriteria, ...profile.addGlobalCriteria];
  }

  let targets: ReadinessTarget[] = (base.targets ?? []).map((t) => ({
    ...t,
    criteria: mapCriteria(t.criteria ?? [], bumps, disabled),
  }));

  if (profile.addTargetCriteria?.length) {
    for (const add of profile.addTargetCriteria) {
      const existing = targets.find((t) => t.dagNode === add.dagNode);
      if (existing) {
        existing.criteria = [...existing.criteria, ...add.criteria];
      } else {
        targets.push({ dagNode: add.dagNode, criteria: add.criteria });
      }
    }
  }

  return {
    ...base,
    globalCriteria,
    targets,
    appliedProfiles: [profile.id],
  };
}
