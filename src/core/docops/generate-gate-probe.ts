import { join } from "node:path";
import { pathExists, readJson } from "../util/fs.js";

/** True when an active generate work session has a plan table awaiting user yes. */
export async function probeGenerateGatePending(projectRoot: string): Promise<boolean> {
  const indexPath = join(projectRoot, ".ai-spector/.docflow/tasks/index.json");
  if (!(await pathExists(indexPath))) {
    return false;
  }

  const index = await readJson<{ active?: Record<string, string> }>(indexPath).catch(() => null);
  if (!index?.active) {
    return false;
  }

  for (const taskId of Object.values(index.active)) {
    const taskPath = join(projectRoot, ".ai-spector/.docflow/tasks", `${taskId}.json`);
    if (!(await pathExists(taskPath))) {
      continue;
    }
    const task = await readJson<{
      kind?: string;
      planApprovedAt?: string | null;
      plan?: unknown;
      phaseStatus?: string;
      snapshot?: { planPresentedAt?: string };
    }>(taskPath).catch(() => null);
    if (!task || task.kind !== "generate" || task.planApprovedAt) {
      continue;
    }
    if (task.plan && task.snapshot?.planPresentedAt && task.phaseStatus === "awaiting_user") {
      return true;
    }
  }

  return false;
}
