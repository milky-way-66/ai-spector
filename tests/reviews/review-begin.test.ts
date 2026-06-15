import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { withTempProject } from "../helpers/temp-project.js";
import { writeJson, pathExists } from "@/core/util/fs.js";
import { reviewQueuePaths } from "@/core/reviews/paths.js";
import { getApproval } from "@/core/reviews/storage.js";
import { loadQueueIndex } from "@/core/reviews/storage.js";
import { runReviewDiscovery } from "@/core/reviews/register.js";
import { loadReviewSession } from "@/core/reviews/session.js";
import {
  runReviewBegin,
  runReviewCheck,
  runReviewQueue,
  runReviewStatus,
  runReviewSessionAckReview,
  runApprove,
} from "@/core/operations/review.js";
import { docRelPathToLogicalPath } from "@/core/reviews/discover.js";

async function setupGreenfieldProject(root: string): Promise<void> {
  await writeJson(join(root, ".ai-spector/docflow.config.json"), {
    version: 1,
    languages: [{ code: "en", label: "English" }],
    paths: {
      graph: ".ai-spector/graph/traceability.graph.json",
      registry: ".ai-spector/registry/section-registry.json",
      templates: ".ai-spector/templates",
    },
  });
  await mkdir(join(root, "docs/srs/en"), { recursive: true });
  await mkdir(join(root, ".ai-spector/.docflow/review-queue"), { recursive: true });
  await writeJson(join(root, ".ai-spector/.docflow/review-queue/registry.json"), {
    version: 2,
    documents: {},
  });
  await writeFile(
    join(root, "docs/srs/en/1-introduction.md"),
    "# Introduction\n\nProject overview.\n",
    "utf8",
  );
}

describe("docRelPathToLogicalPath", () => {
  it("maps language subfolder paths to logical paths", () => {
    expect(docRelPathToLogicalPath("docs/srs/en/1-introduction.md", ["en"])).toBe(
      "srs/1-introduction",
    );
    expect(docRelPathToLogicalPath("docs/srs/1-introduction.md", ["en"])).toBe(
      "srs/1-introduction",
    );
  });
});

describe("first sign-off without registry", () => {
  it("review_check discovers and queues never-reviewed docs", async () => {
    await withTempProject(async (root) => {
      await setupGreenfieldProject(root);
      const result = await runReviewCheck({ root });
      expect(result.discovered).toBe(1);
      expect(result.queued).toBe(1);
      expect(result.scanned).toBe(0);

      const approval = await getApproval(root, "srs/1-introduction");
      expect(approval?.overallStatus).toBe("pending_internal");
    });
  });

  it("review_status auto-registers and sets session without throwing", async () => {
    await withTempProject(async (root) => {
      await setupGreenfieldProject(root);
      const result = await runReviewStatus({ root, logicalPath: "srs/1-introduction", showDiff: false });
      expect(result.approval.logicalPath).toBe("srs/1-introduction");
      expect(result.reviewKind).toBe("first");
      expect(result.reviewTemplate).toBe("first");
      expect(result.session?.phase).toBe("reviewing");
      expect(result.session?.activeLogicalPath).toBe("srs/1-introduction");
    });
  });

  it("full happy path: begin → ack → approve with no manual file edits", async () => {
    await withTempProject(async (root) => {
      await setupGreenfieldProject(root);

      const begin = await runReviewBegin({
        root,
        logicalPath: "srs/1-introduction",
        showDiff: false,
      });
      expect("approval" in begin).toBe(true);
      if (!("approval" in begin)) return;
      expect(begin.reviewKind).toBe("first");
      expect(begin.session?.phase).toBe("reviewing");

      const ack = await runReviewSessionAckReview({ root, logicalPath: "srs/1-introduction" });
      expect(ack.canReviewApprove).toBe(true);
      expect(ack.session.phase).toBe("awaiting_decision");

      const approved = await runApprove({ root, logicalPath: "srs/1-introduction", by: "reviewer" });
      expect(approved.movedToClientQueue).toBe(true);

      const paths = reviewQueuePaths(root);
      expect(await pathExists(paths.session)).toBe(false);
    });
  });

  it("review_queue is non-empty after discovery on greenfield project", async () => {
    await withTempProject(async (root) => {
      await setupGreenfieldProject(root);
      const queue = await runReviewQueue({ root, track: "internal", showDiff: false });
      expect(queue.internal.pending.length).toBe(1);
      expect(queue.internal.pending[0]?.reason).toBe("first_review");
    });
  });

  it("review_begin without logicalPath returns queue summary", async () => {
    await withTempProject(async (root) => {
      await setupGreenfieldProject(root);
      const result = await runReviewBegin({ root });
      expect("queue" in result).toBe(true);
      if (!("queue" in result)) return;
      expect(result.discovery.discovered).toBe(1);
      expect(result.queue.internal.pending.length).toBe(1);
    });
  });

  it("syncs pending hash when file changes before first sign-off", async () => {
    await withTempProject(async (root) => {
      await setupGreenfieldProject(root);
      await runReviewDiscovery(root);

      await writeFile(
        join(root, "docs/srs/en/1-introduction.md"),
        "# Introduction\n\nEdited before review.\n",
        "utf8",
      );

      const sync = await runReviewDiscovery(root);
      expect(sync.updated).toBe(1);
      expect(sync.queued).toBe(0);

      const approval = await getApproval(root, "srs/1-introduction");
      expect(approval?.contentHash).not.toBe("");

      const queue = await loadQueueIndex(root, "internal", "pending");
      expect(queue.entries[0]?.currentHash).toBe(approval?.contentHash);
    });
  });
});
