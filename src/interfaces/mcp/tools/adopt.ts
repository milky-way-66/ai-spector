import type { z } from "zod";
import { loadDocflowConfig } from "@/core/config/load.js";
import { runAdoptApply } from "@/core/adopt/apply.js";
import { runAdoptBootstrap } from "@/core/adopt/bootstrap.js";
import { runAdoptPlan, approveAdoptPlan } from "@/core/adopt/plan.js";
import { runAdoptScan } from "@/core/adopt/scan.js";
import { markAdoptSetupItem, recordAdoptAnswer } from "@/core/adopt/setup.js";
import { validateAdopt } from "@/core/adopt/validate.js";
import { getActiveTaskForSlot } from "@/core/operations/task.js";
import type {
  AdoptApplySchema,
  AdoptBootstrapSchema,
  AdoptContextRecordSchema,
  AdoptPlanSchema,
  AdoptScanSchema,
  AdoptSetupMarkSchema,
  AdoptValidateSchema,
} from "../schemas.js";

async function resolveRoot(root?: string): Promise<string> {
  const loaded = await loadDocflowConfig(root);
  return loaded.root;
}

export async function toolAdoptScan(input: z.infer<typeof AdoptScanSchema>) {
  return runAdoptScan({ root: input.root });
}

export async function toolAdoptPlan(input: z.infer<typeof AdoptPlanSchema>) {
  const plan = await runAdoptPlan({ root: input.root, sync: input.sync });
  if (input.approve) {
    return approveAdoptPlan({ root: input.root, by: input.by });
  }
  return plan;
}

export async function toolAdoptApply(input: z.infer<typeof AdoptApplySchema>) {
  const root = await resolveRoot(input.root);
  const activeTask = input.legacy ? null : await getActiveTaskForSlot(root, "adopt");
  return runAdoptApply({
    root: input.root,
    dryRun: input.dryRun,
    legacy: input.legacy,
    activeTask,
  });
}

export async function toolAdoptBootstrap(input: z.infer<typeof AdoptBootstrapSchema>) {
  const root = await resolveRoot(input.root);
  const activeTask = input.legacy ? null : await getActiveTaskForSlot(root, "adopt");
  return runAdoptBootstrap({
    root: input.root,
    skipAnalyze: input.skipAnalyze,
    legacy: input.legacy,
    activeTask,
  });
}

export async function toolAdoptValidate(input: z.infer<typeof AdoptValidateSchema>) {
  return validateAdopt({ root: input.root, sync: input.sync });
}

export async function toolAdoptSetupMark(input: z.infer<typeof AdoptSetupMarkSchema>) {
  const root = await resolveRoot(input.root);
  return markAdoptSetupItem(root, input.itemId);
}

export async function toolAdoptContextRecord(input: z.infer<typeof AdoptContextRecordSchema>) {
  const root = await resolveRoot(input.root);
  await recordAdoptAnswer(root, input.id, input.answer);
  return { id: input.id, answer: input.answer };
}
