import { describe, expect, it } from "vitest";
import { TaskPreconditionError } from "@/core/operations/task-gates.js";
import { ReviewPreconditionError } from "@/core/reviews/errors.js";
import { mcpToolErrorContent } from "@/interfaces/mcp/format-tool-error.js";

describe("mcpToolErrorContent", () => {
  it("serializes ReviewPreconditionError as structured JSON", () => {
    const err = new ReviewPreconditionError(
      "already_pending_client",
      "Cannot sign off",
      "Use review_status",
      ["review_status"],
      "srs/01-overview",
      "pending_client",
    );

    const payload = mcpToolErrorContent(err);
    expect(payload.isError).toBe(true);
    const parsed = JSON.parse(payload.content[0]!.text) as {
      error: string;
      reason: string;
      hint: string;
      userMessage: string;
      logicalPath: string;
    };
    expect(parsed.error).toBe("PRECONDITION_FAILED");
    expect(parsed.reason).toBe("already_pending_client");
    expect(parsed.hint).toBe("Use review_status");
    expect(parsed.userMessage).toContain("client approval");
    expect(parsed.logicalPath).toBe("srs/01-overview");
  });

  it("serializes TaskPreconditionError as structured JSON", () => {
    const task = {
      id: "task-abc",
      workflow: "generate-srs",
      kind: "generate",
    } as import("@/core/operations/task.js").TaskState;
    const err = new TaskPreconditionError(
      "step_incomplete",
      "Cannot approve",
      "Complete check first",
      ["workspace_check"],
      task,
      "check",
    );

    const payload = mcpToolErrorContent(err);
    const parsed = JSON.parse(payload.content[0]!.text) as {
      error: string;
      reason: string;
      taskId: string;
      blockedStepId: string;
    };
    expect(parsed.error).toBe("PRECONDITION_FAILED");
    expect(parsed.reason).toBe("step_incomplete");
    expect(parsed.taskId).toBe("task-abc");
    expect(parsed.blockedStepId).toBe("check");
  });
});
