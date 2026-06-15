import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { withTempProject } from "../helpers/temp-project.js";
import { writeJson } from "@/core/util/fs.js";
import { workspaceIndexDocsPath } from "@/core/config/docflow-paths.js";
import { runIndex } from "@/core/operations/index.js";
import { getApproval, loadQueueIndex } from "@/core/reviews/storage.js";
import { formatIndexReport } from "@/interfaces/cli/format/index-cmd.js";

async function setupIndexProject(root: string): Promise<void> {
  await writeJson(join(root, ".ai-spector/docflow.config.json"), {
    version: 1,
    languages: [{ code: "en", label: "English" }],
    paths: {
      graph: ".ai-spector/graph/traceability.graph.json",
      registry: ".ai-spector/registry/section-registry.json",
      templates: ".ai-spector/templates",
    },
  });
  await mkdir(join(root, ".ai-spector/.docflow/config/workspace"), { recursive: true });
  await writeJson(workspaceIndexDocsPath(root), {
    version: 1,
    outputs: {
      srs: ".ai-spector/index/srs.md",
      basicDesign: ".ai-spector/index/basic-design.md",
    },
    sources: {
      srs: { root: "docs/srs", glob: "**/*.md" },
      basicDesign: { root: "docs/basic-design", glob: "**/*.md" },
    },
  });
  await mkdir(join(root, "docs/srs/en"), { recursive: true });
  await writeFile(
    join(root, "docs/srs/en/1-introduction.md"),
    "# Introduction\n\nOverview.\n",
    "utf8",
  );
}

describe("runIndex review queue sync", () => {
  it("queues never-reviewed SRS docs after docs-index", async () => {
    await withTempProject(async (root) => {
      await setupIndexProject(root);

      const report = await runIndex({
        root,
        docsOnly: true,
        skipMerge: true,
        skipValidate: true,
        skipDocSemantics: true,
      });

      const reviewStep = report.steps.find((s) => s.id === "review-queue");
      expect(reviewStep?.status).toBe("ok");
      expect(reviewStep?.detail).toContain("1 on disk");
      expect(reviewStep?.detail).toContain("+1 first-review");

      expect(report.reviewQueue?.queued).toBe(1);
      expect(report.reviewQueue?.discovered).toBe(1);
      expect(report.nextAction).toMatch(/review_begin|\/review/i);
      expect(formatIndexReport(report)).toContain("Review queue");

      const approval = await getApproval(root, "srs/1-introduction");
      expect(approval?.overallStatus).toBe("pending_internal");

      const queue = await loadQueueIndex(root, "internal", "pending");
      expect(queue.entries).toHaveLength(1);
      expect(queue.entries[0]?.reason).toBe("first_review");
    });
  });

  it("updates pending queue when doc changes between index runs", async () => {
    await withTempProject(async (root) => {
      await setupIndexProject(root);

      await runIndex({
        root,
        docsOnly: true,
        skipMerge: true,
        skipValidate: true,
        skipDocSemantics: true,
      });

      await writeFile(
        join(root, "docs/srs/en/1-introduction.md"),
        "# Introduction\n\nEdited.\n",
        "utf8",
      );

      const report = await runIndex({
        root,
        docsOnly: true,
        skipMerge: true,
        skipValidate: true,
        skipDocSemantics: true,
      });

      expect(report.reviewQueue?.updated).toBe(1);
      const reviewStep = report.steps.find((s) => s.id === "review-queue");
      expect(reviewStep?.detail).toContain("pending updated");
    });
  });
});
