import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { withTempProject } from "../helpers/temp-project.js";
import { writeJson } from "@/core/util/fs.js";
import {
  saveApproval,
  makeApproval,
  loadQueueIndex,
} from "@/core/reviews/storage.js";
import { contentHash } from "@/core/reviews/staleness.js";
import {
  runApprove,
  runDecline,
  runClose,
  runReviewStatus,
  runReviewSessionAckReview,
} from "@/core/operations/review.js";

async function setupReviewProject(root: string): Promise<void> {
  await writeJson(join(root, ".ai-spector/docflow.config.json"), {
    version: 1,
    languages: [{ code: "en", label: "English" }],
    paths: {},
  });
  await mkdir(join(root, "docs/srs"), { recursive: true });
  await mkdir(join(root, ".ai-spector/.docflow/review-queue/snapshots"), { recursive: true });
}

async function ackAndApprove(
  root: string,
  logicalPath: string,
  by: string,
  note?: string,
) {
  await runReviewStatus({ root, logicalPath, showDiff: false });
  await runReviewSessionAckReview({ root, logicalPath });
  return runApprove({ root, logicalPath, by, ...(note ? { note } : {}) });
}

describe("multi-vote internal review", () => {
  it("single approve meets quorum and moves to client queue", async () => {
    await withTempProject(async (root) => {
      await setupReviewProject(root);
      const content = "# Overview\nDraft";
      const docRel = "docs/srs/01-overview.md";
      const lp = "srs/01-overview";
      await writeFile(join(root, docRel), content, "utf8");
      const hash = contentHash(content);
      await saveApproval(root, makeApproval(lp, hash, docRel));

      const first = await ackAndApprove(root, lp, "alice@co.com");
      expect(first.quorumMet).toBe(true);
      expect(first.movedToClientQueue).toBe(true);
    });
  });

  it("reaches quorum with 2 approve and 1 decline among 3 voters", async () => {
    await withTempProject(async (root) => {
      await setupReviewProject(root);
      const content = "# Overview\nDraft";
      const docRel = "docs/srs/02-scope.md";
      const lp = "srs/02-scope";
      await writeFile(join(root, docRel), content, "utf8");
      const hash = contentHash(content);
      await saveApproval(root, makeApproval(lp, hash, docRel));

      await runDecline({ root, logicalPath: lp, by: "bob@co.com", note: "needs work" });
      await ackAndApprove(root, lp, "alice@co.com");
      const result = await ackAndApprove(root, lp, "carol@co.com");

      expect(result.quorum.voterCount).toBe(3);
      expect(result.quorum.approveCount).toBe(2);
      expect(result.quorumMet).toBe(true);

      const status = await runReviewStatus({ root, logicalPath: lp, showDiff: false });
      expect(status.approval.overallStatus).toBe("pending_client");

      const queue = await loadQueueIndex(root, "client", "pending");
      expect(queue.entries.some((e) => e.logicalPath === lp)).toBe(true);
    });
  });

  it("upserts vote when same reviewer votes again", async () => {
    await withTempProject(async (root) => {
      await setupReviewProject(root);
      const content = "# Overview\nDraft";
      const docRel = "docs/srs/03-draft.md";
      const lp = "srs/03-draft";
      await writeFile(join(root, docRel), content, "utf8");
      const hash = contentHash(content);
      await saveApproval(root, makeApproval(lp, hash, docRel));

      await runDecline({ root, logicalPath: lp, by: "alice@co.com", note: "first" });
      await ackAndApprove(root, lp, "bob@co.com");
      await ackAndApprove(root, lp, "alice@co.com", "changed mind");

      const status = await runReviewStatus({ root, logicalPath: lp, showDiff: false });
      expect(status.approval.internal.votes).toHaveLength(2);
      const alice = status.approval.internal.votes.find((v) => v.by === "alice@co.com");
      expect(alice?.decision).toBe("approve");
    });
  });
});

describe("manual close", () => {
  it("rejects track when closed without quorum", async () => {
    await withTempProject(async (root) => {
      await setupReviewProject(root);
      const content = "# Overview\nDraft";
      const docRel = "docs/srs/04-close.md";
      const lp = "srs/04-close";
      await writeFile(join(root, docRel), content, "utf8");
      const hash = contentHash(content);
      await saveApproval(root, makeApproval(lp, hash, docRel));

      await runDecline({ root, logicalPath: lp, by: "bob@co.com", note: "no" });
      await runDecline({ root, logicalPath: lp, by: "carol@co.com", note: "no" });

      const closed = await runClose({
        root,
        logicalPath: lp,
        reason: "cannot reach consensus",
        by: "lead@co.com",
      });
      expect(closed.reason).toBe("cannot reach consensus");

      const status = await runReviewStatus({ root, logicalPath: lp, showDiff: false });
      expect(status.approval.internal.status).toBe("rejected");
      expect(status.approval.overallStatus).toBe("rejected");
    });
  });
});
