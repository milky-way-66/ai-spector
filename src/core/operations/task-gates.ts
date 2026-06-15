import type { TaskState } from "./task.js";

type StepStatus = TaskState["steps"][number]["status"];

export type TaskGateReason =
  | "plan_missing"
  | "plan_invalid"
  | "plan_already_approved"
  | "step_incomplete"
  | "snapshot_missing"
  | "step_premature"
  | "plan_not_approved";

export interface TaskPreconditionPayload {
  error: "PRECONDITION_FAILED";
  reason: TaskGateReason;
  message: string;
  hint: string;
  userMessage: string;
  suggestedTools: string[];
  taskId: string;
  workflow: string;
  currentStepId?: string;
  blockedStepId?: string;
}

const NOT_APPROVE_SIBLINGS = ["review_approve", "spec_approve", "comments_resolve"] as const;

const DEFAULT_USER_MESSAGES: Record<TaskGateReason, (task: TaskState) => string> = {
  plan_missing: (t) =>
    `Task ${t.id} has no plan yet — I need to finish clarify, briefing, and show the plan table before you can approve.`,
  plan_invalid: (t) =>
    `Task ${t.id} plan is incomplete — I'll rebuild the plan table with all required rows and context.`,
  plan_already_approved: (t) =>
    `Task ${t.id} plan is already approved — I'll continue with generation, not call task_approve_plan again.`,
  step_incomplete: (t) =>
    `Task ${t.id} skipped mandatory workflow gates — I'll run the missing steps (check → clarify → briefing → plan) before asking for approval.`,
  snapshot_missing: (t) =>
    `Task ${t.id} is missing required gate checkpoints — I'll present the readiness report / briefing in chat and record them before proceeding.`,
  step_premature: () =>
    "That workflow step cannot be marked done yet — earlier gates must finish first.",
  plan_not_approved: (t) =>
    `Task ${t.id} plan is not approved yet — show the plan table and wait for your explicit yes before writing docs.`,
};

/** Thrown when a gated task operation cannot run in the current task state. */
export class TaskPreconditionError extends Error {
  readonly code = "PRECONDITION_FAILED" as const;

  constructor(
    public readonly reason: TaskGateReason,
    message: string,
    public readonly hint: string,
    public readonly suggestedTools: string[] = [],
    public readonly task: TaskState,
    public readonly blockedStepId?: string,
    userMessage?: string,
  ) {
    super(message);
    this.name = "TaskPreconditionError";
    this.userMessage = userMessage ?? DEFAULT_USER_MESSAGES[reason](task);
  }

  readonly userMessage: string;

  toPayload(): TaskPreconditionPayload {
    return {
      error: this.code,
      reason: this.reason,
      message: this.message,
      hint: this.hint,
      userMessage: this.userMessage,
      suggestedTools: this.suggestedTools,
      taskId: this.task.id,
      workflow: this.task.workflow,
      currentStepId: this.task.currentStepId,
      blockedStepId: this.blockedStepId,
    };
  }
}

function stepStatus(task: TaskState, stepId: string): string {
  return task.steps.find((s) => s.id === stepId)?.status ?? "missing";
}

function assertStepDone(
  task: TaskState,
  stepId: string,
  hint: string,
  suggestedTools: string[],
): void {
  const status = stepStatus(task, stepId);
  if (status !== "done") {
    throw new TaskPreconditionError(
      "step_incomplete",
      `Cannot approve plan for task "${task.id}": "${stepId}" must be done (current: ${status}).`,
      hint,
      suggestedTools,
      task,
      stepId,
    );
  }
}

function assertGeneratePlanShape(task: TaskState): void {
  if (!task.plan || task.plan.kind !== "generate") {
    throw new TaskPreconditionError(
      "plan_invalid",
      `Task "${task.id}" has no generate plan.`,
      "Build GeneratePlan (briefing + rows) via task_update after briefing is confirmed.",
      ["task_update", "readiness_assess", "context_list"],
      task,
    );
  }
  const plan = task.plan.plan;
  if (!plan.rows?.length) {
    throw new TaskPreconditionError(
      "plan_invalid",
      `Task "${task.id}" generate plan has no output rows.`,
      "Present the plan table in chat, then store rows via task_update before task_approve_plan.",
      ["task_update"],
      task,
      "plan",
    );
  }
  if (!plan.briefing?.length) {
    throw new TaskPreconditionError(
      "plan_invalid",
      `Task "${task.id}" generate plan has no briefing entries.`,
      "Confirm context briefing per target document, then include briefing[] in the stored plan.",
      ["task_update", "readiness_assess"],
      task,
      "briefing",
    );
  }
}

/** After plan approval, verify gate integrity (for workspace check TASK-004). */
export function listApprovedTaskGateViolations(task: TaskState): string[] {
  if (!task.planApprovedAt) return [];
  const violations: string[] = [];

  if (task.kind === "generate") {
    for (const stepId of ["check", "clarify", "briefing"] as const) {
      if (stepStatus(task, stepId) !== "done") {
        violations.push(`step "${stepId}" is ${stepStatus(task, stepId)} after plan approval`);
      }
    }
    if (!task.snapshot.workspaceCheckAt) violations.push("snapshot.workspaceCheckAt missing");
    if (!task.snapshot.readinessReportShown) violations.push("snapshot.readinessReportShown missing");
    if (!task.snapshot.briefingConfirmedAt) violations.push("snapshot.briefingConfirmedAt missing");
    if (!task.snapshot.planPresentedAt) violations.push("snapshot.planPresentedAt missing");
    if (task.plan?.kind !== "generate" || !task.plan.plan.rows?.length) {
      violations.push("generate plan rows missing");
    }
  } else {
    if (!task.goal) violations.push("goal missing");
    if (!task.snapshot.planPresentedAt) violations.push("snapshot.planPresentedAt missing");
    if (stepStatus(task, "clarify") !== "done") {
      violations.push(`step "clarify" is ${stepStatus(task, "clarify")} after plan approval`);
    }
  }

  return violations;
}

export function assertTaskApprovePlanAllowed(task: TaskState): void {
  if (task.planApprovedAt) {
    throw new TaskPreconditionError(
      "plan_already_approved",
      `Task "${task.id}" plan was already approved at ${task.planApprovedAt}.`,
      "Continue with task_record_wave / resolve_task — do not call task_approve_plan again.",
      ["task_get", "task_record_wave", "resolve_task"],
      task,
    );
  }

  if (!task.plan) {
    throw new TaskPreconditionError(
      "plan_missing",
      `Task "${task.id}" has no plan to approve.`,
      task.kind === "generate"
        ? "Complete check → clarify → briefing, present plan table, wait for explicit yes, then task_approve_plan."
        : "Present GoalSpec + TaskPlan, wait for explicit yes, then task_approve_plan.",
      ["task_update", "workspace_check", "readiness_assess", "context_list"],
      task,
    );
  }

  const planStep = task.steps.find((s) => s.id === "plan");
  if (planStep?.status === "done") {
    throw new TaskPreconditionError(
      "step_premature",
      `Task "${task.id}" has plan step marked done without planApprovedAt — invalid gate state.`,
      "Do not mark the plan step done via task_update. Only task_approve_plan completes the plan gate after user yes.",
      ["task_get", "task_abandon"],
      task,
      "plan",
    );
  }

  if (task.kind === "generate") {
    assertGenerateApproveGates(task);
    return;
  }

  assertResolveApproveGates(task);
}

function assertGenerateApproveGates(task: TaskState): void {
  assertStepDone(
    task,
    "check",
    "Run workspace_check, set snapshot.workspaceCheckAt via task_update, then mark check done.",
    ["workspace_check", "task_update"],
  );
  if (!task.snapshot.workspaceCheckAt) {
    throw new TaskPreconditionError(
      "snapshot_missing",
      `Task "${task.id}" check step done but snapshot.workspaceCheckAt is missing.`,
      "Call workspace_check and record snapshot.workspaceCheckAt via task_update.",
      ["workspace_check", "task_update"],
      task,
      "check",
    );
  }

  assertStepDone(
    task,
    "clarify",
    "Run readiness_assess, present criteria table, set snapshot.readinessReportShown, resolve gaps, then mark clarify done.",
    ["readiness_assess", "context_list", "task_update"],
  );
  if (!task.snapshot.readinessReportShown) {
    throw new TaskPreconditionError(
      "snapshot_missing",
      `Task "${task.id}" clarify step done but readiness report was not recorded.`,
      "Present the full readiness criteria table (ID, ISO, status), then set snapshot.readinessReportShown via task_update.",
      ["readiness_assess", "task_update"],
      task,
      "clarify",
    );
  }

  assertStepDone(
    task,
    "briefing",
    "Present per-file context briefing, get user confirmation, set snapshot.briefingConfirmedAt, then mark briefing done.",
    ["task_update", "context_list"],
  );
  if (!task.snapshot.briefingConfirmedAt) {
    throw new TaskPreconditionError(
      "snapshot_missing",
      `Task "${task.id}" briefing step done but snapshot.briefingConfirmedAt is missing.`,
      "User must confirm the context briefing in chat first — then set snapshot.briefingConfirmedAt via task_update.",
      ["task_update"],
      task,
      "briefing",
    );
  }

  assertGeneratePlanShape(task);

  if (!task.snapshot.planPresentedAt) {
    throw new TaskPreconditionError(
      "snapshot_missing",
      `Task "${task.id}" plan stored but snapshot.planPresentedAt is missing.`,
      "Show the plan table in chat, set phaseStatus to awaiting_user, then set snapshot.planPresentedAt via task_update.",
      ["task_update"],
      task,
      "plan",
    );
  }

  if (task.phaseStatus !== "awaiting_user") {
    throw new TaskPreconditionError(
      "step_incomplete",
      `Task "${task.id}" must have phaseStatus "awaiting_user" before plan approval (current: "${task.phaseStatus}").`,
      'After showing the plan table, set phaseStatus: "awaiting_user" and wait for explicit yes — "ok" or scope alone is not approval.',
      ["task_update"],
      task,
      "plan",
    );
  }
}

function assertResolveApproveGates(task: TaskState): void {
  if (!task.goal) {
    throw new TaskPreconditionError(
      "plan_invalid",
      `Task "${task.id}" has no GoalSpec.`,
      "Clarify intent, set goal via task_update, then present TaskPlan.",
      ["task_update", "context_list"],
      task,
      "clarify",
    );
  }

  if (!task.plan || task.plan.kind !== "resolve" || !task.plan.plan.steps?.length) {
    throw new TaskPreconditionError(
      "plan_invalid",
      `Task "${task.id}" resolve plan has no steps.`,
      "Build TaskPlan with impact map, show table in chat, wait for explicit yes.",
      ["task_update", "graph_impact"],
      task,
      "plan",
    );
  }

  assertStepDone(
    task,
    "clarify",
    "Clarify GoalSpec fields (≤3 questions), then mark clarify done via task_update.",
    ["task_update", "context_list"],
  );

  if (!task.snapshot.planPresentedAt) {
    throw new TaskPreconditionError(
      "snapshot_missing",
      `Task "${task.id}" resolve plan stored but snapshot.planPresentedAt is missing.`,
      "Show GoalSpec + TaskPlan table, set phaseStatus awaiting_user and snapshot.planPresentedAt, then wait for explicit yes.",
      ["task_update"],
      task,
      "plan",
    );
  }

  if (task.phaseStatus !== "awaiting_user") {
    throw new TaskPreconditionError(
      "step_incomplete",
      `Task "${task.id}" must have phaseStatus "awaiting_user" before plan approval (current: "${task.phaseStatus}").`,
      'Wait for explicit yes to the plan table — "ok", "tạo đi", or scope alone is not plan approval.',
      ["task_update"],
      task,
      "plan",
    );
  }
}

/** Gate generate wave progress and doc writes on approved plan. */
export function assertGenerateExecutionAllowed(task: TaskState): void {
  if (task.kind !== "generate") return;
  if (!task.planApprovedAt) {
    throw new TaskPreconditionError(
      "plan_not_approved",
      `Task "${task.id}" plan is not approved — call task_approve_plan after user says yes to the plan table.`,
      "Complete check → clarify → briefing → plan table → explicit yes → task_approve_plan before writing docs or task_record_wave.",
      ["task_get", "task_update", ...NOT_APPROVE_SIBLINGS],
      task,
    );
  }
}

/** Validate step transitions in task_update (fail closed). */
export function assertTaskStepUpdateAllowed(
  task: TaskState,
  stepId: string,
  nextStatus: StepStatus | undefined,
): void {
  if (!nextStatus || nextStatus === "pending" || nextStatus === "in-progress" || nextStatus === "blocked") {
    return;
  }
  if (nextStatus !== "done" && nextStatus !== "skipped") return;

  if (stepId === "plan" && nextStatus === "done" && !task.planApprovedAt) {
    throw new TaskPreconditionError(
      "step_premature",
      `Cannot mark plan step done on task "${task.id}" via task_update — use task_approve_plan after user yes.`,
      "Show plan table, wait for explicit yes, then call task_approve_plan (not task_update step patch).",
      ["task_approve_plan"],
      task,
      "plan",
    );
  }

  if (task.kind !== "generate" || nextStatus !== "done") return;

  if (stepId === "check" && !task.snapshot.workspaceCheckAt) {
    throw new TaskPreconditionError(
      "snapshot_missing",
      `Cannot mark check done on task "${task.id}" until workspace_check ran.`,
      "Call workspace_check, set snapshot.workspaceCheckAt via task_update, then mark check done.",
      ["workspace_check", "task_update"],
      task,
      "check",
    );
  }

  if (stepId === "clarify" && !task.snapshot.readinessReportShown) {
    throw new TaskPreconditionError(
      "snapshot_missing",
      `Cannot mark clarify done on task "${task.id}" until readiness report was shown.`,
      "Present readiness criteria table, set snapshot.readinessReportShown, then mark clarify done.",
      ["readiness_assess", "task_update"],
      task,
      "clarify",
    );
  }

  if (stepId === "briefing") {
    if (stepStatus(task, "clarify") !== "done") {
      throw new TaskPreconditionError(
        "step_incomplete",
        `Cannot mark briefing done on task "${task.id}" until clarify is done.`,
        "Finish clarify (readiness_assess + gaps) before briefing.",
        ["readiness_assess", "task_update"],
        task,
        "briefing",
      );
    }
    if (!task.snapshot.briefingConfirmedAt) {
      throw new TaskPreconditionError(
        "snapshot_missing",
        `Cannot mark briefing done on task "${task.id}" until user confirmed briefing.`,
        "Present context briefing per file, get user confirmation, set snapshot.briefingConfirmedAt.",
        ["task_update"],
        task,
        "briefing",
      );
    }
  }
}

/** When storing a generate plan, briefing gate must be complete. */
export function assertGeneratePlanStoreAllowed(task: TaskState): void {
  if (task.kind !== "generate") return;
  if (stepStatus(task, "briefing") !== "done") {
    throw new TaskPreconditionError(
      "step_incomplete",
      `Cannot store generate plan on task "${task.id}" until briefing step is done.`,
      "Complete briefing confirmation before presenting the plan table.",
      ["task_update"],
      task,
      "plan",
    );
  }
}
