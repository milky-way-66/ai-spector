import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  logicalPathToDocPath,
  normalizeLogicalPath,
  threadMetaRel,
} from "@/core/comments/paths.js";
import {
  findThreadById,
  getThread,
  listThreads,
  resolveThread,
} from "@/core/comments/storage.js";
import { writeJson } from "@/core/util/fs.js";
import { withTempProject } from "../helpers/temp-project.js";

const SAMPLE_META = {
  threadId: "20260530T143022Z_a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  filePath: "srs/01-overview",
  originBranch: "main",
  status: "open" as const,
  version: 1,
  createdAt: "2026-05-30T14:30:22Z",
  updatedAt: "2026-05-30T14:30:22Z",
  createdBy: 42,
  resolvedAt: null,
  resolvedBy: null,
  resolvedInCommitSha: null,
  anchor: {
    branchName: "main",
    baseCommitSha: "abc123def456",
    filePath: "srs/01-overview",
    language: "EN",
    startLine: 12,
    endLine: 14,
    lineExcerpt: "The system shall provide authentication.",
    anchorState: "active" as const,
  },
};

async function seedThread(root: string): Promise<void> {
  const threadId = SAMPLE_META.threadId;
  const dir = join(root, ".docops/comments/srs/01-overview", threadId);
  await mkdir(dir, { recursive: true });
  await writeJson(join(dir, "meta_data.json"), SAMPLE_META);
  await writeJson(join(dir, "20260530T143045Z_e5f67890-abcd-ef12-3456-7890abcdef12"), {
    commentId: "20260530T143045Z_e5f67890-abcd-ef12-3456-7890abcdef12",
    threadId,
    body: "Please clarify this requirement.",
    authorId: 42,
    createdAt: "2026-05-30T14:30:45Z",
    parentCommentId: null,
    editedAt: null,
    deletedAt: null,
  });
  await writeFile(
    join(dir, "events.jsonl"),
    `${JSON.stringify({ at: "2026-05-30T14:30:22Z", type: "thread_created", by: 42 })}\n`,
  );
}

describe("comment paths", () => {
  it("normalizes logical paths", () => {
    expect(normalizeLogicalPath(" docs/srs/foo.md ")).toBe("srs/foo");
    expect(normalizeLogicalPath("srs/01-overview")).toBe("srs/01-overview");
  });

  it("maps logical paths to doc files", () => {
    expect(logicalPathToDocPath("srs/01-overview")).toBe("docs/srs/01-overview.md");
    expect(logicalPathToDocPath("basic-design/list-api")).toBe(
      "docs/basic-design/list-api.md",
    );
    expect(logicalPathToDocPath("prototype/src/login.html")).toBeNull();
  });
});

describe("comment storage", () => {
  it("lists open threads and resolves locally", async () => {
    await withTempProject(async (root) => {
      await seedThread(root);

      const open = await listThreads({ projectRoot: root, status: "open" });
      expect(open).toHaveLength(1);
      expect(open[0]?.docPath).toBe("docs/srs/01-overview.md");
      expect(open[0]?.replyCount).toBe(1);

      const detail = await findThreadById(root, SAMPLE_META.threadId);
      expect(detail?.comments).toHaveLength(1);
      expect(detail?.events).toHaveLength(1);

      const resolved = await resolveThread({
        projectRoot: root,
        logicalPath: "srs/01-overview",
        threadId: SAMPLE_META.threadId,
        resolvedBy: "brse",
        resolvedInCommitSha: "deadbeef",
      });

      expect(resolved.thread.status).toBe("resolved");
      expect(resolved.commitMessageSuggestion).toContain(SAMPLE_META.threadId);

      const after = await getThread(root, "srs/01-overview", SAMPLE_META.threadId);
      expect(after?.status).toBe("resolved");
      expect(after?.resolvedBy).toBe("brse");
      expect(after?.resolvedByUsername).toBe("unknown");
      expect(after?.resolvedByRole).toBe("user");
      expect(after?.resolvedInCommitSha).toBe("deadbeef");
      expect(after?.events.some((e) => e.type === "resolved")).toBe(true);

      const openAfter = await listThreads({ projectRoot: root, status: "open" });
      expect(openAfter).toHaveLength(0);

      const metaPath = join(root, threadMetaRel("srs/01-overview", SAMPLE_META.threadId));
      const raw = await import("@/core/util/fs.js").then((m) =>
        m.readJson<{ version: number }>(metaPath),
      );
      expect(raw.version).toBe(2);
    });
  });

  it("rejects stale version on resolve", async () => {
    await withTempProject(async (root) => {
      await seedThread(root);
      await expect(
        resolveThread({
          projectRoot: root,
          logicalPath: "srs/01-overview",
          threadId: SAMPLE_META.threadId,
          expectedVersion: 99,
        }),
      ).rejects.toThrow(/Stale thread version/);
    });
  });
});
