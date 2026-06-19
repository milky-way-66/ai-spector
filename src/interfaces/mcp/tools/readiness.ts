import type { z } from "zod";
import {
  runReadinessAssess,
  runReadinessConfig,
  runReadinessGetCriteria,
  runReadinessOutputChecklist,
  runReadinessProfilesList,
  runReadinessScan,
} from "@/core/operations/readiness.js";
import type {
  ReadinessAssessSchema,
  ReadinessConfigSchema,
  ReadinessCriteriaSchema,
  ReadinessOutputChecklistSchema,
  ReadinessProfilesListSchema,
  ReadinessScanSchema,
} from "../schemas.js";

export async function toolReadinessConfig(input: z.infer<typeof ReadinessConfigSchema>) {
  return runReadinessConfig({ root: input.root });
}

export async function toolReadinessScan(input: z.infer<typeof ReadinessScanSchema>) {
  return runReadinessScan({
    root: input.root,
    docType: input.docType,
    profile: input.profile,
    paths: input.paths,
    updateLastScan: input.updateLastScan,
  });
}

export async function toolReadinessAssess(input: z.infer<typeof ReadinessAssessSchema>) {
  return runReadinessAssess({
    root: input.root,
    docType: input.docType,
    profile: input.profile,
    targets: input.targets,
    targetAll: input.targetAll,
    sourceMode: input.sourceMode,
    deriveFrom: input.deriveFrom,
    derivePhase: input.derivePhase,
    workflow: input.workflow,
  });
}

export async function toolReadinessProfilesList(
  _input: z.infer<typeof ReadinessProfilesListSchema>,
) {
  const profiles = await runReadinessProfilesList();
  return { profiles };
}

export async function toolReadinessGetCriteria(input: z.infer<typeof ReadinessCriteriaSchema>) {
  const merged = await runReadinessGetCriteria({
    root: input.root,
    docType: input.docType,
    profile: input.profile,
  });
  return {
    docType: merged.docType,
    packName: merged.packName,
    profile: merged.profileId,
    appliedProfiles: merged.appliedProfiles,
    criteriaPath: merged.criteriaPath,
    summary: {
      globalCriteria: merged.criteria.globalCriteria.length,
      targets: merged.criteria.targets.length,
    },
    criteria: merged.criteria,
  };
}

export async function toolReadinessOutputChecklist(
  input: z.infer<typeof ReadinessOutputChecklistSchema>,
) {
  return runReadinessOutputChecklist({
    root: input.root,
    docType: input.docType,
    profile: input.profile,
    paths: input.paths,
    logicalPath: input.logicalPath,
  });
}
