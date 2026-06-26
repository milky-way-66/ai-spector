import type { z } from "zod";
import type {
  WorkCreateSchema,
  TaskListSchema,
  TaskGetSchema,
  TaskUpdateSchema,
  TaskApprovePlanSchema,
  TaskRecordWaveSchema,
  TaskPauseSchema,
  TaskResumeSchema,
  TaskCompleteSchema,
  TaskAbandonSchema,
  TaskStatusSchema,
} from "../schemas.js";
import type { WorkflowId } from "@/core/operations/task-templates.js";
import {
  runWorkCreate,
  runWorkList,
  runWorkGet,
  runWorkUpdate,
  runWorkApprovePlan,
  runWorkRecordStep,
  runWorkPause,
  runWorkResume,
  runWorkComplete,
  runWorkAbandon,
  runWorkStatus,
} from "../../../core/operations/work.js";

export async function toolWorkCreate(input: z.infer<typeof WorkCreateSchema>) {
  return runWorkCreate({
    root: input.root,
    kind: input.kind as import("@/core/operations/work.js").WorkKind,
    workflow: input.workflow as WorkflowId,
    trigger: input.trigger,
    docType: input.docType,
    force: input.force,
  });
}

export async function toolWorkList(input: z.infer<typeof TaskListSchema>) {
  return runWorkList({
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

export async function toolWorkStatus(input: z.infer<typeof TaskStatusSchema>) {
  return runWorkStatus({ root: input.root });
}

export async function toolWorkGet(input: z.infer<typeof TaskGetSchema>) {
  return runWorkGet({ root: input.root, taskId: input.taskId });
}

export async function toolWorkUpdate(input: z.infer<typeof TaskUpdateSchema>) {
  return runWorkUpdate({
    root: input.root,
    taskId: input.taskId,
    patch: input.patch as import("@/core/operations/task.js").TaskUpdatePatch,
  });
}

export async function toolWorkApprovePlan(input: z.infer<typeof TaskApprovePlanSchema>) {
  return runWorkApprovePlan({
    root: input.root,
    taskId: input.taskId,
    plan: input.plan as import("@/core/operations/task.js").StoredPlan | undefined,
    by: input.by,
    username: input.username,
    role: input.role,
  });
}

export async function toolWorkRecordStep(input: z.infer<typeof TaskRecordWaveSchema>) {
  return runWorkRecordStep({
    root: input.root,
    taskId: input.taskId,
    waveId: input.waveId,
    status: input.status,
    artifacts: input.artifacts,
    blocker: input.blocker,
  });
}

export async function toolWorkPause(input: z.infer<typeof TaskPauseSchema>) {
  return runWorkPause({ root: input.root, taskId: input.taskId });
}

export async function toolWorkResume(input: z.infer<typeof TaskResumeSchema>) {
  return runWorkResume({ root: input.root, taskId: input.taskId });
}

export async function toolWorkComplete(input: z.infer<typeof TaskCompleteSchema>) {
  return runWorkComplete({
    root: input.root,
    taskId: input.taskId,
    summary: input.summary,
  });
}

export async function toolWorkAbandon(input: z.infer<typeof TaskAbandonSchema>) {
  return runWorkAbandon({
    root: input.root,
    taskId: input.taskId,
    reason: input.reason,
  });
}
