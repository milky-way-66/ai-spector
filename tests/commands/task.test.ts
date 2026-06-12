import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  formatTaskCreate,
  formatTaskGet,
  formatTaskList,
} from "@/interfaces/cli/format/task.js";
import {
  runTaskCreate,
  runTaskGet,
  runTaskList,
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
}

describe("task CLI formatters", () => {
  it("formatTaskCreate and formatTaskList produce human-readable output", async () => {
    await withTempDir(async (root) => {
      await scaffold(root);
      const created = await runTaskCreate({
        root,
        kind: "resolve",
        workflow: "resolve",
        trigger: "add login with Google",
      });

      const createText = formatTaskCreate(created);
      expect(createText).toContain(created.task.id);
      expect(createText).toContain("resolve");
      expect(createText).toContain("add login with Google");

      const list = await runTaskList({ root, status: "active" });
      const listText = formatTaskList(list);
      expect(listText).toContain(created.task.id);
      expect(listText).toContain("Active slots");
      expect(listText).toContain("resolve");

      const got = await runTaskGet({ root, taskId: created.task.id });
      const getText = formatTaskGet(got);
      expect(getText).toContain(got.taskPath);
      expect(getText).toContain("clarify");
    });
  });
});
