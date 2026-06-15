import type { ExtractedSpec, SpecStore } from "../operations/extracted.js";
import type { TaskState } from "../operations/task.js";

/** Routing hints returned alongside tool results (same pattern as review_status). */
export interface WorkflowToolGuidance {
  phase: string;
  message: string;
  nextTools: string[];
  notTheseTools: string[];
  canProceed?: boolean;
}

const REVIEW_APPROVE = "review_approve";
const SPEC_APPROVE = "spec_approve";
const TASK_APPROVE = "task_approve_plan";
const COMMENTS_RESOLVE = "comments_resolve";

export function buildTaskWorkflowGuidance(task: TaskState): WorkflowToolGuidance {
  if (task.planApprovedAt) {
    const executeTools =
      task.kind === "resolve"
        ? ["resolve_task", "graph_impact", "index", "task_complete"]
        : ["task_record_wave", "index", "spec_record", "task_complete"];
    return {
      phase: "plan_approved",
      message:
        "Plan approved — execute the task steps. Use task_approve_plan only once; this is not document sign-off (review_approve).",
      nextTools: executeTools,
      notTheseTools: [REVIEW_APPROVE, SPEC_APPROVE, COMMENTS_RESOLVE],
      canProceed: true,
    };
  }

  if (task.plan) {
    return {
      phase: "awaiting_plan_approval",
      message:
        "Plan is drafted — show GoalSpec + TaskPlan to the user and wait for explicit yes, then task_approve_plan.",
      nextTools: ["task_update", TASK_APPROVE],
      notTheseTools: [REVIEW_APPROVE, SPEC_APPROVE, COMMENTS_RESOLVE],
      canProceed: false,
    };
  }

  return {
    phase: "planning",
    message: "Clarify gaps → build GoalSpec + TaskPlan → wait for user yes → task_approve_plan before any doc writes.",
    nextTools: ["task_update", "context_list"],
    notTheseTools: [REVIEW_APPROVE, TASK_APPROVE, SPEC_APPROVE, COMMENTS_RESOLVE],
    canProceed: false,
  };
}

function pendingSpecs(stores: SpecStore[]): ExtractedSpec[] {
  return stores.flatMap((s) => s.specs).filter((s) => s.status === "pending");
}

export function buildSpecListWorkflowGuidance(stores: SpecStore[]): WorkflowToolGuidance {
  const pending = pendingSpecs(stores);
  if (pending.length === 0) {
    return {
      phase: "no_pending_specs",
      message:
        "No pending extracted specs in queue. Approve specs with spec_approve (SPEC-NNN) after generation stage 6 — not review_approve.",
      nextTools: ["spec_list", "spec_record"],
      notTheseTools: [REVIEW_APPROVE, TASK_APPROVE],
    };
  }

  const ids = pending
    .slice(0, 3)
    .map((s) => s.id)
    .join(", ");
  const suffix = pending.length > 3 ? ` (+${pending.length - 3} more)` : "";

  return {
    phase: "pending_specs",
    message: `${pending.length} spec(s) pending (${ids}${suffix}). User approves with spec_approve — not review_approve or task_approve_plan.`,
    nextTools: ["spec_approve", "spec_reject"],
    notTheseTools: [REVIEW_APPROVE, TASK_APPROVE, COMMENTS_RESOLVE],
    canProceed: true,
  };
}

export function buildCommentsInboxWorkflowGuidance(openCount: number): WorkflowToolGuidance {
  if (openCount === 0) {
    return {
      phase: "inbox_empty",
      message: "No open comment threads. Formal document sign-off uses review_* tools, not comments_resolve.",
      nextTools: ["comments_list"],
      notTheseTools: [REVIEW_APPROVE, SPEC_APPROVE, TASK_APPROVE],
    };
  }

  return {
    phase: "threads_open",
    message: `${openCount} open thread(s) — pick C-NNN, address feedback, then comments_resolve. Not formal document sign-off (review_approve).`,
    nextTools: ["comments_show", "comments_resolve"],
    notTheseTools: [REVIEW_APPROVE, SPEC_APPROVE, TASK_APPROVE],
    canProceed: true,
  };
}
