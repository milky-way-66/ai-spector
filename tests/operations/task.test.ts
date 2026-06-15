import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { createGoalSpec, createPlan } from "@/core/operations/resolve-task.js";
import {
  runTaskAbandon,
  runTaskApprovePlan,
  runTaskComplete,
  runTaskCreate,
  runTaskGet,
  runTaskList,
  runTaskPause,
  runTaskStatus,
  runTaskUpdate,
  taskFilePath,
  taskIndexPath,
} from "@/core/operations/task.js";
import { readJson } from "@/core/util/fs.js";
import { passResolveGates } from "../helpers/task-gate-fixture.js";
import { withTempDir } from "../helpers/temp-project.js";
import type { TaskIndex, TaskState } from "@/core/operations/task.js";

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

describe("task state store", () => {
  it("creates a generate task with workflow steps and active slot", async () => {
    await withTempDir(async (root) => {
      await scaffold(root);
      const created = await runTaskCreate({
        root,
        kind: "generate",
        workflow: "generate-srs",
        trigger: "generate SRS for checkout",
        docType: "srs",
      });

      expect(created.task.id).toMatch(/^task-/);
      expect(created.task.status).toBe("active");
      expect(created.task.currentStepId).toBe("check");
      expect(created.task.steps).toHaveLength(6);
      expect(created.task.contextRefs.docType).toBe("srs");

      const index = await readJson<TaskIndex>(taskIndexPath(root));
      expect(index.active["generate:srs"]).toBe(created.task.id);

      const onDisk = await readJson<TaskState>(taskFilePath(root, created.task.id));
      expect(onDisk.trigger).toBe("generate SRS for checkout");
    });
  });

  it("rejects a second active task in the same slot unless force", async () => {
    await withTempDir(async (root) => {
      await scaffold(root);
      const first = await runTaskCreate({
        root,
        kind: "resolve",
        workflow: "resolve",
        trigger: "add login with Google",
      });

      await expect(
        runTaskCreate({
          root,
          kind: "resolve",
          workflow: "resolve",
          trigger: "update auth section",
        }),
      ).rejects.toThrow(/Active task already exists/);

      const replaced = await runTaskCreate({
        root,
        kind: "resolve",
        workflow: "resolve",
        trigger: "update auth section",
        force: true,
      });
      expect(replaced.replacedTaskId).toBe(first.task.id);

      const old = await runTaskGet({ root, taskId: first.task.id });
      expect(old.task.status).toBe("abandoned");
    });
  });

  it("updates step status and round-trips through get", async () => {
    await withTempDir(async (root) => {
      await scaffold(root);
      const { task } = await runTaskCreate({
        root,
        kind: "generate",
        workflow: "generate-srs",
        trigger: "generate all SRS",
        docType: "srs",
      });

      const updated = await runTaskUpdate({
        root,
        taskId: task.id,
        patch: {
          snapshot: { workspaceCheckAt: "2026-06-12T10:00:00.000Z" },
          step: {
            id: "check",
            patch: { status: "done", completedAt: "2026-06-12T10:00:00.000Z" },
          },
          currentStepId: "clarify",
          phase: "clarify",
        },
      });

      expect(updated.task.steps[0]?.status).toBe("done");
      expect(updated.task.currentStepId).toBe("clarify");

      const loaded = await runTaskGet({ root, taskId: task.id });
      expect(loaded.task.steps[0]?.status).toBe("done");
    });
  });

  it("approve plan sets planApprovedAt and advances to next step", async () => {
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
        ["SRS documents Google login requirement"],
      );
      const plan = createPlan(
        goal,
        [{ id: "edit-srs", description: "Edit SRS", tool: "edit", args: {} }],
        [{ nodeId: "F-01", directCallers: 0, riskLevel: "low" }],
      );

      await passResolveGates(root, task.id, goal, plan);

      const approved = await runTaskApprovePlan({ root, taskId: task.id });
      expect(approved.task.planApprovedAt).toBeTruthy();
      expect(approved.task.currentStepId).toBe("execute");
      expect(approved.task.steps.find((s) => s.id === "plan")?.status).toBe("done");
    });
  });

  it("pause, complete, and abandon update status and active slot", async () => {
    await withTempDir(async (root) => {
      await scaffold(root);
      const { task } = await runTaskCreate({
        root,
        kind: "generate",
        workflow: "generate-basic-design",
        trigger: "generate screen list",
        docType: "basic-design",
      });

      const paused = await runTaskPause({ root, taskId: task.id });
      expect(paused.task.status).toBe("paused");

      const listed = await runTaskList({ root, status: "paused" });
      expect(listed.total).toBe(1);

      await runTaskAbandon({ root, taskId: task.id, reason: "user cancelled" });
      const index = await readJson<TaskIndex>(taskIndexPath(root));
      expect(index.active["generate:basic-design"]).toBeUndefined();

      const created2 = await runTaskCreate({
        root,
        kind: "generate",
        workflow: "generate-basic-design",
        trigger: "retry screen list",
        docType: "basic-design",
      });
      await runTaskUpdate({
        root,
        taskId: created2.task.id,
        patch: {
          snapshot: { extractOffered: true },
          step: { id: "extract", patch: { status: "done" } },
        },
      });
      const completed = await runTaskComplete({
        root,
        taskId: created2.task.id,
        summary: "all waves done",
      });
      expect(completed.task.status).toBe("complete");
      expect(completed.task.nextAction).toBe("all waves done");

      const index2 = await readJson<TaskIndex>(taskIndexPath(root));
      expect(index2.active["generate:basic-design"]).toBeUndefined();
    });
  });

  it("task_list bootstrap creates a task when the slot is empty", async () => {
    await withTempDir(async (root) => {
      await scaffold(root);
      const result = await runTaskList({
        root,
        bootstrap: {
          kind: "generate",
          workflow: "generate-srs",
          trigger: "generate introduction",
          docType: "srs",
        },
      });
      expect(result.bootstrapped?.task.id).toMatch(/^task-/);
      expect(result.activeForSlot).toBeUndefined();
      expect(result.index.active["generate:srs"]).toBe(result.bootstrapped?.task.id);
      expect(result.tasks.some((t) => t.id === result.bootstrapped?.task.id)).toBe(true);
    });
  });

  it("task_list bootstrap returns activeForSlot when a resumable task exists", async () => {
    await withTempDir(async (root) => {
      await scaffold(root);
      const created = await runTaskCreate({
        root,
        kind: "generate",
        workflow: "generate-srs",
        trigger: "first session",
        docType: "srs",
      });
      await runTaskPause({ root, taskId: created.task.id });

      const result = await runTaskList({
        root,
        bootstrap: {
          kind: "generate",
          workflow: "generate-srs",
          trigger: "second session",
          docType: "srs",
        },
      });
      expect(result.bootstrapped).toBeUndefined();
      expect(result.activeForSlot?.taskId).toBe(created.task.id);
      expect(result.activeForSlot?.action).toBe("resume");
    });
  });

  it("runTaskStatus lists active slots", async () => {
    await withTempDir(async (root) => {
      await scaffold(root);
      const created = await runTaskCreate({
        root,
        kind: "resolve",
        workflow: "resolve",
        trigger: "add login",
      });
      const status = await runTaskStatus({ root });
      expect(status.slots).toHaveLength(1);
      expect(status.slots[0]?.taskId).toBe(created.task.id);
      expect(status.slots[0]?.task?.trigger).toBe("add login");
    });
  });

  it("rejects clarify done until readiness report was shown", async () => {
    await withTempDir(async (root) => {
      await scaffold(root);
      const { task } = await runTaskCreate({
        root,
        kind: "generate",
        workflow: "generate-srs",
        trigger: "generate SRS",
        docType: "srs",
      });

      await expect(
        runTaskUpdate({
          root,
          taskId: task.id,
          patch: { step: { id: "clarify", patch: { status: "done" } } },
        }),
      ).rejects.toThrow(/readiness report was shown/);

      const ok = await runTaskUpdate({
        root,
        taskId: task.id,
        patch: {
          snapshot: { readinessReportShown: true },
          step: { id: "clarify", patch: { status: "done" } },
        },
      });
      expect(ok.task.steps.find((s) => s.id === "clarify")?.status).toBe("done");
    });
  });

  it("rejects task_complete until extract was offered", async () => {
    await withTempDir(async (root) => {
      await scaffold(root);
      const { task } = await runTaskCreate({
        root,
        kind: "generate",
        workflow: "generate-srs",
        trigger: "generate SRS",
        docType: "srs",
      });

      await expect(runTaskComplete({ root, taskId: task.id })).rejects.toThrow(/extract/);

      await runTaskUpdate({
        root,
        taskId: task.id,
        patch: {
          snapshot: { extractOffered: true },
          step: { id: "extract", patch: { status: "done" } },
        },
      });
      const completed = await runTaskComplete({ root, taskId: task.id });
      expect(completed.task.status).toBe("complete");
    });
  });
});
