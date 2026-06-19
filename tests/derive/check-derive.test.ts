import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { runCheck } from "@/core/operations/check.js";
import { graph, node } from "../helpers/graph.js";
import { withTempProject } from "../helpers/temp-project.js";

describe("runCheck derive-downstream workflow", () => {
  it("passes generate-srs derive prerequisites with BD+DD and graph", async () => {
    await withTempProject(async (root) => {
      await mkdir(join(root, "docs/basic-design/en"), { recursive: true });
      await writeFile(join(root, "docs/basic-design/en/screen-list.md"), "# Screens\n");
      await mkdir(join(root, ".ai-spector/graph"), { recursive: true });
      await writeFile(
        join(root, ".ai-spector/graph/traceability.graph.json"),
        JSON.stringify(
          graph([node("feat.a", "feature")], []),
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

      const result = await runCheck({
        root,
        workflow: "generate-srs",
        sourceMode: "derive-downstream",
      });

      const deriveErrors = result.findings.filter((f) => f.ruleId.startsWith("DERIVE-001"));
      expect(deriveErrors).toEqual([]);
    });
  });

  it("reports DERIVE-001 when downstream docs missing", async () => {
    await withTempProject(async (root) => {
      const result = await runCheck({
        root,
        workflow: "generate-srs",
        sourceMode: "derive-downstream",
      });
      expect(result.findings.some((f) => f.ruleId.startsWith("DERIVE-001"))).toBe(true);
    });
  });
});
