import { describe, expect, it } from "vitest";
import { withTempProject } from "../helpers/temp-project.js";
import { writeJson } from "@/core/util/fs.js";
import { join } from "node:path";
import { runWorkflowRoute } from "@/core/operations/workflow-route.js";
import {
  formatActiveWorkerLabel,
  loadWorkflowActive,
  recordWorkflowActive,
  runWorkflowStatus,
} from "@/core/workflow/active-worker.js";
import { buildReviewSessionWorkflowGuidance } from "@/core/workflow/guidance.js";
import type { ReviewSessionFile } from "@/core/reviews/types.js";

async function writeMinimalConfig(root: string): Promise<void> {
  await writeJson(join(root, ".ai-spector/docflow.config.json"), {
    version: 1,
    languages: [{ code: "en", label: "English" }],
    paths: {
      graph: ".ai-spector/graph/traceability.graph.json",
      registry: ".ai-spector/registry/section-registry.json",
      templates: ".ai-spector/templates",
    },
  });
}

describe("active-worker", () => {
  it("formats display label with logical path", () => {
    expect(formatActiveWorkerLabel("doc-review", "reviewing", { logicalPath: "srs/01" })).toBe(
      "doc-review (reviewing srs/01)",
    );
  });

  it("persists active worker and logs transitions", async () => {
    await withTempProject(async (root) => {
      await recordWorkflowActive(root, {
        workflowId: "resolve-task",
        phase: "planning",
        source: "task",
        context: { taskId: "task-abc" },
        event: "test",
      });
      const active = await loadWorkflowActive(root);
      expect(active?.workflowId).toBe("resolve-task");
      expect(active?.displayLabel).toContain("task-abc");

      const status = await runWorkflowStatus(root);
      expect(status.statusLine).toContain("resolve-task");
      expect(status.recentTransitions.length).toBeGreaterThan(0);
    });
  });

  it("workflow_route records handoff to active file", async () => {
    await withTempProject(async (root) => {
      await writeMinimalConfig(root);
      await runWorkflowRoute({ root, message: "/review" });
      const active = await loadWorkflowActive(root);
      expect(active?.workflowId).toBe("doc-review");
      expect(active?.phase).toBe("detect");
    });
  });
});

describe("buildReviewSessionWorkflowGuidance", () => {
  const session = (phase: ReviewSessionFile["phase"]): ReviewSessionFile => ({
    version: 1,
    startedAt: "2026-06-15T00:00:00.000Z",
    updatedAt: "2026-06-15T00:00:00.000Z",
    phase,
    activeLogicalPath: "srs/01-overview",
    reviewStatusAt: null,
    reviewWrittenAt: null,
    contentHashAtReview: null,
  });

  it("gates review_approve until awaiting_decision", () => {
    const reviewing = buildReviewSessionWorkflowGuidance(session("reviewing"));
    expect(reviewing.workflowId).toBe("doc-review");
    expect(reviewing.nextTools).toContain("review_session_ack_review");
    expect(reviewing.nextTools).not.toContain("review_approve");

    const decision = buildReviewSessionWorkflowGuidance(session("awaiting_decision"));
    expect(decision.nextTools).toContain("review_approve");
    expect(decision.canProceed).toBe(true);
  });
});
