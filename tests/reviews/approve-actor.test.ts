import { execFile } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { promisify } from "node:util";
import { describe, expect, it } from "vitest";
import { withTempDir } from "../helpers/temp-project.js";
import { writeJson } from "@/core/util/fs.js";
import { saveApproval, makeApproval, writeSnapshot, readHistory } from "@/core/reviews/storage.js";
import { contentHash } from "@/core/reviews/staleness.js";
import { internalApprovedTrack } from "./helpers.js";
import {
  runApprove,
  runReviewStatus,
  runReviewSessionAckReview,
} from "@/core/operations/review.js";

const exec = promisify(execFile);

async function setupReviewProject(root: string): Promise<void> {
  await writeJson(join(root, ".ai-spector/docflow.config.json"), {
    version: 1,
    languages: [{ code: "en", label: "English" }],
    paths: {},
  });
  await mkdir(join(root, "docs/srs"), { recursive: true });
  await mkdir(join(root, ".ai-spector/.docflow/review-queue/snapshots"), { recursive: true });
}

async function initGit(root: string, email: string): Promise<void> {
  await exec("git", ["init"], { cwd: root });
  await exec("git", ["config", "user.email", email], { cwd: root });
  await exec("git", ["config", "user.name", "Reviewer"], { cwd: root });
}

describe("review approve actor", () => {
  it("records git email and role=user in history when by is generic", async () => {
    await withTempDir(async (root) => {
      await setupReviewProject(root);
      await initGit(root, "reviewer@example.com");

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

      const result = await runApprove({ root, logicalPath: "srs/03-draft", by: "user" });
      expect(result.approvedBy).toBe("reviewer@example.com");
      expect(result.approvedByUsername).toBe("Reviewer");
      expect(result.approvedByRole).toBe("user");

      const history = await readHistory(root, "srs/03-draft");
      expect(history.find((h) => h.event === "internal_vote")).toMatchObject({
        decision: "approve",
        by: "reviewer@example.com",
        username: "Reviewer",
        role: "user",
      });
    });
  });
});
