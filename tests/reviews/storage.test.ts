import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { withTempProject } from "../helpers/temp-project.js";
import { writeJson, pathExists } from "../../src/core/util/fs.js";
import { reviewQueuePaths } from "../../src/core/reviews/paths.js";
import {
  getApproval,
  saveApproval,
  makeApproval,
  addToQueue,
  loadQueueIndex,
  appendHistory,
  readHistory,
  writeSnapshot,
  readSnapshot,
} from "../../src/core/reviews/storage.js";
import {
  runApprove,
  runReviewStatus,
  runReviewList,
} from "../../src/core/operations/review.js";

async function setupProject(root: string): Promise<void> {
  await writeJson(join(root, ".ai-spector/docflow.config.json"), {
    version: 1,
    languages: [{ code: "en", label: "English" }],
    paths: {},
  });
  await mkdir(join(root, "docs/srs"), { recursive: true });
  await writeFile(join(root, "docs/srs/1-introduction.md"), "# Introduction\n\nContent.", "utf8");
}

describe.sequential("review queue storage", () => {
  it("stores approval in registry.json under review-queue", async () => {
    await withTempProject(async (root) => {
      const record = makeApproval("srs/1-introduction", "abc123");
      await saveApproval(root, record);

      const paths = reviewQueuePaths(root);
      expect(await pathExists(paths.registry)).toBe(true);
      expect(await pathExists(join(root, "reviews"))).toBe(false);

      const loaded = await getApproval(root, "srs/1-introduction");
      expect(loaded?.contentHash).toBe("abc123");
    });
  });

  it("stores unified pending jobs", async () => {
    await withTempProject(async (root) => {
      await addToQueue(root, "client", {
        logicalPath: "srs/1-introduction",
        queuedAt: "2026-06-11T00:00:00.000Z",
        reason: "awaiting_client_signoff",
        approvedHash: "abc123",
        currentHash: "abc123",
      });

      const pending = await loadQueueIndex(root, "client", "pending");
      expect(pending.entries).toHaveLength(1);
      expect(pending.entries[0]?.reason).toBe("awaiting_client_signoff");
    });
  });

  it("appends and reads global history", async () => {
    await withTempProject(async (root) => {
      await appendHistory(root, "srs/1-introduction", {
        event: "approved",
        track: "internal",
        at: "2026-06-11T16:44:16.110Z",
        by: "local",
        hash: "f20384467f1ae97a",
      });

      const history = await readHistory(root, "srs/1-introduction");
      expect(history).toHaveLength(1);
      expect(history[0]?.event).toBe("approved");
      expect(history[0]?.logicalPath).toBe("srs/1-introduction");
    });
  });

  it("writes snapshots under review-queue/snapshots", async () => {
    await withTempProject(async (root) => {
      const ref = await writeSnapshot(root, "srs/1-introduction", "# Snapshot");
      expect(ref).toContain(".ai-spector/.docflow/review-queue/snapshots/");
      expect(await readSnapshot(root, "srs/1-introduction")).toBe("# Snapshot");
    });
  });
});

describe.sequential("review operations", () => {
  it("approve writes to review-queue and returns history via status", async () => {
    await withTempProject(async (root) => {
      await setupProject(root);

      const approved = await runApprove({ root, logicalPath: "srs/1-introduction", by: "alice" });
      expect(approved.movedToClientQueue).toBe(true);

      const paths = reviewQueuePaths(root);
      expect(await pathExists(paths.registry)).toBe(true);
      expect(await pathExists(join(root, "reviews"))).toBe(false);

      const clientPending = await loadQueueIndex(root, "client", "pending");
      expect(clientPending.entries[0]?.reason).toBe("awaiting_client_signoff");

      const status = await runReviewStatus({
        root,
        logicalPath: "srs/1-introduction",
        includeHistory: true,
      });
      expect(status.approval.overallStatus).toBe("pending_client");
      expect(status.history).toHaveLength(1);
      expect(status.history?.[0]?.event).toBe("approved");
    });
  });

  it("list returns all documents with approval records", async () => {
    await withTempProject(async (root) => {
      await setupProject(root);
      await mkdir(join(root, "docs/srs"), { recursive: true });
      await writeFile(join(root, "docs/srs/2-overall-description.md"), "# Scope\n", "utf8");
      await runApprove({ root, logicalPath: "srs/2-overall-description", by: "alice" });

      const list = await runReviewList({ root, prefix: "srs/2-overall" });
      expect(list.total).toBe(1);
      expect(list.entries[0]?.logicalPath).toBe("srs/2-overall-description");
      expect(list.entries[0]?.overallStatus).toBe("pending_client");
    });
  });
});
