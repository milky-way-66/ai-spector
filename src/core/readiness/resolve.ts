import type { DocflowConfig, PackManifest } from "../config/types.js";
import { loadDocflowConfig, resolveActivePackManifest } from "../config/load.js";
import { pathExists, readJson } from "../util/fs.js";
import { resolveProfileForDocType } from "./config.js";
import { resolveCriteriaFilePath } from "./criteria-path.js";
import { loadTailoringProfile, mergeTailoringProfile } from "./profiles.js";
import type { ReadinessCriteriaFile } from "./types.js";

export { resolveCriteriaFilePath } from "./criteria-path.js";

export interface ResolvedReadinessCriteria {
  root: string;
  config: DocflowConfig;
  docType: string;
  packName: string | null;
  profileId: string;
  criteriaPath: string;
  criteria: ReadinessCriteriaFile;
  appliedProfiles: string[];
}

/** @deprecated use resolveProfileForDocType */
export function inferReadinessProfile(
  config: Parameters<typeof resolveProfileForDocType>[0],
  manifest: PackManifest | null,
  docType: string,
  override?: string,
): string {
  if (override) return override;
  return resolveProfileForDocType(config, manifest, docType).profile;
}

export async function loadMergedReadinessCriteria(opts: {
  root?: string;
  docType?: string;
  profile?: string;
}): Promise<ResolvedReadinessCriteria> {
  const { root, config } = await loadDocflowConfig(opts.root);
  const manifest = await resolveActivePackManifest(root, config);
  const resolved = await resolveCriteriaFilePath(root, config, opts.docType);
  const profileId =
    opts.profile ?? resolveProfileForDocType(config, manifest, resolved.docType).profile;

  let base: ReadinessCriteriaFile;
  if (profileId === "arc42") {
    const arc42 = await loadTailoringProfile("arc42");
    if (!arc42) throw new Error("arc42 tailoring profile not found in bundle");
    base = mergeTailoringProfile(
      { version: 1, docType: "arc42", globalCriteria: [], targets: [] },
      arc42,
    );
    return {
      root,
      config,
      docType: "arc42",
      packName: resolved.packName,
      profileId,
      criteriaPath: `readiness/profiles/arc42.json`,
      criteria: base,
      appliedProfiles: base.appliedProfiles ?? ["arc42"],
    };
  }

  if (!(await pathExists(resolved.path))) {
    throw new Error(`Readiness criteria not found: ${resolved.path.replace(root + "/", "")}`);
  }
  base = await readJson<ReadinessCriteriaFile>(resolved.path);

  const profile = await loadTailoringProfile(profileId);
  const criteria = mergeTailoringProfile(base, profile);

  return {
    root,
    config,
    docType: criteria.docType ?? resolved.docType,
    packName: resolved.packName,
    profileId,
    criteriaPath: resolved.path.replace(root + "/", ""),
    criteria,
    appliedProfiles: criteria.appliedProfiles ?? [profileId],
  };
}
