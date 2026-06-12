import type { z } from "zod";
import type {
  TaskAbandonSchema,
  TaskApprovePlanSchema,
  TaskCompleteSchema,
  TaskCreateSchema,
  TaskGetSchema,
  TaskListSchema,
  TaskPauseSchema,
  TaskResumeSchema,
  TaskUpdateSchema,
} from "../schemas.js";
import {
  runTaskAbandon,
  runTaskApprovePlan,
  runTaskComplete,
  runTaskCreate,
  runTaskGet,
  runTaskList,
  runTaskPause,
  runTaskResume,
  runTaskUpdate,
} from "@/core/operations/task.js";

export async function toolTaskCreate(input: z.infer<typeof TaskCreateSchema>) {
  return runTaskCreate({
    root: input.root,
    kind: input.kind,
    workflow: input.workflow,
    trigger: input.trigger,
    docType: input.docType,
    force: input.force,
  });
}

export async function toolTaskList(input: z.infer<typeof TaskListSchema>) {
  return runTaskList({
    root: input.root,
    status: input.status,
    kind: input.kind,
    workflow: input.workflow,
    recentOnly: input.recentOnly,
  });
}

export async function toolTaskGet(input: z.infer<typeof TaskGetSchema>) {
  return runTaskGet({ root: input.root, taskId: input.taskId });
}

export async function toolTaskUpdate(input: z.infer<typeof TaskUpdateSchema>) {
  return runTaskUpdate({
    root: input.root,
    taskId: input.taskId,
    patch: input.patch as import("@/core/operations/task.js").TaskUpdatePatch,
  });
}

export async function toolTaskApprovePlan(input: z.infer<typeof TaskApprovePlanSchema>) {
  return runTaskApprovePlan({
    root: input.root,
    taskId: input.taskId,
    plan: input.plan as import("@/core/operations/task.js").StoredPlan | undefined,
  });
}

export async function toolTaskPause(input: z.infer<typeof TaskPauseSchema>) {
  return runTaskPause({ root: input.root, taskId: input.taskId });
}

export async function toolTaskResume(input: z.infer<typeof TaskResumeSchema>) {
  return runTaskResume({ root: input.root, taskId: input.taskId });
}

export async function toolTaskComplete(input: z.infer<typeof TaskCompleteSchema>) {
  return runTaskComplete({
    root: input.root,
    taskId: input.taskId,
    summary: input.summary,
  });
}

export async function toolTaskAbandon(input: z.infer<typeof TaskAbandonSchema>) {
  return runTaskAbandon({
    root: input.root,
    taskId: input.taskId,
    reason: input.reason,
  });
}
