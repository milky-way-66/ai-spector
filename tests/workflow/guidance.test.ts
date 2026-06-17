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
  it("suggests task_approve_plan when plan exists and gates are complete", () => {
    const g = buildTaskWorkflowGuidance(
      minimalTask({
        kind: "generate",
        workflow: "generate-srs",
        plan: {
          kind: "generate",
          plan: {
            docType: "srs",
            scope: "all",
            briefing: [{ target: "docs/srs/en/1.md" }],
            rows: [
              {
                output: "docs/srs/en/1.md",
                dagNode: "srs.introduction",
                sources: [],
                keyPoints: ["intro"],
              },
            ],
          },
        },
        phaseStatus: "awaiting_user",
        snapshot: {
          workspaceCheckAt: "2026-06-15T00:00:00.000Z",
          readinessReportShown: true,
          briefingConfirmedAt: "2026-06-15T00:00:00.000Z",
          planPresentedAt: "2026-06-15T00:00:00.000Z",
        },
        steps: [
          { id: "check", phase: "check", description: "", status: "done" },
          { id: "clarify", phase: "clarify", description: "", status: "done" },
          { id: "briefing", phase: "briefing", description: "", status: "done" },
          { id: "plan", phase: "plan", description: "", status: "pending" },
        ],
      }),
    );
    expect(g.phase).toBe("awaiting_plan_approval");
    expect(g.nextTools).toContain("task_approve_plan");
    expect(g.notTheseTools).toContain("review_approve");
  });

  it("blocks task_approve_plan when generate gates are incomplete", () => {
    const g = buildTaskWorkflowGuidance(
      minimalTask({
        kind: "generate",
        workflow: "generate-srs",
        plan: {
          kind: "generate",
          plan: {
            docType: "srs",
            scope: "all",
            briefing: [{ target: "docs/srs/en/1.md" }],
            rows: [
              {
                output: "docs/srs/en/1.md",
                dagNode: "srs.introduction",
                sources: [],
                keyPoints: ["intro"],
              },
            ],
          },
        },
      }),
    );
    expect(g.phase).toBe("check");
    expect(g.notTheseTools).toContain("task_approve_plan");
  });

  it("suggests resolve_task when plan approved", () => {
    const g = buildTaskWorkflowGuidance(
      minimalTask({
        planApprovedAt: "2026-06-15T00:00:00.000Z",
        steps: [{ id: "execute", phase: "execute", description: "", status: "pending" }],
      }),
    );
    expect(g.phase).toBe("plan_approved");
    expect(g.nextTools).toContain("resolve_task");
    expect(g.nextTools).toContain("workspace_check");
    expect(g.canProceed).toBe(true);
  });

  it("blocks standard resolve at tier gate when tier not confirmed", () => {
    const g = buildTaskWorkflowGuidance(
      minimalTask({
        snapshot: { resolveTier: "standard" },
        plan: {
          kind: "resolve",
          plan: {
            id: "p1",
            goal: { trigger: "t", domain: "docs", scope: [], criteria: [] },
            steps: [{ id: "s1", description: "edit", tool: "edit", args: {}, status: "pending" }],
            impactMap: [],
            riskLevel: "low",
          },
        },
        steps: [{ id: "clarify", phase: "clarify", description: "", status: "done" }],
      }),
    );
    expect(g.phase).toBe("tier");
    expect(g.notTheseTools).toContain("task_approve_plan");
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
