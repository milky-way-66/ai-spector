import { copyFile, mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { packageBundleRoot } from "@/core/config/load.js";
import { runReviewStatus } from "@/core/operations/review.js";
import { makeApproval, saveApproval, writeSnapshot } from "@/core/reviews/storage.js";
import { contentHash } from "@/core/reviews/staleness.js";
import { writeJson } from "@/core/util/fs.js";
import { withTempProject } from "../helpers/temp-project.js";

async function setupReviewWithReadiness(root: string): Promise<void> {
  const configDir = join(root, ".ai-spector/.docflow/config/doc-types/srs");
  await mkdir(configDir, { recursive: true });
  await mkdir(join(root, "docs/srs"), { recursive: true });
  await mkdir(join(root, ".ai-spector/.docflow/review-queue/snapshots"), { recursive: true });

  const bundle = join(packageBundleRoot(), "scaffold/.ai-spector/.docflow/config/doc-types/srs");
  await copyFile(join(bundle, "readiness-criteria.json"), join(configDir, "readiness-criteria.json"));
  await copyFile(join(bundle, "completeness-rules.json"), join(configDir, "completeness-rules.json"));
  await copyFile(join(bundle, "dag.json"), join(configDir, "dag.json"));

  await writeJson(join(root, ".ai-spector/docflow.config.json"), {
    version: 1,
    languages: [{ code: "en", label: "English" }],
    readiness: { profile: "general" },
    paths: {
      graph: ".ai-spector/graph/traceability.graph.json",
      registry: ".ai-spector/registry/section-registry.json",
      templates: ".ai-spector/templates",
    },
    packs: { srs: "builtin", basicDesign: "builtin" },
  });
}

describe("runReviewStatus readiness", () => {
  it("includes structural scan and output checklist for known doc types", async () => {
    await withTempProject(async (root) => {
      await setupReviewWithReadiness(root);
      const content = "# Introduction\n\nPurpose and scope.\n";
      const docRel = "docs/srs/1-introduction.md";
      await writeFile(join(root, docRel), content, "utf8");
      const hash = contentHash(content);

      const approval = makeApproval("srs/1-introduction", hash, docRel);
      approval.overallStatus = "pending_internal";
      await writeSnapshot(root, "srs/1-introduction", content);
      await saveApproval(root, approval);

      const result = await runReviewStatus({
        root,
        logicalPath: "srs/1-introduction",
        showDiff: false,
      });

      expect(result.readiness).toBeDefined();
      expect(result.readiness?.docType).toBe("srs");
      expect(result.readiness?.docPath).toBe(docRel);
      expect(result.readiness?.structuralScan.docType).toBe("srs");
      expect(result.readiness?.outputChecklist.docType).toBe("srs");
      expect(result.readiness?.outputChecklist.checklists.length).toBeGreaterThan(0);
      expect(result.workflowGuidance?.nextTools).toContain("readiness_scan");
      expect(result.workflowGuidance?.nextTools).toContain("readiness_output_checklist");
    });
  });
});
