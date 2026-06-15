import { describe, expect, it } from "vitest";
import { classifyWorkflowIntent } from "@/core/workflow/route-intent.js";
import type { WorkflowRouteContext } from "@/core/workflow/route-intent.js";
import type { ReviewSessionFile } from "@/core/reviews/types.js";

const emptyCtx: WorkflowRouteContext = { reviewSession: null, activeTask: null };

function session(phase: ReviewSessionFile["phase"], logicalPath: string | null = null): ReviewSessionFile {
  return {
    version: 1,
    startedAt: "2026-06-15T00:00:00.000Z",
    updatedAt: "2026-06-15T00:00:00.000Z",
    phase,
    activeLogicalPath: logicalPath,
    reviewStatusAt: null,
    reviewWrittenAt: phase === "awaiting_decision" ? "2026-06-15T00:00:00.000Z" : null,
    contentHashAtReview: null,
  };
}

describe("classifyWorkflowIntent", () => {
  it("routes /review to ai-spector-review", () => {
    const r = classifyWorkflowIntent("/review", emptyCtx);
    expect(r.skill).toBe("ai-spector-review");
    expect(r.confidence).toBe("high");
    expect(r.avoidTools).toContain("spec_approve");
  });

  it("routes approve srs path to document sign-off", () => {
    const r = classifyWorkflowIntent("approve srs/01-overview", emptyCtx);
    expect(r.skill).toBe("ai-spector-review");
    expect(r.matchedBy).toBe("logical_path_signoff");
  });

  it("routes SPEC-003 approve to spec workflow", () => {
    const r = classifyWorkflowIntent("approve SPEC-003", emptyCtx);
    expect(r.skill).toBe("ai-spector-generate");
    expect(r.nextTools).toContain("spec_approve");
    expect(r.avoidTools).toContain("review_approve");
  });

  it("routes C-012 to resolve-comments", () => {
    const r = classifyWorkflowIntent("resolve C-012", emptyCtx);
    expect(r.skill).toBe("ai-spector-resolve-comments");
    expect(r.avoidTools).toContain("review_approve");
  });

  it("routes incremental add to resolve-task", () => {
    const r = classifyWorkflowIntent("I want to add login with Google", emptyCtx);
    expect(r.skill).toBe("ai-spector-resolve-task");
  });

  it("routes generate SRS to generate skill", () => {
    const r = classifyWorkflowIntent("generate the SRS", emptyCtx);
    expect(r.skill).toBe("ai-spector-generate-srs");
  });

  it("prefers active review session over task resume on continue", () => {
    const r = classifyWorkflowIntent("continue", {
      reviewSession: session("reviewing", "srs/02-scope"),
      activeTask: { id: "task-abc", kind: "generate", planApproved: true },
    });
    expect(r.skill).toBe("ai-spector-review");
    expect(r.matchedBy).toBe("active_review_session");
  });

  it("routes ambiguous approve to task when plan not approved", () => {
    const r = classifyWorkflowIntent("looks good", {
      reviewSession: null,
      activeTask: { id: "task-xyz", kind: "resolve", planApproved: false },
    });
    expect(r.skill).toBe("ai-spector-resolve-task");
    expect(r.nextTools).toContain("task_approve_plan");
  });

  it("asks user on ambiguous approve with no context", () => {
    const r = classifyWorkflowIntent("approve it", emptyCtx);
    expect(r.confidence).toBe("low");
    expect(r.askUser?.options).toHaveLength(4);
    expect(r.askUser?.options.map((o) => o.id)).toEqual([
      "doc_signoff",
      "spec",
      "plan",
      "comment",
    ]);
  });
});
