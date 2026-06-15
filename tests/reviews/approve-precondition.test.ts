import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { withTempProject } from "../helpers/temp-project.js";
import { writeJson } from "@/core/util/fs.js";
import { saveApproval, makeApproval, writeSnapshot } from "@/core/reviews/storage.js";
import { contentHash } from "@/core/reviews/staleness.js";
import { internalApprovedTrack, clientApprovedTrack } from "./helpers.js";
import { ReviewPreconditionError } from "@/core/reviews/errors.js";
import { runApprove, runReviewStatus, runReviewSessionAckReview } from "@/core/operations/review.js";

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

describe("runApprove preconditions", () => {
  it("throws ReviewPreconditionError when document is already pending_client", async () => {
    await withTempProject(async (root) => {
      await setupReviewProject(root);
      const content = "# Overview\nApproved body";
      const docRel = "docs/srs/01-overview.md";
      await writeFile(join(root, docRel), content, "utf8");
      const hash = contentHash(content);

      const approval = makeApproval("srs/01-overview", hash, docRel);
      approval.internal = internalApprovedTrack("alice", "2026-06-11T00:00:00.000Z");
      approval.overallStatus = "pending_client";
      approval.client.status = "pending";
      await writeSnapshot(root, "srs/01-overview", content);
      await saveApproval(root, approval);

      await expect(
        runApprove({ root, logicalPath: "srs/01-overview", by: "bob" }),
      ).rejects.toBeInstanceOf(ReviewPreconditionError);

      try {
        await runApprove({ root, logicalPath: "srs/01-overview", by: "bob" });
      } catch (err) {
        expect(err).toBeInstanceOf(ReviewPreconditionError);
        const pre = err as ReviewPreconditionError;
        expect(pre.code).toBe("PRECONDITION_FAILED");
        expect(pre.reason).toBe("already_pending_client");
        expect(pre.toPayload().error).toBe("PRECONDITION_FAILED");
        expect(pre.toPayload().suggestedTools).toContain("review_status");
        expect(pre.toPayload().suggestedTools).toContain("spec_approve");
        expect(pre.toPayload().overallStatus).toBe("pending_client");
        expect(pre.toPayload().userMessage).toContain("client approval");
      }
    });
  });

  it("throws ReviewPreconditionError when document is fully approved", async () => {
    await withTempProject(async (root) => {
      await setupReviewProject(root);
      const content = "# Overview\nDone";
      const docRel = "docs/srs/02-scope.md";
      await writeFile(join(root, docRel), content, "utf8");
      const hash = contentHash(content);

      const approval = makeApproval("srs/02-scope", hash, docRel);
      approval.internal = internalApprovedTrack("alice", "2026-06-11T00:00:00.000Z");
      approval.client = clientApprovedTrack("client@example.com", "2026-06-11T01:00:00.000Z");
      approval.overallStatus = "approved";
      await writeSnapshot(root, "srs/02-scope", content);
      await saveApproval(root, approval);

      await expect(runApprove({ root, logicalPath: "srs/02-scope" })).rejects.toMatchObject({
        reason: "fully_approved",
      });
    });
  });

  it("allows approve when pending_internal and session acknowledged", async () => {
    await withTempProject(async (root) => {
      await setupReviewProject(root);
      const content = "# Overview\nDraft";
      const docRel = "docs/srs/03-draft.md";
      await writeFile(join(root, docRel), content, "utf8");
      const hash = contentHash(content);

      const approval = makeApproval("srs/03-draft", hash, docRel);
      approval.overallStatus = "pending_internal";
      await writeSnapshot(root, "srs/03-draft", content);
      await saveApproval(root, approval);

      await runReviewStatus({ root, logicalPath: "srs/03-draft", showDiff: false });
      await runReviewSessionAckReview({ root, logicalPath: "srs/03-draft" });

      const result = await runApprove({
        root,
        logicalPath: "srs/03-draft",
        by: "reviewer@example.com",
      });
      expect(result.approvedBy).toBe("reviewer@example.com");
      expect(result.approvedByUsername).toBe("unknown");
      expect(result.approvedByRole).toBe("user");
      expect(result.quorumMet).toBe(true);
      expect(result.movedToClientQueue).toBe(true);
    });
  });
});

describe("runReviewStatus workflowGuidance", () => {
  it("includes workflowGuidance with canReviewApprove false for pending_client", async () => {
    await withTempProject(async (root) => {
      await setupReviewProject(root);
      const content = "# Overview\nBody";
      const docRel = "docs/srs/04-client.md";
      await writeFile(join(root, docRel), content, "utf8");
      const hash = contentHash(content);

      const approval = makeApproval("srs/04-client", hash, docRel);
      approval.internal = internalApprovedTrack("alice", "2026-06-11T00:00:00.000Z");
      approval.overallStatus = "pending_client";
      approval.client.status = "pending";
      await writeSnapshot(root, "srs/04-client", content);
      await saveApproval(root, approval);

      const result = await runReviewStatus({ root, logicalPath: "srs/04-client", showDiff: false });
      expect(result.workflowGuidance).toBeDefined();
      expect(result.workflowGuidance?.phase).toBe("awaiting_client");
      expect(result.workflowGuidance?.canReviewApprove).toBe(false);
      expect(result.workflowGuidance?.notTheseTools).toContain("review_approve");
      expect(result.workflowGuidance?.notTheseTools).toContain("spec_approve");
    });
  });
});
