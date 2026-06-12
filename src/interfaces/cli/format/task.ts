import type {
  TaskCreateResult,
  TaskGetResult,
  TaskListResult,
  TaskState,
  TaskStatusResult,
  TaskUpdateResult,
} from "@/core/operations/task.js";

function statusIcon(status: TaskState["status"]): string {
  if (status === "complete") return "✓";
  if (status === "paused") return "⏸";
  if (status === "blocked") return "✗";
  if (status === "abandoned") return "—";
  return "●";
}

function formatTaskSummary(task: TaskState): string {
  const lines = [
    `${statusIcon(task.status)} ${task.id} [${task.status}] ${task.workflow}`,
    `  trigger:  ${task.trigger}`,
    `  phase:    ${task.phase} (${task.phaseStatus})`,
    `  step:     ${task.currentStepId}`,
    `  next:     ${task.nextAction}`,
  ];
  if (task.planApprovedAt) {
    lines.push(`  plan:     approved ${task.planApprovedAt.slice(0, 10)}`);
  } else if (task.plan) {
    lines.push("  plan:     draft (not approved)");
  }
  if (task.blockers.length > 0) {
    lines.push(`  blocked:  ${task.blockers.join("; ")}`);
  }
  return lines.join("\n");
}

export function formatTaskCreate(result: TaskCreateResult): string {
  const lines = [`Created ${result.task.id}`, formatTaskSummary(result.task)];
  if (result.replacedTaskId) {
    lines.push(`Replaced previous active task ${result.replacedTaskId} (abandoned).`);
  }
  return lines.join("\n");
}

export function formatTaskGet(result: TaskGetResult): string {
  return [result.taskPath, "", formatTaskSummary(result.task)].join("\n");
}

export function formatTaskList(result: TaskListResult): string {
  const lines: string[] = [];
  if (result.bootstrapped) {
    lines.push(`Bootstrapped new task ${result.bootstrapped.task.id} (${result.bootstrapped.task.workflow}).`);
    if (result.bootstrapped.replacedTaskId) {
      lines.push(`Replaced ${result.bootstrapped.replacedTaskId}.`);
    }
    lines.push("");
  }
  if (result.activeForSlot) {
    lines.push(
      `Resumable task for ${result.activeForSlot.slot}: ${result.activeForSlot.taskId} — use task resume.`,
    );
    lines.push("");
  }
  if (result.total === 0) {
    return lines.length > 0
      ? lines.join("\n")
      : "No tasks found.";
  }
  const activeSlots = Object.entries(result.index.active);
  if (activeSlots.length > 0) {
    lines.push("Active slots:");
    for (const [slot, id] of activeSlots) {
      lines.push(`  ${slot} → ${id}`);
    }
    lines.push("");
  }
  for (const task of result.tasks) {
    lines.push(formatTaskSummary(task));
    lines.push("");
  }
  lines.push(`${result.total} task${result.total === 1 ? "" : "s"}`);
  return lines.join("\n");
}

export function formatTaskUpdate(result: TaskUpdateResult): string {
  return [`Updated ${result.task.id}`, formatTaskSummary(result.task)].join("\n");
}

export function formatTaskSimple(action: string, result: { task: TaskState }): string {
  return [`${action} ${result.task.id}`, formatTaskSummary(result.task)].join("\n");
}

export function formatTaskStatus(result: TaskStatusResult): string {
  const active = result.slots;
  if (active.length === 0) {
    return "No active workflow tasks. Run task_list or task_create before generate/resolve.";
  }
  const lines = ["Active workflow slots:"];
  for (const entry of active) {
    if (entry.missing) {
      lines.push(`  ${entry.slot} → ${entry.taskId} (task file missing)`);
      continue;
    }
    if (!entry.task) continue;
    lines.push(`  ${entry.slot} → ${entry.taskId}`);
    lines.push(formatTaskSummary(entry.task).replace(/^/gm, "    "));
    lines.push("");
  }
  return lines.join("\n").trimEnd();
}
