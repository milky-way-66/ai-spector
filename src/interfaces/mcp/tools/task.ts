import type { z } from "zod";
import type {
  TaskAbandonSchema,
  TaskRecordWaveSchema,
  TaskApprovePlanSchema,
  TaskApproveImportPlanSchema,
  TaskApprovePackDesignSchema,
  TaskConfirmTierSchema,
  TaskApproveDesignSpecSchema,
  TaskSetExecutionModeSchema,
  TaskCompleteSchema,
  TaskCreateSchema,
  TaskGetSchema,
  TaskListSchema,
  TaskPauseSchema,
  TaskResumeSchema,
  TaskStatusSchema,
  TaskUpdateSchema,
} from "../schemas.js";
import type { WorkflowId } from "@/core/operations/task-templates.js";
import {
  runTaskAbandon,
  runTaskApproveDesignSpec,
  runTaskApproveImportPlan,
  runTaskApprovePackDesign,
  runTaskApprovePlan,
  runTaskComplete,
  runTaskConfirmTier,
  runTaskCreate,
  runTaskGet,
  runTaskList,
  runTaskPause,
  runTaskResume,
  runTaskSetExecutionMode,
  runTaskStatus,
  runTaskUpdate,
  recordGenerateWaveProgress,
} from "../../../core/operations/task.js";

function warnDeprecated(tool: string): void {
  process.stderr.write(`[deprecated] ${tool} — use work_* instead\n`);
}

export async function toolTaskCreate(input: z.infer<typeof TaskCreateSchema>) {
  warnDeprecated("task_create");
  return runTaskCreate({
    root: input.root,
    kind: input.kind,
    workflow: input.workflow as WorkflowId,
    trigger: input.trigger,
    docType: input.docType,
    force: input.force,
  });
}

export async function toolTaskList(input: z.infer<typeof TaskListSchema>) {
  warnDeprecated("task_list");
  return runTaskList({
    root: input.root,
    status: input.status,
    kind: input.kind,
    workflow: input.workflow as WorkflowId | undefined,
    recentOnly: input.recentOnly,
    bootstrap: input.bootstrap
      ? { ...input.bootstrap, workflow: input.bootstrap.workflow as WorkflowId }
      : undefined,
  });
}

export async function toolTaskStatus(input: z.infer<typeof TaskStatusSchema>) {
  warnDeprecated("task_status");
  return runTaskStatus({ root: input.root });
}

export async function toolTaskGet(input: z.infer<typeof TaskGetSchema>) {
  warnDeprecated("task_get");
  return runTaskGet({ root: input.root, taskId: input.taskId });
}

export async function toolTaskUpdate(input: z.infer<typeof TaskUpdateSchema>) {
  warnDeprecated("task_update");
  return runTaskUpdate({
    root: input.root,
    taskId: input.taskId,
    patch: input.patch as import("@/core/operations/task.js").TaskUpdatePatch,
  });
}

export async function toolTaskApprovePlan(input: z.infer<typeof TaskApprovePlanSchema>) {
  warnDeprecated("task_approve_plan");
  return runTaskApprovePlan({
    root: input.root,
    taskId: input.taskId,
    plan: input.plan as import("@/core/operations/task.js").StoredPlan | undefined,
    by: input.by,
    username: input.username,
    role: input.role,
  });
}

export async function toolTaskApproveImportPlan(
  input: z.infer<typeof TaskApproveImportPlanSchema>,
) {
  warnDeprecated("task_approve_import_plan");
  return runTaskApproveImportPlan({
    root: input.root,
    taskId: input.taskId,
    plan: input.plan as import("@/core/operations/task.js").StoredPlan | undefined,
  });
}

export async function toolTaskApprovePackDesign(
  input: z.infer<typeof TaskApprovePackDesignSchema>,
) {
  warnDeprecated("task_approve_pack_design");
  return runTaskApprovePackDesign({
    root: input.root,
    taskId: input.taskId,
    designSpecPath: input.designSpecPath,
  });
}

export async function toolTaskConfirmTier(input: z.infer<typeof TaskConfirmTierSchema>) {
  warnDeprecated("task_confirm_tier");
  return runTaskConfirmTier({
    root: input.root,
    taskId: input.taskId,
    tier: input.tier,
  });
}

export async function toolTaskApproveDesignSpec(
  input: z.infer<typeof TaskApproveDesignSpecSchema>,
) {
  warnDeprecated("task_approve_design_spec");
  return runTaskApproveDesignSpec({
    root: input.root,
    taskId: input.taskId,
    designSpecPath: input.designSpecPath,
  });
}

export async function toolTaskSetExecutionMode(
  input: z.infer<typeof TaskSetExecutionModeSchema>,
) {
  warnDeprecated("task_set_execution_mode");
  return runTaskSetExecutionMode({
    root: input.root,
    taskId: input.taskId,
    mode: input.mode,
  });
}

export async function toolTaskPause(input: z.infer<typeof TaskPauseSchema>) {
  warnDeprecated("task_pause");
  return runTaskPause({ root: input.root, taskId: input.taskId });
}

export async function toolTaskResume(input: z.infer<typeof TaskResumeSchema>) {
  warnDeprecated("task_resume");
  return runTaskResume({ root: input.root, taskId: input.taskId });
}

export async function toolTaskComplete(input: z.infer<typeof TaskCompleteSchema>) {
  warnDeprecated("task_complete");
  return runTaskComplete({
    root: input.root,
    taskId: input.taskId,
    summary: input.summary,
  });
}

export async function toolTaskAbandon(input: z.infer<typeof TaskAbandonSchema>) {
  warnDeprecated("task_abandon");
  return runTaskAbandon({
    root: input.root,
    taskId: input.taskId,
    reason: input.reason,
  });
}

export async function toolTaskRecordWave(input: z.infer<typeof TaskRecordWaveSchema>) {
  warnDeprecated("task_record_wave");
  return recordGenerateWaveProgress({
    root: input.root,
    taskId: input.taskId,
    waveId: input.waveId,
    status: input.status,
    artifacts: input.artifacts,
    blocker: input.blocker,
  });
}
