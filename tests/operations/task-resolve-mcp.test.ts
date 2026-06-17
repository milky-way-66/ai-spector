import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { createGoalSpec, createPlan } from "@/core/operations/resolve-task.js";
import {
  runTaskApproveDesignSpec,
  runTaskConfirmTier,
  runTaskCreate,
  runTaskSetExecutionMode,
} from "@/core/operations/task.js";
import { passResolveGates, passResolveStandardGates } from "../helpers/task-gate-fixture.js";
import { runTaskApprovePlan } from "@/core/operations/task.js";
import { withTempDir } from "../helpers/temp-project.js";

async function scaffold(root: string): Promise<void> {
  await mkdir(join(root, ".ai-spector"), { recursive: true });
  await writeFile(
    join(root, ".ai-spector/docflow.config.json"),
    JSON.stringify({
      languages: [{ code: "en", label: "English" }],
      paths: { graph: ".ai-spector/graph/traceability.json" },
    }),
    "utf8",
  );
  await mkdir(join(root, "docs/data-source"), { recursive: true });
}

describe("resolve-task MCP operations", () => {
  it("task_confirm_tier sets snapshot and skips fast-tier steps", async () => {
    await withTempDir(async (root) => {
      await scaffold(root);
      const { task } = await runTaskCreate({
        root,
        kind: "resolve",
        workflow: "resolve",
        trigger: "fix typo",
      });

      const result = await runTaskConfirmTier({ root, taskId: task.id, tier: "fast" });
      expect(result.task.snapshot.resolveTier).toBe("fast");
      expect(result.task.snapshot.tierConfirmedAt).toBeTruthy();
      expect(result.workflowGuidance.phase).toBe("clarify");
      expect(result.task.steps.find((s) => s.id === "check")?.status).toBe("skipped");
      expect(result.task.steps.find((s) => s.id === "tier")?.status).toBe("done");
      expect(result.task.currentStepId).toBe("clarify");
    });
  });

  it("task_confirm_tier standard does not skip briefing", async () => {
    await withTempDir(async (root) => {
      await scaffold(root);
      const { task } = await runTaskCreate({
        root,
        kind: "resolve",
        workflow: "resolve",
        trigger: "extend feature",
      });

      const result = await runTaskConfirmTier({ root, taskId: task.id, tier: "standard" });
      expect(result.task.snapshot.resolveTier).toBe("standard");
      expect(result.task.steps.find((s) => s.id === "briefing")?.status).toBe("pending");
    });
  });

  it("task_approve_design_spec records path for full tier", async () => {
    await withTempDir(async (root) => {
      await scaffold(root);
      const { task } = await runTaskCreate({
        root,
        kind: "resolve",
        workflow: "resolve",
        trigger: "new feature",
      });
      await runTaskConfirmTier({ root, taskId: task.id, tier: "full" });

      const specPath = "docs/superpowers/specs/2026-06-17-new-feature-design.md";
      const result = await runTaskApproveDesignSpec({
        root,
        taskId: task.id,
        designSpecPath: specPath,
      });

      expect(result.task.snapshot.designSpecPath).toBe(specPath);
      expect(result.task.snapshot.designSpecApprovedAt).toBeTruthy();
      expect(result.task.steps.find((s) => s.id === "design")?.status).toBe("done");
      expect(result.workflowGuidance.phase).toBe("check");
    });
  });

  it("task_set_execution_mode after plan approval", async () => {
    await withTempDir(async (root) => {
      await scaffold(root);
      const { task } = await runTaskCreate({
        root,
        kind: "resolve",
        workflow: "resolve",
        trigger: "extend",
      });
      const goal = createGoalSpec("extend", "docs", ["docs/srs/en/04.md"], ["done"]);
      const plan = createPlan(goal, [{ id: "s1", description: "edit", tool: "edit", args: {} }], []);

      await runTaskConfirmTier({ root, taskId: task.id, tier: "standard" });
      await passResolveStandardGates(
        root,
        task.id,
        goal,
        plan,
        "docs/superpowers/plans/2026-06-17-resolve-extend.md",
      );
      await runTaskApprovePlan({ root, taskId: task.id });

      const result = await runTaskSetExecutionMode({
        root,
        taskId: task.id,
        mode: "subagent",
      });
      expect(result.task.snapshot.executionMode).toBe("subagent");
      expect(result.workflowGuidance.canProceed).toBe(true);
    });
  });

  it("legacy resolve without tier still passes gates", async () => {
    await withTempDir(async (root) => {
      await scaffold(root);
      const { task } = await runTaskCreate({
        root,
        kind: "resolve",
        workflow: "resolve",
        trigger: "legacy",
      });
      const goal = createGoalSpec("legacy", "docs", ["docs/srs/en/04.md"], ["done"]);
      const plan = createPlan(goal, [{ id: "s1", description: "edit", tool: "edit", args: {} }], []);

      await passResolveGates(root, task.id, goal, plan);
      const approved = await runTaskApprovePlan({ root, taskId: task.id });
      expect(approved.task.planApprovedAt).toBeTruthy();
    });
  });
});
