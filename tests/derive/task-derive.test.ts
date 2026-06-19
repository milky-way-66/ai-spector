import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { runTaskList } from "@/core/operations/task.js";
import { withTempProject } from "../helpers/temp-project.js";

describe("derive task bootstrap", () => {
  it("persists sourceMode on snapshot via task_list bootstrap", async () => {
    await withTempProject(async (root) => {
      await mkdir(join(root, ".ai-spector/.docflow/tasks"), { recursive: true });
      await writeFile(
        join(root, ".ai-spector/.docflow/tasks/index.json"),
        JSON.stringify({ version: 1, active: {}, recent: [] }),
      );

      const result = await runTaskList({
        root,
        bootstrap: {
          kind: "generate",
          workflow: "generate-srs",
          docType: "srs",
          trigger: "backfill SRS from basic design",
          sourceMode: "derive-downstream",
          deriveFrom: ["basic-design", "detail-design"],
        },
      });

      expect(result.bootstrapped?.task.snapshot.sourceMode).toBe("derive-downstream");
      expect(result.bootstrapped?.task.snapshot.deriveFrom).toEqual([
        "basic-design",
        "detail-design",
      ]);
      expect(result.bootstrapped?.task.snapshot.derivePhase).toBe("extract");
    });
  });
});
