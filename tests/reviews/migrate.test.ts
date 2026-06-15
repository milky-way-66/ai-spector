import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { withTempProject } from "../helpers/temp-project.js";
import { writeJson, pathExists } from "@/core/util/fs.js";
import { reviewQueuePaths } from "@/core/reviews/paths.js";
import { migrateLegacyReviews } from "@/core/reviews/migrate.js";
import { getApproval, loadQueueIndex, readHistory } from "@/core/reviews/storage.js";

const SAMPLE_APPROVAL = {
  version: 1,
  logicalPath: "srs/1-introduction",
  contentHash: "f20384467f1ae97a",
  overallStatus: "pending_client",
  internal: {
    status: "approved",
    approvedAt: "2026-06-11T16:44:16.110Z",
    approvedBy: "local",
    invalidatedAt: null,
  },
  client: { status: "pending", approvedAt: null, comment: null },
};

describe("migrateLegacyReviews", () => {
  it("migrates legacy reviews/ tree to review-queue", async () => {
    await withTempProject(async (root) => {
      // Seed legacy layout
      const legacyDir = join(root, "reviews/srs/1-introduction");
      await mkdir(legacyDir, { recursive: true });
      await writeJson(join(legacyDir, "approval.json"), SAMPLE_APPROVAL);
      await writeFile(join(legacyDir, "approval_snapshot.md"), "# Legacy snapshot", "utf8");
      await writeFile(
        join(legacyDir, "approval_history.jsonl"),
        `${JSON.stringify({ event: "approved", track: "internal", at: "2026-06-11T16:44:16.110Z", by: "local", hash: "f20384467f1ae97a" })}\n`,
        "utf8",
      );

      await mkdir(join(root, "reviews/client_queue"), { recursive: true });
      await writeJson(join(root, "reviews/client_queue/pending.json"), {
        version: 1,
        entries: [
          {
            logicalPath: "srs/1-introduction",
            queuedAt: "2026-06-11T16:44:16.110Z",
            reason: "content_changed",
            approvedHash: null,
            currentHash: "f20384467f1ae97a",
          },
        ],
      });

      const result = await migrateLegacyReviews(root);
      expect(result.migrated).toBe(true);
      expect(result.documents).toBe(1);

      const paths = reviewQueuePaths(root);
      expect(await pathExists(paths.registry)).toBe(true);
      expect(await pathExists(paths.pending)).toBe(true);

      const approval = await getApproval(root, "srs/1-introduction");
      expect(approval?.overallStatus).toBe("pending_client");
      expect(approval?.internal.votes).toHaveLength(1);
      expect(approval?.internal.votes[0]?.by).toBe("local");
      expect(approval?.snapshotRef).toContain("review-queue/snapshots/");

      const clientPending = await loadQueueIndex(root, "client", "pending");
      expect(clientPending.entries[0]?.reason).toBe("awaiting_client_signoff");

      const history = await readHistory(root, "srs/1-introduction");
      expect(history).toHaveLength(1);
    });
  });

  it("is idempotent when review-queue already exists", async () => {
    await withTempProject(async (root) => {
      const paths = reviewQueuePaths(root);
      await mkdir(paths.dir, { recursive: true });
      await writeJson(paths.registry, { version: 2, documents: {} });

      const result = await migrateLegacyReviews(root);
      expect(result.migrated).toBe(false);
    });
  });
});
