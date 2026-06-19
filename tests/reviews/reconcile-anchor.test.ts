import { execFile } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { promisify } from "node:util";
import { describe, expect, it } from "vitest";
import { writeJson } from "@/core/util/fs.js";
import { pathExists } from "@/core/util/fs.js";
import {
  getApproval,
  loadDiff,
  saveApproval,
  writeSnapshot,
} from "@/core/reviews/storage.js";
import { reconcileReviews } from "@/core/reviews/reconcile.js";
import { findPendingJob } from "@/core/reviews/storage.js";
import { contentHash } from "@/core/reviews/staleness.js";
import { internalApprovedTrack } from "./helpers.js";
import { makeApproval } from "@/core/reviews/storage.js";
import { withTempProject } from "../helpers/temp-project.js";
import { changePath, reviewQueuePaths } from "@/core/reviews/paths.js";

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

describe("review reconcile anchors", () => {
  it("stores baselineAnchor on approval and pending job without eager diff file", async () => {
    await withTempProject(async (root) => {
      await initGitRepo(root);
      await setupReviewProject(root);

      const content = "# Chapter\nOriginal body";
      const docRel = "docs/srs/3-use-cases.md";
      const lp = "srs/3-use-cases";
      await writeFile(join(root, docRel), content, "utf8");
      await exec("git", ["add", "."], { cwd: root });
      await exec("git", ["commit", "-m", "init"], { cwd: root });

      const hash = contentHash(content);
      const approval = makeApproval(lp, hash, docRel);
      approval.internal = internalApprovedTrack("tester", "2026-06-11T00:00:00.000Z");
      approval.overallStatus = "pending_client";
      await writeSnapshot(root, lp, content);
      await saveApproval(root, approval);

      await writeFile(join(root, docRel), "# Chapter\nUpdated UC-12 logout", "utf8");

      const result = await reconcileReviews(root);
      expect(result.invalidated).toBe(1);

      const updated = await getApproval(root, lp);
      expect(updated?.baselineAnchor).toBeDefined();
      expect(updated?.baselineAnchor!.hash).toBe(hash);
      expect(updated?.baselineAnchor!.path).toBe(docRel);
      expect(updated?.baselineAnchor!.gitRef).toBeTruthy();

      const job = await findPendingJob(root, "internal", lp);
      expect(job?.baselineAnchor?.hash).toBe(hash);

      const diff = await loadDiff(root, "internal", lp);
      expect(diff).toBeNull();

      const paths = reviewQueuePaths(root);
      expect(await pathExists(changePath(paths, lp))).toBe(false);
    });
  });
});
