import type { TaskState } from "./task.js";
import { TaskPreconditionError } from "./task-gates.js";
import { readJson } from "../util/fs.js";
import { adoptArtifactPaths } from "../adopt/paths.js";
import type { AdoptPlan } from "../adopt/types.js";

function stepStatus(task: TaskState, stepId: string): string {
  return task.steps.find((s) => s.id === stepId)?.status ?? "missing";
}

export function assertTaskApproveAdoptPlanAllowed(
  task: TaskState,
): asserts task is TaskState & { plan: { kind: "adopt" } } {
  if (task.kind !== "adopt") {
    throw new TaskPreconditionError(
      "step_premature",
      `task_approve_adopt_plan is only for adopt tasks (got kind "${task.kind}").`,
      "Use task_approve_plan for generate/resolve; task_approve_import_plan for import.",
      ["task_approve_plan", "task_approve_import_plan"],
      task,
    );
  }
  if (task.planApprovedAt) {
    throw new TaskPreconditionError(
      "plan_already_approved",
      `Adopt task "${task.id}" plan already approved.`,
      "Continue with adopt_apply. Do not call task_approve_adopt_plan again.",
      ["adopt_apply", "task_get"],
      task,
    );
  }
  if (!task.plan || task.plan.kind !== "adopt") {
    throw new TaskPreconditionError(
      "plan_missing",
      `Adopt task "${task.id}" has no adopt plan summary.`,
      "Run adopt_plan, store summary via task_update, present mapping table.",
      ["adopt_plan", "task_update"],
      task,
      "plan",
    );
  }
  if (stepStatus(task, "check") !== "done" || !task.snapshot.workspaceCheckAt) {
    throw new TaskPreconditionError(
      "step_incomplete",
      `Adopt task "${task.id}" — complete check first.`,
      "Run workspace_check, set snapshot.workspaceCheckAt, mark check done.",
      ["workspace_check", "task_update"],
      task,
      "check",
    );
  }
  if (stepStatus(task, "clarify") !== "done" || !task.snapshot.adoptClarifyCompleteAt) {
    throw new TaskPreconditionError(
      "step_incomplete",
      `Adopt task "${task.id}" — complete clarify first.`,
      "Resolve adopt_scan blocking questions, set adoptClarifyCompleteAt.",
      ["adopt_scan", "adopt_context_record", "task_update"],
      task,
      "clarify",
    );
  }
  if (!task.snapshot.adoptPlanPresentedAt) {
    throw new TaskPreconditionError(
      "snapshot_missing",
      `Adopt task "${task.id}" — mapping table not presented.`,
      "Show mapping table in chat, set snapshot.adoptPlanPresentedAt.",
      ["task_update"],
      task,
      "plan",
    );
  }
  if (stepStatus(task, "plan") === "done") {
    throw new TaskPreconditionError(
      "step_premature",
      `Adopt task "${task.id}" plan step done without task_approve_adopt_plan.`,
      "Wait for user yes, then task_approve_adopt_plan — not task_update on plan.",
      ["task_approve_adopt_plan"],
      task,
      "plan",
    );
  }
}

export function assertAdoptApplyAllowed(
  task: TaskState | null,
  opts: { legacy?: boolean },
): void {
  if (opts.legacy) return;
  if (!task || task.kind !== "adopt") {
    throw new TaskPreconditionError(
      "step_incomplete",
      "adopt_apply requires an active adopt task or --legacy.",
      'task_create({ kind: "adopt", workflow: "adopt" }) then task_approve_adopt_plan.',
      ["task_create", "task_approve_adopt_plan"],
      task ?? ({ id: "none", kind: "adopt", workflow: "adopt" } as TaskState),
      "apply",
    );
  }
  if (!task.planApprovedAt || stepStatus(task, "plan") !== "done") {
    throw new TaskPreconditionError(
      "plan_not_approved",
      `Cannot apply — adopt plan not approved for task "${task.id}".`,
      "Present mapping table and call task_approve_adopt_plan after user confirms.",
      ["task_approve_adopt_plan"],
      task,
      "plan",
    );
  }
}

export async function assertAdoptPlanApprovedOnDisk(root: string): Promise<AdoptPlan> {
  const { plan: planPath } = adoptArtifactPaths(root);
  const plan = await readJson<AdoptPlan>(planPath);
  if (plan.status !== "approved" && plan.status !== "applied") {
    throw new Error(`adopt plan status is "${plan.status}" — expected approved`);
  }
  return plan;
}

export function assertAdoptBootstrapAllowed(
  task: TaskState | null,
  opts: { legacy?: boolean },
): void {
  if (opts.legacy) return;
  if (!task || task.kind !== "adopt") {
    throw new Error("adopt_bootstrap requires active adopt task or --legacy");
  }
  if (stepStatus(task, "apply") !== "done" || !task.snapshot.adoptApplyAt) {
    throw new TaskPreconditionError(
      "step_incomplete",
      `Adopt task "${task.id}" — complete apply before bootstrap.`,
      "Run adopt_apply after plan approval, mark apply done.",
      ["adopt_apply", "task_update"],
      task,
      "bootstrap",
    );
  }
}

export function assertAdoptMigrationCompleteAllowed(
  task: TaskState | null,
  opts: { legacy?: boolean; validateReady: boolean },
): void {
  if (opts.legacy) return;
  if (!task || task.kind !== "adopt") {
    throw new Error("migration.complete requires active adopt task or --legacy");
  }
  if (!opts.validateReady) {
    throw new Error("adopt_validate must report ready: true before migration.complete");
  }
  if (stepStatus(task, "validate") !== "done" || !task.snapshot.adoptValidateReadyAt) {
    throw new TaskPreconditionError(
      "step_incomplete",
      `Adopt task "${task.id}" — complete validate before migration.complete.`,
      "Run adopt_validate until ready, mark validate done.",
      ["adopt_validate", "task_update"],
      task,
      "complete",
    );
  }
}
