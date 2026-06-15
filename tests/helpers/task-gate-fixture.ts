import { runTaskUpdate } from "@/core/operations/task.js";
import type { GoalSpec, TaskPlan } from "@/core/operations/resolve-task.js";
import type { GeneratePlan, StoredPlan } from "@/core/operations/task.js";

export async function passGenerateGates(
  root: string,
  taskId: string,
  plan: GeneratePlan,
): Promise<void> {
  const now = new Date().toISOString();
  await runTaskUpdate({
    root,
    taskId,
    patch: {
      snapshot: { workspaceCheckAt: now },
      step: { id: "check", patch: { status: "done", completedAt: now } },
    },
  });
  await runTaskUpdate({
    root,
    taskId,
    patch: {
      snapshot: { readinessReportShown: true },
      step: { id: "clarify", patch: { status: "done", completedAt: now } },
    },
  });
  await runTaskUpdate({
    root,
    taskId,
    patch: {
      snapshot: { briefingConfirmedAt: now },
      step: { id: "briefing", patch: { status: "done", completedAt: now } },
    },
  });
  await runTaskUpdate({
    root,
    taskId,
    patch: {
      plan: { kind: "generate", plan } satisfies StoredPlan,
      phase: "plan",
      phaseStatus: "awaiting_user",
      snapshot: { planPresentedAt: now },
      currentStepId: "plan",
    },
  });
}

export async function passResolveGates(
  root: string,
  taskId: string,
  goal: GoalSpec,
  plan: TaskPlan,
): Promise<void> {
  const now = new Date().toISOString();
  await runTaskUpdate({
    root,
    taskId,
    patch: {
      goal,
      step: { id: "clarify", patch: { status: "done", completedAt: now } },
    },
  });
  await runTaskUpdate({
    root,
    taskId,
    patch: {
      plan: { kind: "resolve", plan } satisfies StoredPlan,
      phase: "plan",
      phaseStatus: "awaiting_user",
      snapshot: { planPresentedAt: now },
      currentStepId: "plan",
    },
  });
}
