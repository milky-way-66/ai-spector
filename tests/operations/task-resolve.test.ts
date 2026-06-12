import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  createGoalSpec,
  createPlan,
  runResolveTask,
} from "../../src/core/operations/resolve-task.js";
import {
  loadResolveExecutionContext,
  recordResolveStepProgress,
  runTaskApprovePlan,
  runTaskCreate,
  runTaskGet,
  runTaskUpdate,
} from "../../src/core/operations/task.js";
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
  await mkdir(join(root, ".ai-spector/.docflow/config"), { recursive: true });
}

describe("resolve-task task file integration", () => {
  it("loads approved plan from task file", async () => {
    await withTempDir(async (root) => {
      await scaffold(root);
      const { task } = await runTaskCreate({
        root,
        kind: "resolve",
        workflow: "resolve",
        trigger: "add login with Google",
      });

      const goal = createGoalSpec(
        "add login with Google",
        "docs",
        ["docs/srs/en/04-features.md"],
        ["documented"],
      );
      const plan = createPlan(
        goal,
        [{ id: "s1", description: "impact", tool: "graph_impact", args: {} }],
        [{ nodeId: "F-01", directCallers: 0, riskLevel: "low" }],
      );

      await runTaskUpdate({
        root,
        taskId: task.id,
        patch: { goal, plan: { kind: "resolve", plan } },
      });
      await runTaskApprovePlan({ root, taskId: task.id });

      const ctx = await loadResolveExecutionContext({ root, taskId: task.id });
      expect(ctx.intent).toBe("add login with Google");
      expect(ctx.plan.steps).toHaveLength(1);
      expect(ctx.plan.steps[0]?.id).toBe("s1");
    });
  });

  it("persists dry-run execution progress to task file", async () => {
    await withTempDir(async (root) => {
      await scaffold(root);
      const { task } = await runTaskCreate({
        root,
        kind: "resolve",
        workflow: "resolve",
        trigger: "update auth",
      });

      const goal = createGoalSpec("update auth", "docs", ["docs/srs/en/auth.md"], ["done"]);
      const plan = createPlan(
        goal,
        [
          { id: "s1", description: "step 1", tool: "index", args: {} },
          { id: "s2", description: "step 2", tool: "graph_merge", args: {} },
        ],
        [{ nodeId: "auth", directCallers: 0, riskLevel: "low" }],
      );

      await runTaskUpdate({
        root,
        taskId: task.id,
        patch: { goal, plan: { kind: "resolve", plan } },
      });
      await runTaskApprovePlan({ root, taskId: task.id });

      const ctx = await loadResolveExecutionContext({ root, taskId: task.id });

      await runResolveTask({
        intent: ctx.intent,
        goalSpec: ctx.goalSpec,
        plan: ctx.plan,
        projectRoot: root,
        graphPath: join(root, ".ai-spector/graph/traceability.json"),
        rulesPath: join(root, ".ai-spector/.docflow/config/impact.rules.json"),
        dryRun: true,
        onStepComplete: async (event) => {
          await recordResolveStepProgress({
            root,
            taskId: task.id,
            plan: event.plan,
            stepId: event.stepId,
            stepStatus: event.status,
            artifacts: event.artifacts,
            blocker: event.issue ?? null,
          });
        },
      });

      const loaded = await runTaskGet({ root, taskId: task.id });
      expect(loaded.task.plan?.kind).toBe("resolve");
      if (loaded.task.plan?.kind === "resolve") {
        expect(loaded.task.plan.plan.steps.every((s) => s.status === "done")).toBe(true);
      }
      expect(loaded.task.currentStepId).toBe("report");
      expect(loaded.task.steps.find((s) => s.id === "execute")?.status).toBe("done");
    });
  });
});
