import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { createAdoptCompletedTasks } from "@/core/adopt/tasks.js";
import { taskIndexPath, type TaskState } from "@/core/operations/task.js";
import { readJson } from "@/core/util/fs.js";
import { withTempDir } from "../helpers/temp-project.js";

async function scaffoldMigratedSrs(root: string): Promise<void> {
  await mkdir(join(root, ".ai-spector"), { recursive: true });
  await writeFile(
    join(root, ".ai-spector/docflow.config.json"),
    JSON.stringify({
      languages: [{ code: "en", label: "English" }],
      paths: { graph: ".ai-spector/graph/traceability.json" },
    }),
    "utf8",
  );
  await mkdir(join(root, "docs/srs/en"), { recursive: true });
  await writeFile(
    join(root, "docs/srs/en/01-introduction.md"),
    "# Introduction\n\nMigrated SRS chapter.\n",
    "utf8",
  );
}

describe("createAdoptCompletedTasks", () => {
  it("creates completed srs task with adoptedAt when srs docs exist after migration", async () => {
    await withTempDir(async (root) => {
      await scaffoldMigratedSrs(root);

      const ids = await createAdoptCompletedTasks({ root });
      expect(ids.srs).toMatch(/^task-/);
      expect(ids.basicDesign).toBeUndefined();

      const task = await readJson<TaskState>(
        join(root, ".ai-spector/.docflow/tasks", `${ids.srs}.json`),
      );
      expect(task.status).toBe("complete");
      expect(task.trigger).toBe("adopt:migration");
      expect(task.workflow).toBe("generate-srs");
      expect(task.snapshot.adoptedAt).toBeTruthy();
      expect(task.snapshot.workspaceCheckAt).toBeTruthy();
      expect(task.planApprovedAt).toBeTruthy();
      expect(task.steps.every((s) => s.status === "done")).toBe(true);

      const index = await readJson<{ active: Record<string, string>; recent: string[] }>(
        taskIndexPath(root),
      );
      expect(index.recent).toContain(ids.srs);
      expect(Object.values(index.active)).not.toContain(ids.srs);
    });
  });
});
