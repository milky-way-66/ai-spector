import type { ExtractedSpec, SpecStore } from "../operations/extracted.js";
import type { TaskState } from "../operations/task.js";
import type { ReviewSessionFile } from "../reviews/types.js";
import type { WorkflowId } from "./route-intent.js";

/** Routing hints returned alongside tool results (same pattern as review_status). */
export interface WorkflowToolGuidance {
  workflowId?: WorkflowId;
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
const APPROVE_SIBLINGS = [REVIEW_APPROVE, SPEC_APPROVE, TASK_APPROVE, COMMENTS_RESOLVE] as const;

function gateBlockedGuidance(
  workflowId: WorkflowId,
  phase: string,
  message: string,
  nextTools: string[],
): WorkflowToolGuidance {
  return {
    workflowId,
    phase,
    message: `${message} Do not call task_approve_plan yet.`,
    nextTools,
    notTheseTools: [REVIEW_APPROVE, TASK_APPROVE, SPEC_APPROVE, COMMENTS_RESOLVE],
    canProceed: false,
  };
}

export function buildTaskWorkflowGuidance(task: TaskState): WorkflowToolGuidance {
  const workflowId: WorkflowId =
    task.kind === "resolve"
      ? "resolve-task"
      : task.workflow === "generate-basic-design"
        ? "generate-basic-design"
        : task.workflow === "generate-detail-design"
          ? "generate-detail-design"
          : task.workflow === "generate-prototype"
            ? "generate-prototype"
            : "generate-srs";

  if (task.planApprovedAt) {
    const executeTools =
      task.kind === "resolve"
        ? ["resolve_task", "graph_impact", "index", "task_complete"]
        : ["task_record_wave", "index", "spec_record", "task_complete"];
    return {
      workflowId,
      phase: "plan_approved",
      message:
        "Plan approved — execute the task steps. Use task_approve_plan only once; this is not document sign-off (review_approve).",
      nextTools: executeTools,
      notTheseTools: [REVIEW_APPROVE, SPEC_APPROVE, COMMENTS_RESOLVE],
      canProceed: true,
    };
  }

  if (task.plan) {
    if (task.kind === "generate") {
      const checkDone = task.steps.find((s) => s.id === "check")?.status === "done";
      const clarifyDone = task.steps.find((s) => s.id === "clarify")?.status === "done";
      const briefingDone = task.steps.find((s) => s.id === "briefing")?.status === "done";
      if (!checkDone) {
        return gateBlockedGuidance(workflowId, "check", "Run workspace_check, record snapshot.workspaceCheckAt, mark check done.", [
          "workspace_check",
          "task_update",
        ]);
      }
      if (!clarifyDone || !task.snapshot.readinessReportShown) {
        return gateBlockedGuidance(
          workflowId,
          "clarify",
          "Run readiness_assess, show criteria table, set snapshot.readinessReportShown, resolve gaps.",
          ["readiness_assess", "context_list", "task_update"],
        );
      }
      if (!briefingDone || !task.snapshot.briefingConfirmedAt) {
        return gateBlockedGuidance(
          workflowId,
          "briefing",
          "Present per-file context briefing — user must confirm before plan table.",
          ["task_update", "context_list"],
        );
      }
      if (!task.snapshot.planPresentedAt || task.phaseStatus !== "awaiting_user") {
        return gateBlockedGuidance(
          workflowId,
          "plan",
          "Show plan table with criteria/ISO refs — set phaseStatus awaiting_user and snapshot.planPresentedAt.",
          ["task_update"],
        );
      }
    } else if (task.steps.find((s) => s.id === "clarify")?.status !== "done") {
      return gateBlockedGuidance(workflowId, "clarify", "Clarify GoalSpec fields before plan approval.", [
        "task_update",
        "context_list",
      ]);
    } else if (!task.snapshot.planPresentedAt || task.phaseStatus !== "awaiting_user") {
      return gateBlockedGuidance(
        workflowId,
        "plan",
        "Show GoalSpec + TaskPlan — wait for explicit yes (not ok/scope alone).",
        ["task_update"],
      );
    }

    return {
      workflowId,
      phase: "awaiting_plan_approval",
      message:
        'Plan table shown — wait for explicit yes (yes / đồng ý / go ahead). "ok" or scope alone is NOT approval. Then task_approve_plan.',
      nextTools: ["task_update", TASK_APPROVE],
      notTheseTools: [REVIEW_APPROVE, SPEC_APPROVE, COMMENTS_RESOLVE],
      canProceed: false,
    };
  }

  return {
    workflowId,
    phase: "planning",
    message: "Clarify gaps → build GoalSpec + TaskPlan → wait for user yes → task_approve_plan before any doc writes.",
    nextTools: ["task_update", "context_list"],
    notTheseTools: [REVIEW_APPROVE, TASK_APPROVE, SPEC_APPROVE, COMMENTS_RESOLVE],
    canProceed: false,
  };
}

export function buildTaskListWorkflowGuidance(opts: {
  activeForSlot?: { task: TaskState };
  bootstrapped?: { task: TaskState };
}): WorkflowToolGuidance {
  const task = opts.activeForSlot?.task ?? opts.bootstrapped?.task;
  if (task) {
    const g = buildTaskWorkflowGuidance(task);
    return {
      ...g,
      workflowId: opts.activeForSlot ? "task-router" : g.workflowId,
      phase: opts.activeForSlot ? "resume" : g.phase,
      message: opts.activeForSlot
        ? `Active task ${task.id} — call task_resume then hand off to ${g.workflowId} worker.`
        : g.message,
      nextTools: opts.activeForSlot
        ? ["task_resume", "task_get", ...g.nextTools]
        : ["task_get", ...g.nextTools],
    };
  }

  return {
    workflowId: "task-router",
    phase: "list",
    message: "No active task in slot — use bootstrap on task_list or task_create to start a workflow.",
    nextTools: ["task_create", "task_list"],
    notTheseTools: [...APPROVE_SIBLINGS],
    canProceed: false,
  };
}

export function buildTaskApprovePlanWorkflowGuidance(task: TaskState): WorkflowToolGuidance {
  const g = buildTaskWorkflowGuidance(task);
  return {
    ...g,
    phase: "plan_approved",
    message: "Plan approved — execute next steps. Do not call task_approve_plan again.",
    canProceed: true,
  };
}

function pendingSpecs(stores: SpecStore[]): ExtractedSpec[] {
  return stores.flatMap((s) => s.specs).filter((s) => s.status === "pending");
}

export function buildSpecListWorkflowGuidance(stores: SpecStore[]): WorkflowToolGuidance {
  const pending = pendingSpecs(stores);
  if (pending.length === 0) {
    return {
      workflowId: "spec-queue",
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
    workflowId: "spec-queue",
    phase: "pending_specs",
    message: `${pending.length} spec(s) pending (${ids}${suffix}). User approves with spec_approve — not review_approve or task_approve_plan.`,
    nextTools: ["spec_approve", "spec_reject"],
    notTheseTools: [REVIEW_APPROVE, TASK_APPROVE, COMMENTS_RESOLVE],
    canProceed: true,
  };
}

export function buildSpecActionWorkflowGuidance(
  action: "approve" | "reject",
  specId: string,
): WorkflowToolGuidance {
  return {
    workflowId: "spec-queue",
    phase: action === "approve" ? "spec_approved" : "spec_rejected",
    message:
      action === "approve"
        ? `${specId} approved and merged — not document sign-off (review_approve).`
        : `${specId} rejected — remaining pending specs use spec_list.`,
    nextTools: ["spec_list", "graph_validate", "index"],
    notTheseTools: [REVIEW_APPROVE, TASK_APPROVE, COMMENTS_RESOLVE],
    canProceed: true,
  };
}

export function buildCommentsInboxWorkflowGuidance(openCount: number): WorkflowToolGuidance {
  if (openCount === 0) {
    return {
      workflowId: "resolve-comments",
      phase: "inbox_empty",
      message: "No open comment threads. Formal document sign-off uses review_* tools, not comments_resolve.",
      nextTools: ["comments_list"],
      notTheseTools: [REVIEW_APPROVE, SPEC_APPROVE, TASK_APPROVE],
    };
  }

  return {
    workflowId: "resolve-comments",
    phase: "threads_open",
    message: `${openCount} open thread(s) — pick C-NNN, address feedback, then comments_resolve. Not formal document sign-off (review_approve).`,
    nextTools: ["comments_show", "comments_resolve"],
    notTheseTools: [REVIEW_APPROVE, SPEC_APPROVE, TASK_APPROVE],
    canProceed: true,
  };
}

export function buildCommentsPlanWorkflowGuidance(threadId: string): WorkflowToolGuidance {
  return {
    workflowId: "resolve-comments",
    phase: "plan",
    message: `Plan for ${threadId} — propose doc edit, wait for user approval, commit doc + meta, then comments_resolve.`,
    nextTools: ["comments_show"],
    notTheseTools: [REVIEW_APPROVE, SPEC_APPROVE, TASK_APPROVE, COMMENTS_RESOLVE],
    canProceed: false,
  };
}

export function buildCommentsResolveWorkflowGuidance(threadId: string): WorkflowToolGuidance {
  return {
    workflowId: "resolve-comments",
    phase: "resolved",
    message: `${threadId} resolved — not formal document sign-off (review_approve).`,
    nextTools: ["comments_inbox", "comments_list"],
    notTheseTools: [REVIEW_APPROVE, SPEC_APPROVE, TASK_APPROVE],
    canProceed: true,
  };
}

export function buildResolveTaskResultWorkflowGuidance(
  status: "complete" | "partial" | "blocked",
): WorkflowToolGuidance {
  return {
    workflowId: "resolve-task",
    phase: status === "complete" ? "workflow_complete" : status,
    message:
      status === "complete"
        ? "Resolve task finished — call task_complete. Not document sign-off."
        : "Resolve task blocked or partial — fix blockers before task_complete.",
    nextTools: status === "complete" ? ["task_complete", "index"] : ["task_get", "task_update"],
    notTheseTools: [REVIEW_APPROVE, SPEC_APPROVE, COMMENTS_RESOLVE],
    canProceed: status === "complete",
  };
}

export function buildReviewSessionWorkflowGuidance(
  session: ReviewSessionFile,
  opts?: { pendingCount?: number },
): WorkflowToolGuidance {
  const base = {
    workflowId: "doc-review" as const,
    notTheseTools: [SPEC_APPROVE, TASK_APPROVE, COMMENTS_RESOLVE],
  };

  switch (session.phase) {
    case "detect":
      return {
        ...base,
        phase: "detect",
        message: "Review session detect — run review_begin or review_queue next; pick a document.",
        nextTools: ["review_begin", "review_queue", "review_check"],
        canProceed: false,
      };
    case "queue": {
      const n = opts?.pendingCount;
      const suffix = n != null ? ` (${n} pending)` : "";
      return {
        ...base,
        phase: "queue",
        message: `Review queue${suffix} — user picks logicalPath, then review_begin or review_status.`,
        nextTools: ["review_begin", "review_status"],
        canProceed: false,
      };
    }
    case "reviewing":
      return {
        ...base,
        phase: "reviewing",
        message: `Reviewing ${session.activeLogicalPath ?? "document"} — score readiness checklist, write review summary, then review_session_ack_review.`,
        nextTools: [
          "review_begin",
          "review_status",
          "readiness_scan",
          "readiness_output_checklist",
          "graph_impact",
          "review_session_ack_review",
        ],
        canProceed: false,
      };
    case "awaiting_decision":
      return {
        ...base,
        phase: "awaiting_decision",
        message: `Decision gate for ${session.activeLogicalPath ?? "document"} — user Approve → review_approve only now.`,
        nextTools: ["review_approve", "review_reject"],
        canProceed: true,
      };
    case "done":
      return {
        ...base,
        phase: "done",
        message: "Review session complete — start fresh with review_begin or review_check.",
        nextTools: ["review_begin", "review_check", "review_session_start"],
        canProceed: false,
      };
    default:
      return {
        ...base,
        phase: session.phase,
        message: "Follow doc-review worker runbook phases in order.",
        nextTools: ["review_begin", "review_check", "review_queue", "review_status"],
        canProceed: false,
      };
  }
}
