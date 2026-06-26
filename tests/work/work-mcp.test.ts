import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  runWorkCreate,
  runWorkList,
  runWorkStatus,
} from "@/core/operations/work.js";
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
  await mkdir(join(root, ".ai-spector/.docflow/tasks"), { recursive: true });
}

describe("runWorkCreate", () => {
  it("creates a resolve task when kind is 'resolve'", async () => {
    await withTempDir(async (root) => {
      await scaffold(root);
      const { task } = await runWorkCreate({
        root,
        kind: "resolve",
        workflow: "resolve",
        trigger: "fix login bug",
      });
      expect(task.kind).toBe("resolve");
      expect(task.workflow).toBe("resolve");
      expect(task.status).toBe("active");
    });
  });

  it("maps kind 'change' to 'resolve' in the stored task", async () => {
    await withTempDir(async (root) => {
      await scaffold(root);
      const { task } = await runWorkCreate({
        root,
        kind: "change",
        workflow: "resolve",
        trigger: "update sidebar nav",
      });
      expect(task.kind).toBe("resolve");
      expect(task.trigger).toBe("update sidebar nav");
      expect(task.status).toBe("active");
    });
  });

  it("creates a generate task when kind is 'generate'", async () => {
    await withTempDir(async (root) => {
      await scaffold(root);
      const { task } = await runWorkCreate({
        root,
        kind: "generate",
        workflow: "generate-srs",
        trigger: "generate SRS for checkout",
        docType: "srs",
      });
      expect(task.kind).toBe("generate");
      expect(task.workflow).toBe("generate-srs");
    });
  });
});

describe("runWorkList", () => {
  it("returns empty list for a fresh fixture", async () => {
    await withTempDir(async (root) => {
      await scaffold(root);
      const result = await runWorkList({ root });
      expect(result.tasks).toEqual([]);
      expect(result.total).toBe(0);
    });
  });

  it("returns same tasks as runTaskList", async () => {
    await withTempDir(async (root) => {
      await scaffold(root);
      await runWorkCreate({
        root,
        kind: "change",
        workflow: "resolve",
        trigger: "fix sidebar",
      });
      const workResult = await runWorkList({ root });
      expect(workResult.total).toBe(1);
      expect(workResult.tasks[0]?.kind).toBe("resolve");
    });
  });
});

describe("runWorkStatus", () => {
  it("returns empty slots for fresh fixture", async () => {
    await withTempDir(async (root) => {
      await scaffold(root);
      const result = await runWorkStatus({ root });
      expect(result.slots).toEqual([]);
    });
  });

  it("shows active slot after work_create with kind change", async () => {
    await withTempDir(async (root) => {
      await scaffold(root);
      const { task } = await runWorkCreate({
        root,
        kind: "change",
        workflow: "resolve",
        trigger: "refactor auth",
      });
      const status = await runWorkStatus({ root });
      expect(status.slots.some((s) => s.taskId === task.id)).toBe(true);
    });
  });
});
