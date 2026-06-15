import { describe, expect, it } from "vitest";
import {
  buildCommentsInboxWorkflowGuidance,
  buildSpecListWorkflowGuidance,
  buildTaskListWorkflowGuidance,
  buildTaskWorkflowGuidance,
} from "@/core/workflow/guidance.js";
import type { SpecStore } from "@/core/operations/extracted.js";
import type { TaskState } from "@/core/operations/task.js";

function minimalTask(overrides: Partial<TaskState>): TaskState {
  return {
    version: 1,
    id: "task-test",
    kind: "resolve",
    workflow: "resolve-task",
    status: "active",
    createdAt: "2026-06-15T00:00:00.000Z",
    updatedAt: "2026-06-15T00:00:00.000Z",
    trigger: "test",
    phase: "plan",
    phaseStatus: "awaiting_user",
    goal: null,
    plan: null,
    planApprovedAt: null,
    steps: [],
    currentStepId: "step-1",
    nextAction: "wait",
    blockers: [],
    contextRefs: {},
    snapshot: {},
    ...overrides,
  };
}

describe("buildTaskWorkflowGuidance", () => {
  it("suggests task_approve_plan when plan exists but not approved", () => {
    const g = buildTaskWorkflowGuidance(minimalTask({ plan: { version: 1, rows: [] } as TaskState["plan"] }));
    expect(g.phase).toBe("awaiting_plan_approval");
    expect(g.nextTools).toContain("task_approve_plan");
    expect(g.notTheseTools).toContain("review_approve");
  });

  it("suggests resolve_task when plan approved", () => {
    const g = buildTaskWorkflowGuidance(
      minimalTask({ planApprovedAt: "2026-06-15T00:00:00.000Z" }),
    );
    expect(g.phase).toBe("plan_approved");
    expect(g.nextTools).toContain("resolve_task");
    expect(g.canProceed).toBe(true);
  });
});

describe("buildSpecListWorkflowGuidance", () => {
  it("names spec_approve when pending specs exist", () => {
    const stores: SpecStore[] = [
      {
        version: 1,
        docType: "srs",
        specs: [
          {
            id: "SPEC-001",
            statement: "test",
            extractedFrom: ["docs/srs/en/a.md"],
            status: "pending",
            createdAt: "2026-06-15T00:00:00.000Z",
          },
        ],
      },
    ];
    const g = buildSpecListWorkflowGuidance(stores);
    expect(g.phase).toBe("pending_specs");
    expect(g.nextTools).toContain("spec_approve");
    expect(g.notTheseTools).toContain("review_approve");
  });
});

describe("buildCommentsInboxWorkflowGuidance", () => {
  it("warns against review_approve when threads open", () => {
    const g = buildCommentsInboxWorkflowGuidance(3);
    expect(g.workflowId).toBe("resolve-comments");
    expect(g.phase).toBe("threads_open");
    expect(g.nextTools).toContain("comments_resolve");
    expect(g.notTheseTools).toContain("review_approve");
  });
});

describe("buildTaskListWorkflowGuidance", () => {
  it("routes resume to task-router", () => {
    const g = buildTaskListWorkflowGuidance({
      activeForSlot: {
        slot: "generate:srs",
        taskId: "t1",
        action: "resume",
        task: minimalTask({ id: "t1", kind: "generate", workflow: "generate-srs" }),
      },
    });
    expect(g.workflowId).toBe("task-router");
    expect(g.nextTools).toContain("task_resume");
  });
});
