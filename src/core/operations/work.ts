/**
 * work.ts — Alias layer for task operations.
 *
 * Exposes `runWork*` wrappers that map to the underlying `runTask*` functions.
 * `work_create` accepts kind "change" as an alias for "resolve".
 */

import {
  runTaskCreate,
  runTaskList,
  runTaskGet,
  runTaskUpdate,
  runTaskApprovePlan,
  runTaskPause,
  runTaskResume,
  runTaskComplete,
  runTaskAbandon,
  runTaskStatus,
  recordGenerateWaveProgress,
  type TaskCreateOptions,
  type TaskCreateResult,
  type TaskListOptions,
  type TaskListResult,
  type TaskGetOptions,
  type TaskGetResult,
  type TaskUpdateOptions,
  type TaskUpdateResult,
  type TaskApprovePlanOptions,
  type TaskApprovePlanResult,
  type TaskPauseOptions,
  type TaskPauseResult,
  type TaskResumeOptions,
  type TaskResumeResult,
  type TaskCompleteOptions,
  type TaskCompleteResult,
  type TaskAbandonOptions,
  type TaskAbandonResult,
  type TaskStatusResult,
  type RecordGenerateWaveOptions,
} from "./task.js";
import type { TaskKind } from "./task-templates.js";

export type WorkKind = TaskKind | "change";

export type {
  TaskListResult,
  TaskGetResult,
  TaskUpdateResult,
  TaskApprovePlanResult,
  TaskPauseResult,
  TaskResumeResult,
  TaskCompleteResult,
  TaskAbandonResult,
  TaskStatusResult,
};

export type WorkCreateOptions = Omit<TaskCreateOptions, "kind"> & { kind: WorkKind };
export type WorkCreateResult = TaskCreateResult;

/** Create a work item. kind "change" is an alias for "resolve". */
export async function runWorkCreate(opts: WorkCreateOptions): Promise<WorkCreateResult> {
  const kind: TaskKind = opts.kind === "change" ? "resolve" : opts.kind;
  return runTaskCreate({ ...opts, kind });
}

export const runWorkList = runTaskList;
export type WorkListOptions = TaskListOptions;

export const runWorkGet = runTaskGet;
export type WorkGetOptions = TaskGetOptions;

export const runWorkUpdate = runTaskUpdate;
export type WorkUpdateOptions = TaskUpdateOptions;

export const runWorkApprovePlan = runTaskApprovePlan;
export type WorkApprovePlanOptions = TaskApprovePlanOptions;

/** Record a generate-wave step (alias for recordGenerateWaveProgress). */
export const runWorkRecordStep = recordGenerateWaveProgress;
export type WorkRecordStepOptions = RecordGenerateWaveOptions;

export const runWorkPause = runTaskPause;
export type WorkPauseOptions = TaskPauseOptions;

export const runWorkResume = runTaskResume;
export type WorkResumeOptions = TaskResumeOptions;

export const runWorkComplete = runTaskComplete;
export type WorkCompleteOptions = TaskCompleteOptions;

export const runWorkAbandon = runTaskAbandon;
export type WorkAbandonOptions = TaskAbandonOptions;

export const runWorkStatus = runTaskStatus;
