import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { withTempProject } from "../helpers/temp-project.js";
import { writeJson, pathExists } from "@/core/util/fs.js";
import { reviewQueuePaths } from "@/core/reviews/paths.js";
import { saveApproval, makeApproval, writeSnapshot } from "@/core/reviews/storage.js";
import { contentHash } from "@/core/reviews/staleness.js";
import { ReviewPreconditionError } from "@/core/reviews/errors.js";
import { loadReviewSession } from "@/core/reviews/session.js";
import {
  runApprove,
  runReviewStatus,
  runReviewSessionAckReview,
  runReviewSessionStart,
  runReviewCheck,
} from "@/core/operations/review.js";

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

async function seedPendingInternal(
  root: string,
  logicalPath: string,
  content: string,
): Promise<string> {
  const docRel = `docs/srs/${logicalPath.split("/").pop()}.md`;
  await writeFile(join(root, docRel), content, "utf8");
  const hash = contentHash(content);
  const approval = makeApproval(logicalPath, hash, docRel);
  approval.overallStatus = "pending_internal";
  await writeSnapshot(root, logicalPath, content);
  await saveApproval(root, approval);
  return hash;
}

describe("review session gate", () => {
  it("rejects review_approve without session acknowledgement", async () => {
    await withTempProject(async (root) => {
      await setupReviewProject(root);
      await seedPendingInternal(root, "srs/01-overview", "# Overview\nDraft");

      await expect(runApprove({ root, logicalPath: "srs/01-overview" })).rejects.toMatchObject({
        reason: "session_not_ready",
      });
    });
  });

  it("rejects review_approve after review_status but before ack", async () => {
    await withTempProject(async (root) => {
      await setupReviewProject(root);
      await seedPendingInternal(root, "srs/02-scope", "# Scope\nDraft");

      await runReviewStatus({ root, logicalPath: "srs/02-scope", showDiff: false });
      const session = await loadReviewSession(root);
      expect(session?.phase).toBe("reviewing");

      try {
        await runApprove({ root, logicalPath: "srs/02-scope" });
        expect.fail("should throw");
      } catch (err) {
        expect(err).toBeInstanceOf(ReviewPreconditionError);
        expect((err as ReviewPreconditionError).reason).toBe("session_not_ready");
        expect((err as ReviewPreconditionError).sessionPhase).toBe("reviewing");
      }
    });
  });

  it("happy path: status → ack → approve clears session", async () => {
    await withTempProject(async (root) => {
      await setupReviewProject(root);
      const hash = await seedPendingInternal(root, "srs/03-draft", "# Draft\nBody");

      await runReviewSessionStart({ root });
      await runReviewStatus({ root, logicalPath: "srs/03-draft", showDiff: false });

      const ack = await runReviewSessionAckReview({ root, logicalPath: "srs/03-draft" });
      expect(ack.canReviewApprove).toBe(true);
      expect(ack.session.phase).toBe("awaiting_decision");

      const approved = await runApprove({ root, logicalPath: "srs/03-draft", by: "reviewer" });
      expect(approved.contentHash).toBe(hash);
      expect(approved.movedToClientQueue).toBe(true);

      const paths = reviewQueuePaths(root);
      expect(await pathExists(paths.session)).toBe(false);
    });
  });

  it("review_check creates session at detect phase", async () => {
    await withTempProject(async (root) => {
      await setupReviewProject(root);
      await runReviewCheck({ root });
      const session = await loadReviewSession(root);
      expect(session?.phase).toBe("detect");
    });
  });

  it("rejects approve when content changes after ack", async () => {
    await withTempProject(async (root) => {
      await setupReviewProject(root);
      await seedPendingInternal(root, "srs/04-change", "# Doc\nV1");

      await runReviewStatus({ root, logicalPath: "srs/04-change", showDiff: false });
      await runReviewSessionAckReview({ root, logicalPath: "srs/04-change" });

      await writeFile(join(root, "docs/srs/04-change.md"), "# Doc\nV2 edited", "utf8");

      await expect(runApprove({ root, logicalPath: "srs/04-change" })).rejects.toMatchObject({
        reason: "session_content_changed",
      });
    });
  });
});
