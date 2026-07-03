import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { assessReadiness } from "@/core/readiness/assess.js";
import { assertDeriveNotBlockedByCompleteSrs } from "@/core/operations/derive.js";
import { graph, node } from "../helpers/graph.js";
import { withTempProject } from "../helpers/temp-project.js";

describe("readiness derive-from-downstream", () => {
  it("passes with BD+DD and graph domain nodes only", async () => {
    await withTempProject(async (root) => {
      await mkdir(join(root, "docs/basic-design/en"), { recursive: true });
      await mkdir(join(root, "docs/detail-design/en/features"), { recursive: true });
      await writeFile(join(root, "docs/basic-design/en/screen-list.md"), "# Screens\n");
      await writeFile(join(root, "docs/detail-design/en/feature-list.md"), "# Features\n");
      await mkdir(join(root, ".ai-spector/graph"), { recursive: true });
      await writeFile(
        join(root, ".ai-spector/graph/traceability.graph.json"),
        JSON.stringify(graph([node("feat.a", "feature")], [])),
      );
      await writeFile(
        join(root, ".ai-spector/docflow.config.json"),
        JSON.stringify({
          version: 1,
          paths: { graph: ".ai-spector/graph/traceability.graph.json" },
          languages: [{ code: "en", label: "English" }],
        }),
      );

      const result = await assessReadiness({
        root,
        docType: "srs",
        sourceMode: "derive-downstream",
        workflow: "generate-srs",
        verbose: true,
      });

      expect(result.appliedProfiles).toContain("derive-from-downstream");
      expect(result.ready).toBe(true);
      expect(result.criteria!.map((c) => c.id)).toEqual(
        expect.arrayContaining(["DER-001", "DER-002"]),
      );
    });
  });
});

describe("assertDeriveNotBlockedByCompleteSrs", () => {
  it("blocks when SRS minimum files exist", async () => {
    await withTempProject(async (root) => {
      await mkdir(join(root, "docs/srs"), { recursive: true });
      await writeFile(join(root, "docs/srs/1-introduction.md"), "# Intro\n");
      await writeFile(join(root, "docs/srs/4-system-features.md"), "# Features\n");
      await expect(
        assertDeriveNotBlockedByCompleteSrs(root, "generate-srs"),
      ).rejects.toThrow(/already exist/);
    });
  });
});
