import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { createGoalSpec, createPlan } from "@/core/operations/resolve-task.js";
import { TaskPreconditionError } from "@/core/operations/task-gates.js";
import {
  buildGeneratePlan,
  recordGenerateWaveProgress,
  runTaskApprovePlan,
  runTaskCreate,
  runTaskUpdate,
} from "@/core/operations/task.js";
import { passGenerateGates, passResolveFastGates, passResolveGates, passResolveStandardGates } from "../helpers/task-gate-fixture.js";
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

const sampleGeneratePlan = () =>
  buildGeneratePlan({
    docType: "srs",
    language: "en",
    scope: "explicit",
    briefing: [{ target: "docs/srs/en/1-introduction.md" }],
    rows: [
      {
        output: "docs/srs/en/1-introduction.md",
        dagNode: "srs.introduction",
        sources: [],
        keyPoints: ["intro"],
      },
    ],
    waves: [{ wave: 0, nodeIds: ["srs.introduction"] }],
  });

describe("task workflow gates", () => {
  it("rejects task_approve_plan when generate gates are incomplete (auto-approve scenario)", async () => {
    await withTempDir(async (root) => {
      await scaffold(root);
      const { task } = await runTaskCreate({
        root,
        kind: "generate",
        workflow: "generate-srs",
        trigger: "ok, tạo 4 file đầu trc",
        docType: "srs",
      });

      const plan = sampleGeneratePlan();
      await expect(
        runTaskUpdate({
          root,
          taskId: task.id,
          patch: { plan: { kind: "generate", plan } },
        }),
      ).rejects.toBeInstanceOf(TaskPreconditionError);

      await passGenerateGates(root, task.id, plan);
      const approved = await runTaskApprovePlan({ root, taskId: task.id });
      expect(approved.task.planApprovedAt).toBeTruthy();
      expect(approved.task.currentStepId).toBe("wave-0");
    });
  });

  it("rejects marking plan step done via task_update", async () => {
    await withTempDir(async (root) => {
      await scaffold(root);
      const { task } = await runTaskCreate({
        root,
        kind: "generate",
        workflow: "generate-srs",
        trigger: "generate",
        docType: "srs",
      });
      const plan = sampleGeneratePlan();
      await passGenerateGates(root, task.id, plan);

      await expect(
        runTaskUpdate({
          root,
          taskId: task.id,
          patch: { step: { id: "plan", patch: { status: "done" } } },
        }),
      ).rejects.toMatchObject({ reason: "step_premature" });
    });
  });

  it("rejects task_record_wave without approved plan", async () => {
    await withTempDir(async (root) => {
      await scaffold(root);
      const { task } = await runTaskCreate({
        root,
        kind: "generate",
        workflow: "generate-srs",
        trigger: "generate",
        docType: "srs",
      });

      await expect(
        recordGenerateWaveProgress({
          root,
          taskId: task.id,
          waveId: "wave-0",
          status: "done",
        }),
      ).rejects.toMatchObject({ reason: "plan_not_approved" });
    });
  });

  it("rejects resolve task_approve_plan without clarify and planPresentedAt", async () => {
    await withTempDir(async (root) => {
      await scaffold(root);
      const { task } = await runTaskCreate({
        root,
        kind: "resolve",
        workflow: "resolve",
        trigger: "add login",
      });
      const goal = createGoalSpec("add login", "docs", ["docs/srs/en/04.md"], ["done"]);
      const plan = createPlan(
        goal,
        [{ id: "s1", description: "edit", tool: "edit", args: {} }],
        [{ nodeId: "F-01", directCallers: 0, riskLevel: "low" }],
      );

      await runTaskUpdate({
        root,
        taskId: task.id,
        patch: { goal, plan: { kind: "resolve", plan } },
      });

      await expect(runTaskApprovePlan({ root, taskId: task.id })).rejects.toBeInstanceOf(
        TaskPreconditionError,
      );

      await passResolveGates(root, task.id, goal, plan);
      const approved = await runTaskApprovePlan({ root, taskId: task.id });
      expect(approved.task.currentStepId).toBe("execute");
    });
  });

  it("rejects fast-tier resolve approve without tierConfirmedAt", async () => {
    await withTempDir(async (root) => {
      await scaffold(root);
      const { task } = await runTaskCreate({
        root,
        kind: "resolve",
        workflow: "resolve",
        trigger: "add login",
      });
      const goal = createGoalSpec("add login", "docs", ["docs/srs/en/04.md"], ["done"]);
      const plan = createPlan(
        goal,
        [{ id: "s1", description: "edit", tool: "edit", args: {} }],
        [{ nodeId: "F-01", directCallers: 0, riskLevel: "low" }],
      );

      await runTaskUpdate({
        root,
        taskId: task.id,
        patch: {
          goal,
          plan: { kind: "resolve", plan },
          phaseStatus: "awaiting_user",
          snapshot: {
            resolveTier: "fast",
            planPresentedAt: new Date().toISOString(),
          },
          step: { id: "clarify", patch: { status: "done", completedAt: new Date().toISOString() } },
        },
      });

      await expect(runTaskApprovePlan({ root, taskId: task.id })).rejects.toMatchObject({
        reason: "snapshot_missing",
      });
    });
  });

  it("approves fast-tier resolve when tier gates are complete", async () => {
    await withTempDir(async (root) => {
      await scaffold(root);
      const { task } = await runTaskCreate({
        root,
        kind: "resolve",
        workflow: "resolve",
        trigger: "fix typo",
      });
      const goal = createGoalSpec("fix typo", "docs", ["docs/srs/en/04.md"], ["done"]);
      const plan = createPlan(goal, [{ id: "s1", description: "edit", tool: "edit", args: {} }], []);

      await passResolveFastGates(root, task.id, goal, plan);
      const approved = await runTaskApprovePlan({ root, taskId: task.id });
      expect(approved.task.planApprovedAt).toBeTruthy();
    });
  });

  it("rejects standard-tier resolve without implementationPlanPath", async () => {
    await withTempDir(async (root) => {
      await scaffold(root);
      const { task } = await runTaskCreate({
        root,
        kind: "resolve",
        workflow: "resolve",
        trigger: "extend feature",
      });
      const goal = createGoalSpec("extend", "docs", ["docs/srs/en/04.md"], ["done"]);
      const plan = createPlan(goal, [{ id: "s1", description: "edit", tool: "edit", args: {} }], []);
      const now = new Date().toISOString();

      await runTaskUpdate({
        root,
        taskId: task.id,
        patch: {
          snapshot: { resolveTier: "standard", tierConfirmedAt: now, workspaceCheckAt: now, readinessReportShown: true, briefingConfirmedAt: now, planPresentedAt: now },
          goal,
          plan: { kind: "resolve", plan },
          phaseStatus: "awaiting_user",
          step: { id: "tier", patch: { status: "done", completedAt: now } },
        },
      });
      for (const id of ["check", "clarify", "briefing"] as const) {
        await runTaskUpdate({
          root,
          taskId: task.id,
          patch: { step: { id, patch: { status: "done", completedAt: now } } },
        });
      }
      await runTaskUpdate({
        root,
        taskId: task.id,
        patch: { step: { id: "design", patch: { status: "skipped" } } },
      });

      await expect(runTaskApprovePlan({ root, taskId: task.id })).rejects.toMatchObject({
        reason: "snapshot_missing",
      });
    });
  });

  it("approves standard-tier resolve when extended gates are complete", async () => {
    await withTempDir(async (root) => {
      await scaffold(root);
      const { task } = await runTaskCreate({
        root,
        kind: "resolve",
        workflow: "resolve",
        trigger: "extend feature",
      });
      const goal = createGoalSpec("extend", "docs", ["docs/srs/en/04.md"], ["done"]);
      const plan = createPlan(goal, [{ id: "s1", description: "edit", tool: "edit", args: {} }], []);

      await passResolveStandardGates(
        root,
        task.id,
        goal,
        plan,
        "docs/superpowers/plans/2026-06-17-resolve-extend.md",
      );
      const approved = await runTaskApprovePlan({ root, taskId: task.id });
      expect(approved.task.planApprovedAt).toBeTruthy();
    });
  });

  it("returns structured PRECONDITION_FAILED payload from TaskPreconditionError", async () => {
    await withTempDir(async (root) => {
      await scaffold(root);
      const { task } = await runTaskCreate({
        root,
        kind: "generate",
        workflow: "generate-srs",
        trigger: "generate",
        docType: "srs",
      });

      try {
        await runTaskApprovePlan({ root, taskId: task.id });
        expect.fail("should throw");
      } catch (err) {
        expect(err).toBeInstanceOf(TaskPreconditionError);
        const payload = (err as TaskPreconditionError).toPayload();
        expect(payload.error).toBe("PRECONDITION_FAILED");
        expect(payload.reason).toBe("plan_missing");
        expect(payload.suggestedTools.length).toBeGreaterThan(0);
      }
    });
  });
});
