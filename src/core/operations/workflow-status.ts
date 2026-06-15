import { loadDocflowConfig } from "../config/load.js";
import { resolve } from "node:path";
import { runWorkflowStatus, type WorkflowStatusResult } from "../workflow/active-worker.js";

export interface WorkflowStatusOptions {
  root?: string;
}

async function resolveRoot(root?: string): Promise<string> {
  const loaded = await loadDocflowConfig(root ? resolve(root) : undefined);
  return loaded.root;
}

export async function runWorkflowStatusOp(
  opts: WorkflowStatusOptions = {},
): Promise<WorkflowStatusResult> {
  const root = await resolveRoot(opts.root);
  return runWorkflowStatus(root);
}
