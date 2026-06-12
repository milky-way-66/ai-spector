/**
 * End-to-end verification against task-state-plan.md §13 success criteria.
 */
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { createGoalSpec, createPlan } from "@/core/operations/resolve-task.js";
import {
  buildGeneratePlan,
  runTaskApprovePlan,
  runTaskCreate,
  runTaskGet,
  runTaskPause,
  runTaskResume,
  runTaskUpdate,
} from "@/core/operations/task.js";
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
  await mkdir(join(root, ".ai-spector/templates"), { recursive: true });
  await mkdir(join(root, ".ai-spector/.docflow/context"), { recursive: true });
  await mkdir(join(root, "docs/srs/en"), { recursive: true });
}

describe("task state success criteria (plan §13)", () => {
  it("generate SRS survives session break after plan approval — resumes at correct wave", async () => {
    await withTempDir(async (root) => {
      await scaffold(root);

      const { task: created } = await runTaskCreate({
        root,
        kind: "generate",
        workflow: "generate-srs",
        trigger: "generate SRS for checkout",
        docType: "srs",
      });

      const plan = buildGeneratePlan({
        docType: "srs",
        scope: "all",
        briefing: [{ target: "docs/srs/en/03-use-cases.md" }],
        rows: [
          {
            output: "docs/srs/en/03-use-cases.md",
            dagNode: "srs.use-cases",
            sources: ["auth-notes.md"],
            keyPoints: ["login"],
          },
        ],
        waves: [
          { wave: 1, nodeIds: ["srs.introduction"] },
          { wave: 2, nodeIds: ["srs.use-cases"] },
        ],
      });

      await runTaskUpdate({
        root,
        taskId: created.id,
        patch: { plan: { kind: "generate", plan } },
      });
      await runTaskApprovePlan({ root, taskId: created.id });
      await runTaskPause({ root, taskId: created.id });

      // Simulated "next day" session — load from disk only
      const resumed = await runTaskGet({ root, taskId: created.id });
      expect(resumed.task.planApprovedAt).toBeTruthy();
      expect(resumed.task.plan?.kind).toBe("generate");
      expect(resumed.task.currentStepId).toBe("wave-1");
      expect(resumed.task.status).toBe("paused");

      const check = await runTaskResume({ root, taskId: created.id });
      expect(check.canContinue).toBe(true);
      expect(check.task.currentStepId).toBe("wave-1");
      expect(check.task.status).toBe("active");
    });
  });

  it("resolve task shows plan phase awaiting approval until explicit yes", async () => {
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
        ["Google OAuth documented"],
      );
      const plan = createPlan(
        goal,
        [{ id: "s1", description: "Edit SRS", tool: "edit", args: {} }],
        [{ nodeId: "F-01", directCallers: 0, riskLevel: "low" }],
      );

      await runTaskUpdate({
        root,
        taskId: task.id,
        patch: {
          goal,
          plan: { kind: "resolve", plan },
          phase: "plan",
          phaseStatus: "awaiting_user",
          currentStepId: "plan",
        },
      });

      const loaded = await runTaskGet({ root, taskId: task.id });
      expect(loaded.task.phase).toBe("plan");
      expect(loaded.task.phaseStatus).toBe("awaiting_user");
      expect(loaded.task.planApprovedAt).toBeNull();
      expect(loaded.task.plan?.kind).toBe("resolve");
    });
  });

  it("task_get alone exposes plan, step, blockers, and next action", async () => {
    await withTempDir(async (root) => {
      await scaffold(root);
      const { task } = await runTaskCreate({
        root,
        kind: "generate",
        workflow: "generate-srs",
        trigger: "generate all SRS",
        docType: "srs",
      });

      await runTaskUpdate({
        root,
        taskId: task.id,
        patch: {
          blockers: ["waiting for user scope confirmation"],
          nextAction: "confirm scope table",
          step: { id: "clarify", patch: { status: "in-progress" } },
        },
      });

      const { task: loaded } = await runTaskGet({ root, taskId: task.id });
      expect(loaded.plan).toBeNull();
      expect(loaded.currentStepId).toBe("check");
      expect(loaded.blockers).toContain("waiting for user scope confirmation");
      expect(loaded.nextAction).toBe("confirm scope table");
      expect(loaded.steps.find((s) => s.id === "clarify")?.status).toBe("in-progress");
    });
  });
});
