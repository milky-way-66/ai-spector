import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { withTempProject } from "../helpers/temp-project.js";
import { writeJson } from "@/core/util/fs.js";
import { reviewQueuePaths } from "@/core/reviews/paths.js";
import {
  getApproval,
  loadRegistry,
  saveApproval,
  makeApproval,
} from "@/core/reviews/storage.js";
import {
  runApprove,
  runReviewStatus,
  runReviewSessionAckReview,
} from "@/core/operations/review.js";
import { contentHash } from "@/core/reviews/staleness.js";
import { normalizeInternalTrack } from "@/core/reviews/normalize.js";

const LEGACY_APPROVED_INTERNAL = {
  status: "approved",
  approvedAt: "2026-06-15T11:19:06.955Z",
  approvedBy: "long.contact@icloud.com",
  invalidatedAt: null,
};

async function setupProject(root: string): Promise<void> {
  await writeJson(join(root, ".ai-spector/docflow.config.json"), {
    version: 1,
    languages: [{ code: "en", label: "English" }],
    paths: {},
  });
  await mkdir(join(root, "docs/srs"), { recursive: true });
  await mkdir(join(root, ".ai-spector/.docflow/review-queue/snapshots"), { recursive: true });
}

describe("normalizeInternalTrack", () => {
  it("converts legacy approvedBy to votes array", () => {
    const track = normalizeInternalTrack(LEGACY_APPROVED_INTERNAL);
    expect(track.votes).toHaveLength(1);
    expect(track.votes[0]?.by).toBe("long.contact@icloud.com");
    expect(track.votes[0]?.decision).toBe("approve");
    expect(track.quorumMetAt).toBe("2026-06-15T11:19:06.955Z");
    expect(track.closedAt).toBe("2026-06-15T11:19:06.955Z");
    expect(track.closedBy).toBe("long.contact@icloud.com");
    expect(track).not.toHaveProperty("approvedBy");
  });
});

describe("registry vote retention", () => {
  it("migrates legacy approvedBy in registry.json on load", async () => {
    await withTempProject(async (root) => {
      const paths = reviewQueuePaths(root);
      await mkdir(paths.dir, { recursive: true });
      await writeJson(paths.registry, {
        version: 3,
        documents: {
          "srs/1-introduction": {
            version: 3,
            logicalPath: "srs/1-introduction",
            contentHash: "abc123",
            overallStatus: "pending_client",
            internal: LEGACY_APPROVED_INTERNAL,
            client: {
              status: "pending",
              votes: [],
              quorumMetAt: null,
              closedAt: null,
              closedBy: null,
            },
          },
        },
      });

      const approval = await getApproval(root, "srs/1-introduction");
      expect(approval?.internal.votes).toHaveLength(1);
      expect(approval?.internal.votes[0]?.by).toBe("long.contact@icloud.com");

      const raw = JSON.parse(await readFile(paths.registry, "utf8"));
      const internal = raw.documents["srs/1-introduction"].internal;
      expect(internal.votes).toHaveLength(1);
      expect(internal).not.toHaveProperty("approvedBy");
      expect(internal).not.toHaveProperty("approvedAt");
    });
  });

  it("retains votes[] on internal track after quorum is met", async () => {
    await withTempProject(async (root) => {
      await setupProject(root);
      const content = "# Introduction\n\nContent.";
      const docRel = "docs/srs/1-introduction.md";
      const lp = "srs/1-introduction";
      await writeFile(join(root, docRel), content, "utf8");
      const hash = contentHash(content);
      await saveApproval(root, makeApproval(lp, hash, docRel));

      await runReviewStatus({ root, logicalPath: lp, showDiff: false });
      await runReviewSessionAckReview({ root, logicalPath: lp });
      await runApprove({
        root,
        logicalPath: lp,
        by: "long.contact@icloud.com",
        note: "Approve with note — add ops/SRE to audience",
      });

      const approval = await getApproval(root, lp);
      expect(approval?.internal.status).toBe("approved");
      expect(approval?.internal.votes).toHaveLength(1);
      expect(approval?.internal.votes[0]?.note).toBe("Approve with note — add ops/SRE to audience");
      expect(approval?.internal.quorumMetAt).toBeTruthy();
      expect(approval?.internal.closedAt).toBeTruthy();
      expect(approval?.internal.closedBy).toBe("long.contact@icloud.com");

      const paths = reviewQueuePaths(root);
      const raw = JSON.parse(await readFile(paths.registry, "utf8"));
      const internal = raw.documents[lp].internal;
      expect(internal.votes).toHaveLength(1);
      expect(internal).not.toHaveProperty("approvedBy");

      const status = await runReviewStatus({ root, logicalPath: lp, showDiff: false });
      expect(status.internalQuorum.met).toBe(true);
      expect(status.internalQuorum.approveCount).toBe(1);
      expect(status.approval.internal.votes).toHaveLength(1);
    });
  });

  it("shows partial votes before quorum without collapsing shape", async () => {
    await withTempProject(async (root) => {
      await setupProject(root);
      const content = "# Use cases\n";
      const docRel = "docs/srs/3-use-cases.md";
      const lp = "srs/3-use-cases";
      await writeFile(join(root, docRel), content, "utf8");
      const hash = contentHash(content);
      const approval = makeApproval(lp, hash, docRel);
      approval.internal.votes = [
        {
          by: "alice@example.com",
          role: "user",
          decision: "approve",
          at: "2026-06-15T10:00:00.000Z",
          note: "LGTM",
        },
        {
          by: "bob@example.com",
          role: "user",
          decision: "decline",
          at: "2026-06-15T10:05:00.000Z",
          note: "needs detail",
        },
      ];
      await saveApproval(root, approval);

      const loaded = await getApproval(root, lp);
      expect(loaded?.internal.status).toBe("pending");
      expect(loaded?.internal.votes).toHaveLength(2);
      expect(loaded?.internal.quorumMetAt).toBeNull();
      expect(loaded?.internal.closedAt).toBeNull();

      const registry = await loadRegistry(root);
      const internal = registry.documents[lp]?.internal;
      expect(internal?.votes).toHaveLength(2);
      expect(internal).not.toHaveProperty("approvedBy");
    });
  });
});
