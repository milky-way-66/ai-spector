import { execFile } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { promisify } from "node:util";
import { describe, expect, it } from "vitest";
import { writeJson } from "@/core/util/fs.js";
import {
  getApproval,
  makeApproval,
  saveApproval,
  writeSnapshot,
  findPendingJob,
} from "@/core/reviews/storage.js";
import { contentHash } from "@/core/reviews/staleness.js";
import { reconcileReviews } from "@/core/reviews/reconcile.js";
import { runReviewQueue, runApprove, runReviewStatus, runReviewSessionAckReview } from "@/core/operations/review.js";
import { internalApprovedTrack } from "./helpers.js";
import { withTempProject } from "../helpers/temp-project.js";

const exec = promisify(execFile);

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
  await mkdir(join(root, ".ai-spector/.docflow/config"), { recursive: true });
  await writeJson(join(root, ".ai-spector/.docflow/config/review-queue.json"), {
    version: 1,
    internal: { minApprovals: 1 },
    client: { minApprovals: 1 },
  });
  await writeJson(join(root, ".ai-spector/graph/traceability.graph.json"), {
    version: 1,
    nodes: [],
    edges: [],
  });
}

async function initGitRepo(root: string): Promise<void> {
  await exec("git", ["init"], { cwd: root });
  await exec("git", ["config", "user.email", "test@example.com"], { cwd: root });
  await exec("git", ["config", "user.name", "Test"], { cwd: root });
}

describe("review queue enrich on read", () => {
  it("enriches pending internal jobs with git diff and persists cache", async () => {
    await withTempProject(async (root) => {
      await initGitRepo(root);
      await setupReviewProject(root);

      const content = "# Overview\nApproved body";
      const docRel = "docs/srs/01-overview.md";
      const lp = "srs/01-overview";
      await writeFile(join(root, docRel), content, "utf8");
      await exec("git", ["add", "."], { cwd: root });
      await exec("git", ["commit", "-m", "init"], { cwd: root });

      const hash = contentHash(content);
      const approval = makeApproval(lp, hash, docRel);
      approval.internal = internalApprovedTrack("alice", "2026-06-11T00:00:00.000Z");
      approval.overallStatus = "pending_client";
      await writeSnapshot(root, lp, content);
      await saveApproval(root, approval);

      await writeFile(join(root, docRel), "# Overview\nChanged after approval", "utf8");
      await reconcileReviews(root);

      const result = await runReviewQueue({ root, track: "internal", showDiff: true });
      expect(result.internal.pending).toHaveLength(1);
      const enrichment = result.enrichments[lp];
      expect(enrichment).toBeDefined();
      expect(enrichment!.diffSource).toBe("git");
      expect(enrichment!.diff).toContain("Changed after approval");
      expect(enrichment!.anchorHash).toBe(result.internal.pending[0]!.currentHash);

      const job = await findPendingJob(root, "internal", lp);
      expect(job?.enrichment).toBeDefined();
      expect(job?.enrichment!.diff).toContain("Changed after approval");
    });
  });

  it("sets baselineAnchor on internal quorum finalize", async () => {
    await withTempProject(async (root) => {
      await initGitRepo(root);
      await setupReviewProject(root);

      const content = "# Overview\nDraft";
      const docRel = "docs/srs/02-scope.md";
      const lp = "srs/02-scope";
      await writeFile(join(root, docRel), content, "utf8");
      await exec("git", ["add", "."], { cwd: root });
      await exec("git", ["commit", "-m", "init"], { cwd: root });

      const hash = contentHash(content);
      await saveApproval(root, makeApproval(lp, hash, docRel));

      await runReviewStatus({ root, logicalPath: lp, showDiff: false });
      await runReviewSessionAckReview({ root, logicalPath: lp });
      await runApprove({ root, logicalPath: lp, by: "alice@co.com" });

      const approval = await getApproval(root, lp);
      expect(approval?.baselineAnchor).toBeDefined();
      expect(approval?.baselineAnchor!.hash).toBe(hash);
      expect(approval?.baselineAnchor!.path).toBe(docRel);
      expect(approval?.baselineAnchor!.gitRef).toBeTruthy();
    });
  });
});
