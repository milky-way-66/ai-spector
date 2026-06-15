import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { withTempProject } from "../helpers/temp-project.js";
import { writeJson } from "@/core/util/fs.js";
import { saveApproval, makeApproval, writeSnapshot } from "@/core/reviews/storage.js";
import { contentHash, computeLiveStaleness } from "@/core/reviews/staleness.js";
import { internalApprovedTrack } from "./helpers.js";
import { runReviewStatus, runReviewList } from "@/core/operations/review.js";

async function setupReviewProject(root: string): Promise<void> {
  await writeJson(join(root, ".ai-spector/docflow.config.json"), {
    version: 1,
    languages: [{ code: "en", label: "English" }],
    paths: {
      graph: ".ai-spector/graph/traceability.graph.json",
      registry: ".ai-spector/registry/section-registry.json",
      templates: ".ai-spector/templates",
    },
  });
  await mkdir(join(root, "docs/srs"), { recursive: true });
  await mkdir(join(root, ".ai-spector/.docflow/review-queue/snapshots"), { recursive: true });
}

describe("computeLiveStaleness", () => {
  it("returns stale when approved doc content changes", async () => {
    await withTempProject(async (root) => {
      await setupReviewProject(root);
      const content = "# Chapter 3\nOriginal content";
      await writeFile(join(root, "docs/srs/3-use-cases.md"), content, "utf8");
      const hash = contentHash(content);

      const approval = makeApproval("srs/3-use-cases", hash, "docs/srs/3-use-cases.md");
      approval.internal = internalApprovedTrack("tester", "2026-06-11T00:00:00.000Z");
      approval.overallStatus = "pending_client";
      approval.client.status = "pending";
      await writeSnapshot(root, "srs/3-use-cases", content);
      await saveApproval(root, approval);

      await writeFile(
        join(root, "docs/srs/3-use-cases.md"),
        "# Chapter 3\nUpdated UC-12 logout",
        "utf8",
      );

      const live = await computeLiveStaleness(root, approval);
      expect(live.stale).toBe(true);
      expect(live.effectiveApproval.internal.status).toBe("needs_review");
      expect(live.effectiveApproval.overallStatus).toBe("pending_internal");
      expect(live.diff).not.toBeNull();
      expect(live.diff?.diff).toContain("UC-12 logout");
    });
  });

  it("uses approval.docPath when primary language stub differs", async () => {
    await withTempProject(async (root) => {
      await writeJson(join(root, ".ai-spector/docflow.config.json"), {
        version: 1,
        languages: [
          { code: "en", label: "English" },
          { code: "vi", label: "Vietnamese" },
        ],
        paths: {
          graph: ".ai-spector/graph/traceability.graph.json",
          registry: ".ai-spector/registry/section-registry.json",
          templates: ".ai-spector/templates",
        },
      });
      await mkdir(join(root, "docs/srs/en"), { recursive: true });
      await mkdir(join(root, "docs/srs/vi"), { recursive: true });
      await mkdir(join(root, ".ai-spector/.docflow/review-queue/snapshots"), { recursive: true });

      const viContent = "# Use cases VI\nApproved body";
      await writeFile(join(root, "docs/srs/en/3-use-cases.md"), "# EN stub unchanged", "utf8");
      await writeFile(join(root, "docs/srs/vi/3-use-cases.md"), viContent, "utf8");

      const hash = contentHash(viContent);
      const approval = makeApproval("srs/3-use-cases", hash, "docs/srs/vi/3-use-cases.md");
      approval.internal = internalApprovedTrack("tester", "2026-06-11T00:00:00.000Z");
      approval.overallStatus = "pending_client";
      await writeSnapshot(root, "srs/3-use-cases", viContent);
      await saveApproval(root, approval);

      await writeFile(join(root, "docs/srs/vi/3-use-cases.md"), "# Use cases VI\nGoogle LINE login", "utf8");

      const live = await computeLiveStaleness(root, approval);
      expect(live.stale).toBe(true);
    });
  });

  it("is not stale when content matches approved hash", async () => {
    await withTempProject(async (root) => {
      await setupReviewProject(root);
      const content = "# Same content";
      await writeFile(join(root, "docs/srs/1-intro.md"), content, "utf8");
      const hash = contentHash(content);
      const approval = makeApproval("srs/1-intro", hash, "docs/srs/1-intro.md");
      approval.internal = internalApprovedTrack("tester", "2026-06-11T00:00:00.000Z");
      approval.overallStatus = "pending_client";

      const live = await computeLiveStaleness(root, approval);
      expect(live.stale).toBe(false);
      expect(live.effectiveApproval.overallStatus).toBe("pending_client");
    });
  });
});

describe("runReviewStatus live staleness", () => {
  it("exposes needs_review without running review check", async () => {
    await withTempProject(async (root) => {
      await setupReviewProject(root);
      const content = "# Chapter\nBefore";
      await writeFile(join(root, "docs/srs/3-use-cases.md"), content, "utf8");
      const hash = contentHash(content);

      const approval = makeApproval("srs/3-use-cases", hash, "docs/srs/3-use-cases.md");
      approval.internal = internalApprovedTrack("tester", "2026-06-11T00:00:00.000Z");
      approval.overallStatus = "pending_client";
      await writeSnapshot(root, "srs/3-use-cases", content);
      await saveApproval(root, approval);

      await writeFile(join(root, "docs/srs/3-use-cases.md"), "# Chapter\nAfter edit", "utf8");

      const result = await runReviewStatus({ root, logicalPath: "srs/3-use-cases" });
      expect(result.stale).toBe(true);
      expect(result.approval.internal.status).toBe("needs_review");
      expect(result.approval.overallStatus).toBe("pending_internal");
      expect(result.diff).not.toBeNull();
    });
  });
});

describe("runReviewList live staleness", () => {
  it("marks changed documents as stale in list", async () => {
    await withTempProject(async (root) => {
      await setupReviewProject(root);
      const content = "# Doc A";
      await writeFile(join(root, "docs/srs/a.md"), content, "utf8");
      const hash = contentHash(content);

      const approval = makeApproval("srs/a", hash, "docs/srs/a.md");
      approval.internal = internalApprovedTrack("tester", "2026-06-11T00:00:00.000Z");
      approval.overallStatus = "pending_client";
      await saveApproval(root, approval);

      await writeFile(join(root, "docs/srs/a.md"), "# Doc A changed", "utf8");

      const result = await runReviewList({ root, prefix: "srs/a" });
      expect(result.entries).toHaveLength(1);
      expect(result.entries[0].stale).toBe(true);
      expect(result.entries[0].internal.status).toBe("needs_review");
      expect(result.entries[0].overallStatus).toBe("pending_internal");
    });
  });
});
