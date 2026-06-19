import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { evaluateWorkflowStep } from "@/core/workflow/dependencies.js";
import { graph, node } from "../helpers/graph.js";
import { withTempProject } from "../helpers/temp-project.js";

describe("evaluateWorkflowStep derive-downstream", () => {
  it("passes generate-srs derive mode when downstream docs and graph exist", async () => {
    await withTempProject(async (root) => {
      await mkdir(join(root, "docs/basic-design/en"), { recursive: true });
      await writeFile(join(root, "docs/basic-design/en/screen-list.md"), "# Screens\n");
      await mkdir(join(root, ".ai-spector/graph"), { recursive: true });
      await writeFile(
        join(root, ".ai-spector/graph/traceability.graph.json"),
        JSON.stringify(
          graph(
            [node("feat.login", "feature"), node("doc.bd.screen", "document")],
            [{ type: "definedIn", from: "feat.login", to: "doc.bd.screen" }],
          ),
        ),
      );
      await writeFile(
        join(root, ".ai-spector/docflow.config.json"),
        JSON.stringify({
          version: 1,
          paths: { graph: ".ai-spector/graph/traceability.graph.json" },
          languages: [{ code: "en", label: "English" }],
        }),
      );

      const result = await evaluateWorkflowStep(root, {
        stepId: "generate-srs",
        sourceMode: "derive-downstream",
      });

      expect(result.ok).toBe(true);
      expect(result.failures).toEqual([]);
    });
  });

  it("fails when downstream docs are missing", async () => {
    await withTempProject(async (root) => {
      const result = await evaluateWorkflowStep(root, {
        stepId: "generate-srs",
        sourceMode: "derive-downstream",
      });
      expect(result.ok).toBe(false);
      expect(result.failures.some((f) => f.id === "downstream-docs-exist")).toBe(true);
    });
  });
});
