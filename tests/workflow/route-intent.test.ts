import { describe, expect, it } from "vitest";
import { classifyWorkflowIntent } from "@/core/workflow/route-intent.js";
import type { WorkflowRouteContext } from "@/core/workflow/route-intent.js";
import { WORKFLOW_ROUTE_EXAMPLES } from "@/core/workflow/route-intent-examples.js";
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
    expect(r.workflowId).toBe("doc-review");
    expect(r.handoff?.readBrief).toBe(
      ".cursor/skills/ai-spector-review/references/runbook.md",
    );
    expect(r.handoff?.runInBackground).toBe(false);
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

  it("routes I want to generate detail design to generate-detail-design (not resolve-task)", () => {
    const r = classifyWorkflowIntent("I want to generate detail design", emptyCtx);
    expect(r.skill).toBe("ai-spector-generate-detail-design");
    expect(r.matchedBy).toBe("generate_detail_design");
  });

  it("routes we need to generate detail design to generate-detail-design", () => {
    const r = classifyWorkflowIntent("we need to generate detail design", emptyCtx);
    expect(r.skill).toBe("ai-spector-generate-detail-design");
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
    expect(r.handoff).toBeUndefined();
    expect(r.askUser?.options).toHaveLength(4);
    expect(r.askUser?.options.map((o) => o.workflowId)).toEqual([
      "doc-review",
      "spec-queue",
      "resolve-task",
      "resolve-comments",
    ]);
  });

  it("handoff includes phase from active review session", () => {
    const r = classifyWorkflowIntent("continue", {
      reviewSession: session("reviewing", "srs/02-scope"),
      activeTask: null,
    });
    expect(r.workflowId).toBe("doc-review");
    expect(r.handoff?.phase).toBe("reviewing");
    expect(r.handoff?.resumeFromState).toBe(true);
  });

  it("routes generate basic design to basic-design skill", () => {
    const r = classifyWorkflowIntent("generate basic design", emptyCtx);
    expect(r.skill).toBe("ai-spector-generate-basic-design");
    expect(r.workflowId).toBe("generate-basic-design");
    expect(r.matchedBy).toBe("generate_basic_design");
  });

  it("routes doc-review phrases without logical path", () => {
    for (const message of [
      "review documents",
      "pending review",
      "has srs been approved",
    ]) {
      const r = classifyWorkflowIntent(message, emptyCtx);
      expect(r.skill, message).toBe("ai-spector-review");
      expect(r.matchedBy, message).toBe("doc_review_intent");
    }
  });

  it("routes approve the SRS to document sign-off", () => {
    const r = classifyWorkflowIntent("approve the SRS", emptyCtx);
    expect(r.skill).toBe("ai-spector-review");
    expect(r.matchedBy).toBe("doc_review_intent");
  });

  it("routes basic design cues to generate-basic-design", () => {
    for (const message of ["screen list", "API design"]) {
      const r = classifyWorkflowIntent(message, emptyCtx);
      expect(r.skill, message).toBe("ai-spector-generate-basic-design");
      expect(r.matchedBy, message).toBe("generate_basic_design");
    }
  });

  it("routes HTML mockup to generate-prototype", () => {
    const r = classifyWorkflowIntent("HTML mockup", emptyCtx);
    expect(r.skill).toBe("ai-spector-generate-prototype");
    expect(r.workflowId).toBe("generate-prototype");
  });

  it("routes what tasks are active to task-router", () => {
    const r = classifyWorkflowIntent("what tasks are active", emptyCtx);
    expect(r.skill).toBe("ai-spector-task");
    expect(r.matchedBy).toBe("task_resume");
  });

  it("routes review comments to resolve-comments not doc-review", () => {
    const r = classifyWorkflowIntent("review comments on login", emptyCtx);
    expect(r.skill).toBe("ai-spector-resolve-comments");
    expect(r.matchedBy).toBe("comment_thread");
  });

  it("prefers task resume over incremental when both match", () => {
    const r = classifyWorkflowIntent("I want to continue generation", emptyCtx);
    expect(r.skill).toBe("ai-spector-task");
    expect(r.matchedBy).toBe("task_resume");
  });

  it("routes WORKFLOW.md examples (route-intent-examples.ts)", () => {
    for (const { say, skill, expectAskUser } of WORKFLOW_ROUTE_EXAMPLES) {
      const r = classifyWorkflowIntent(say, emptyCtx);
      if (expectAskUser) {
        expect(r.askUser?.options.length, say).toBeGreaterThan(0);
        expect(r.handoff, say).toBeUndefined();
        continue;
      }
      expect(r.skill, `${say} → got ${r.skill} (${r.matchedBy})`).toBe(skill);
      expect(r.matchedBy, say).not.toBe("fallback");
    }
  });

  it("routes ambiguous approve to basic-design when active generate task is BD", () => {
    const r = classifyWorkflowIntent("looks good", {
      reviewSession: null,
      activeTask: {
        id: "task-bd",
        kind: "generate",
        workflow: "generate-basic-design",
        planApproved: false,
      },
    });
    expect(r.skill).toBe("ai-spector-generate-basic-design");
    expect(r.nextTools).toContain("task_approve_plan");
  });

  it("routes detail design to generate-detail-design skill", () => {
    const r = classifyWorkflowIntent("detail design for checkout", emptyCtx);
    expect(r.skill).toBe("ai-spector-generate-detail-design");
    expect(r.workflowId).toBe("generate-detail-design");
  });

  it("routes clarifications with clarify phase handoff", () => {
    const r = classifyWorkflowIntent("open questions", emptyCtx);
    expect(r.skill).toBe("ai-spector-check");
    expect(r.matchedBy).toBe("clarifications");
    expect(r.handoff?.phase).toBe("clarify");
    expect(r.handoff?.readBrief).toContain("context-store.md");
  });
});
