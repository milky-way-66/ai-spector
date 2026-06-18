import { describe, expect, it } from "vitest";
import {
  assertAdoptApplyAllowed,
  assertTaskApproveAdoptPlanAllowed,
} from "@/core/operations/adopt-gates.js";
import { TaskPreconditionError } from "@/core/operations/task-gates.js";
import type { TaskState } from "@/core/operations/task.js";
import { getWorkflowTemplate } from "@/core/operations/task-templates.js";

function makeAdoptTask(overrides: Partial<TaskState> = {}): TaskState {
  const now = new Date().toISOString();
  const template = getWorkflowTemplate("adopt");
  return {
    version: 1,
    id: "task-adopt-test",
    kind: "adopt",
    workflow: "adopt",
    status: "active",
    createdAt: now,
    updatedAt: now,
    trigger: "test",
    phase: "plan",
    phaseStatus: "in_progress",
    goal: null,
    plan: null,
    planApprovedAt: null,
    steps: template.steps.map((s) => ({
      ...s,
      status: "pending" as const,
      blocker: null,
      artifacts: [],
    })),
    currentStepId: "plan",
    nextAction: "plan",
    blockers: [],
    contextRefs: {},
    snapshot: {},
    ...overrides,
  };
}

describe("assertTaskApproveAdoptPlanAllowed", () => {
  it("rejects when check/clarify incomplete", () => {
    const task = makeAdoptTask();
    expect(() => assertTaskApproveAdoptPlanAllowed(task)).toThrow(TaskPreconditionError);
  });

  it("allows when gates satisfied", () => {
    const task = makeAdoptTask({
      snapshot: {
        workspaceCheckAt: "t",
        adoptClarifyCompleteAt: "t",
        adoptPlanPresentedAt: "t",
      },
      plan: {
        kind: "adopt",
        plan: {
          moveCount: 1,
          layers: { srs: 1, basicDesign: 0, detailDesign: 0, prototype: 0 },
          lowConfidenceCount: 0,
          classification: {
            srs: "reshaped",
            basicDesign: "missing",
            detailDesign: "missing",
            prototype: "missing",
            languages: { detected: ["en"], strategy: "flat" },
            dataSource: "absent",
            activePack: "builtin",
          },
          warnings: [],
        },
      },
      steps: makeAdoptTask().steps.map((s) => ({
        ...s,
        status: s.id === "check" || s.id === "clarify" ? "done" : s.status,
      })),
    });
    expect(() => assertTaskApproveAdoptPlanAllowed(task)).not.toThrow();
  });
});

describe("assertAdoptApplyAllowed", () => {
  it("rejects without plan approval", () => {
    const task = makeAdoptTask();
    expect(() => assertAdoptApplyAllowed(task, { legacy: false })).toThrow(
      TaskPreconditionError,
    );
  });

  it("allows legacy bypass", () => {
    expect(() => assertAdoptApplyAllowed(null, { legacy: true })).not.toThrow();
  });
});
