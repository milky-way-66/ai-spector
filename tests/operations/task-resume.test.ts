import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  runTaskCreate,
  runTaskPause,
  runTaskResume,
  runTaskUpdate,
} from "@/core/operations/task.js";
import { withTempDir } from "../helpers/temp-project.js";
import { scaffoldDocopsMinimal } from "../helpers/docops-scaffold.js";

async function scaffold(root: string): Promise<void> {
  await scaffoldDocopsMinimal(root);
}

describe("task resume", () => {
  it("detects artifact drift after pause and file edit", async () => {
    await withTempDir(async (root) => {
      await scaffold(root);
      const docPath = "docs/srs/en/03-use-cases.md";
      await mkdir(join(root, "docs/srs/en"), { recursive: true });
      await writeFile(join(root, docPath), "# Use cases v1\n", "utf8");

      const { task } = await runTaskCreate({
        root,
        kind: "generate",
        workflow: "generate-srs",
        trigger: "generate SRS",
        docType: "srs",
      });

      await runTaskUpdate({
        root,
        taskId: task.id,
        patch: {
          snapshot: { workspaceCheckAt: new Date().toISOString() },
          step: {
            id: "check",
            patch: {
              status: "done",
              artifacts: [docPath],
            },
          },
        },
      });

      await runTaskPause({ root, taskId: task.id });
      await writeFile(join(root, docPath), "# Use cases v2\n", "utf8");

      const resumed = await runTaskResume({ root, taskId: task.id });
      expect(resumed.task.status).toBe("paused");
      expect(resumed.canContinue).toBe(false);
      expect(resumed.drift).toHaveLength(1);
      expect(resumed.drift[0]?.kind).toBe("modified");
      expect(resumed.drift[0]?.path).toBe(docPath);
    });
  });

  it("reactivates paused task when workspace is clean and no drift", async () => {
    await withTempDir(async (root) => {
      await scaffold(root);
      const { task } = await runTaskCreate({
        root,
        kind: "resolve",
        workflow: "resolve",
        trigger: "add feature",
      });

      await runTaskPause({ root, taskId: task.id });
      const resumed = await runTaskResume({ root, taskId: task.id });
      expect(resumed.canContinue).toBe(true);
      expect(resumed.task.status).toBe("active");
    });
  });
});
