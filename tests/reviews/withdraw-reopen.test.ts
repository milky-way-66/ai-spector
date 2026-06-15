import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { withTempProject } from "../helpers/temp-project.js";
import { writeJson } from "@/core/util/fs.js";
import {
  saveApproval,
  makeApproval,
  loadQueueIndex,
  getApproval,
} from "@/core/reviews/storage.js";
import { contentHash } from "@/core/reviews/staleness.js";
import {
  runApprove,
  runDecline,
  runWithdraw,
  runReopen,
  runReviewStatus,
  runReviewSessionAckReview,
} from "@/core/operations/review.js";

async function setupReviewProject(
  root: string,
  opts?: { internalMinApprovals?: number },
): Promise<void> {
  await writeJson(join(root, ".ai-spector/docflow.config.json"), {
    version: 1,
    languages: [{ code: "en", label: "English" }],
    paths: {},
  });
  await mkdir(join(root, "docs/srs"), { recursive: true });
  await mkdir(join(root, ".ai-spector/.docflow/review-queue/snapshots"), { recursive: true });
  await mkdir(join(root, ".ai-spector/.docflow/config"), { recursive: true });
  await writeJson(join(root, ".ai-spector/.docflow/config/review-queue.json"), {
    version: 1,
    internal: { minApprovals: opts?.internalMinApprovals ?? 1 },
    client: { minApprovals: 1 },
  });
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

describe("review withdraw and reopen", () => {
  it("withdraw removes vote and drops below minApprovals", async () => {
    await withTempProject(async (root) => {
      await setupReviewProject(root, { internalMinApprovals: 2 });
      const content = "# Overview\nDraft";
      const docRel = "docs/srs/01-overview.md";
      const lp = "srs/01-overview";
      await writeFile(join(root, docRel), content, "utf8");
      const hash = contentHash(content);
      await saveApproval(root, makeApproval(lp, hash, docRel));

      await ackAndApprove(root, lp, "alice@co.com");
      await ackAndApprove(root, lp, "bob@co.com");

      let status = await runReviewStatus({ root, logicalPath: lp, showDiff: false });
      expect(status.approval.overallStatus).toBe("pending_client");

      await runReopen({ root, logicalPath: lp, by: "alice@co.com" });

      status = await runReviewStatus({ root, logicalPath: lp, showDiff: false });
      expect(status.approval.overallStatus).toBe("pending_internal");
      expect(status.approval.client.votes).toHaveLength(0);

      const withdrawn = await runWithdraw({ root, logicalPath: lp, by: "bob@co.com" });
      expect(withdrawn.quorum.approveCount).toBe(1);
      expect(withdrawn.quorum.met).toBe(false);

      status = await runReviewStatus({ root, logicalPath: lp, showDiff: false });
      expect(status.approval.internal.votes).toHaveLength(1);
      expect(status.approval.overallStatus).toBe("pending_internal");
    });
  });

  it("reopen keeps quorum latched until a new vote after reopen", async () => {
    await withTempProject(async (root) => {
      await setupReviewProject(root, { internalMinApprovals: 2 });
      const content = "# Overview\nDraft";
      const docRel = "docs/srs/02-scope.md";
      const lp = "srs/02-scope";
      await writeFile(join(root, docRel), content, "utf8");
      const hash = contentHash(content);
      await saveApproval(root, makeApproval(lp, hash, docRel));

      await ackAndApprove(root, lp, "alice@co.com");
      await ackAndApprove(root, lp, "bob@co.com");

      await runReopen({ root, logicalPath: lp, by: "carol@co.com" });

      let status = await runReviewStatus({ root, logicalPath: lp, showDiff: false });
      expect(status.approval.internal.status).toBe("pending");
      expect(status.approval.internal.votes).toHaveLength(2);
      expect(status.approval.overallStatus).toBe("pending_internal");

      const queue = await loadQueueIndex(root, "internal", "pending");
      expect(queue.entries.some((e) => e.logicalPath === lp)).toBe(true);
      expect(queue.entries.some((e) => e.logicalPath === lp && e.reason)).toBe(true);

      await runDecline({ root, logicalPath: lp, by: "carol@co.com", note: "re-check" });

      status = await runReviewStatus({ root, logicalPath: lp, showDiff: false });
      expect(status.approval.overallStatus).toBe("pending_client");
    });
  });

  it("single approve does not meet minApprovals of 2", async () => {
    await withTempProject(async (root) => {
      await setupReviewProject(root, { internalMinApprovals: 2 });
      const content = "# Overview\nDraft";
      const docRel = "docs/srs/03-draft.md";
      const lp = "srs/03-draft";
      await writeFile(join(root, docRel), content, "utf8");
      const hash = contentHash(content);
      await saveApproval(root, makeApproval(lp, hash, docRel));

      const first = await ackAndApprove(root, lp, "alice@co.com");
      expect(first.quorumMet).toBe(false);
      expect(first.movedToClientQueue).toBe(false);

      const approval = await getApproval(root, lp);
      expect(approval?.overallStatus).toBe("pending_internal");
    });
  });
});
