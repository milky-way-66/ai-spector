import { resolve } from "node:path";
import { loadDocflowConfig } from "../config/load.js";
import { pathExists, readJson } from "../util/fs.js";
import { loadReviewSession } from "../reviews/session.js";
import { classifyWorkflowIntent } from "../workflow/route-intent.js";
import type { WorkflowRouteContext, WorkflowRouteResult } from "../workflow/route-intent.js";
import { recordWorkflowFromHandoff } from "../workflow/active-worker.js";
import { taskFilePath, taskIndexPath, type TaskIndex, type TaskState } from "./task.js";

export interface WorkflowRouteOptions {
  root?: string;
  message: string;
}

async function resolveRoot(root?: string): Promise<string> {
  const loaded = await loadDocflowConfig(root ? resolve(root) : undefined);
  return loaded.root;
}

async function loadFirstActiveTask(
  root: string,
): Promise<WorkflowRouteContext["activeTask"]> {
  const indexPath = taskIndexPath(root);
  if (!(await pathExists(indexPath))) {
    return null;
  }

  const index = await readJson<TaskIndex>(indexPath);
  for (const taskId of Object.values(index.active)) {
    const path = taskFilePath(root, taskId);
    if (!(await pathExists(path))) {
      continue;
    }
    const task = await readJson<TaskState>(path);
    if (task.status === "complete" || task.status === "abandoned") {
      continue;
    }
    return {
      id: task.id,
      kind: task.kind,
      planApproved: !!task.planApprovedAt,
    };
  }
  return null;
}

export async function runWorkflowRoute(opts: WorkflowRouteOptions): Promise<WorkflowRouteResult> {
  const root = await resolveRoot(opts.root);
  const [reviewSession, activeTask] = await Promise.all([
    loadReviewSession(root),
    loadFirstActiveTask(root),
  ]);

  const result = classifyWorkflowIntent(opts.message, { reviewSession, activeTask });
  if (result.handoff) {
    await recordWorkflowFromHandoff(root, result.handoff);
  }
  return result;
}
