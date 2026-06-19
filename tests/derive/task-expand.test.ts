import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { runSpecRecord } from "@/core/operations/extracted.js";
import { runTaskCreate } from "@/core/operations/task.js";
import { withTempProject } from "../helpers/temp-project.js";

describe("spec_record provenance", () => {
  it("stores derive-downstream provenance on recorded specs", async () => {
    await withTempProject(async (root) => {
      await mkdir(join(root, ".ai-spector/.docflow/extracted"), { recursive: true });
      const result = await runSpecRecord({
        root,
        docType: "srs",
        specs: [
          {
            statement: "Login requires email and password",
            extractedFrom: ["docs/srs/en/4-system-features.md"],
            provenance: "derive-downstream",
          },
        ],
      });
      expect(result.recorded[0]?.provenance).toBe("derive-downstream");
    });
  });
});

describe("expand derive task linking", () => {
  it("rejects expand bootstrap when prior task is not complete extract", async () => {
    await withTempProject(async (root) => {
      await mkdir(join(root, ".ai-spector/.docflow/tasks"), { recursive: true });
      await writeFile(
        join(root, ".ai-spector/.docflow/tasks/index.json"),
        JSON.stringify({ version: 1, active: {}, recent: [] }),
      );

      const { task: extractTask } = await runTaskCreate({
        root,
        kind: "generate",
        workflow: "generate-srs",
        docType: "srs",
        trigger: "backfill",
        sourceMode: "derive-downstream",
        deriveFrom: ["basic-design", "detail-design"],
        derivePhase: "extract",
      });

      await expect(
        runTaskCreate({
          root,
          kind: "generate",
          workflow: "generate-srs",
          docType: "srs",
          trigger: "expand",
          sourceMode: "derive-downstream",
          deriveFrom: ["basic-design", "detail-design"],
          derivePhase: "expand",
          priorDeriveTaskId: extractTask.id,
          force: true,
        }),
      ).rejects.toThrow(/not complete/);
    });
  });
});
