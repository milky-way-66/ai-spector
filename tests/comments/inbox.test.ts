import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { readDocAnchorContext } from "../../src/core/comments/anchor.js";
import { buildCommentInbox, formatInboxForChat } from "../../src/core/comments/inbox.js";
import {
  buildCommentInboxPayload,
  resolvePickId,
} from "../../src/core/comments/plan.js";
import { writeJson } from "../../src/core/util/fs.js";
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
    startLine: 3,
    endLine: 4,
    lineExcerpt: "The system shall provide authentication.",
    anchorState: "active" as const,
  },
};

async function seedThread(root: string): Promise<void> {
  const threadId = SAMPLE_META.threadId;
  const dir = join(root, "comments/srs/01-overview", threadId);
  await mkdir(dir, { recursive: true });
  await writeJson(join(dir, "meta_data.json"), SAMPLE_META);
  await writeJson(join(dir, "20260530T143045Z_e5f67890-abcd-ef12-3456-7890abcdef12"), {
    commentId: "20260530T143045Z_e5f67890-abcd-ef12-3456-7890abcdef12",
    threadId,
    body: "Please clarify authentication scope for external users.",
    authorId: 42,
    createdAt: "2026-05-30T14:30:45Z",
    parentCommentId: null,
    editedAt: null,
    deletedAt: null,
  });
  await mkdir(join(root, "docs/srs"), { recursive: true });
  await writeFile(
    join(root, "docs/srs/01-overview.md"),
    `# Overview\n<!-- section:sec.srs.overview -->\n## Introduction\nThe system shall provide authentication.\nMore text here.\n`,
  );
}

describe("comment inbox (IDE)", () => {
  it("builds numbered pick ids and resolves selection", async () => {
    await withTempProject(async (root) => {
      await seedThread(root);
      const inbox = await buildCommentInboxPayload({ projectRoot: root, status: "open" });
      expect(inbox.inbox).toHaveLength(1);
      expect(inbox.inbox[0]?.pickId).toBe("C-001");
      expect(inbox.inbox[0]?.preview).toContain("authentication scope");
      expect(inbox.idePresentation.mode).toBe("thread_pick_list");
      expect(inbox.idePresentation.markdown).toContain("C-001");
      expect(inbox.idePresentation.markdown).toContain("| Pick |");
      expect(inbox.idePresentation.rules.length).toBeGreaterThan(0);

      const chat = formatInboxForChat(inbox);
      expect(chat).toContain("C-001");
      expect(chat).not.toContain(SAMPLE_META.threadId);

      const picked = resolvePickId(inbox, "C-001");
      expect(picked?.threadId).toBe(SAMPLE_META.threadId);
    });
  });

  it("reads anchor context from doc lines", async () => {
    await withTempProject(async (root) => {
      await seedThread(root);
      const ctx = await readDocAnchorContext(root, "srs/01-overview", 3, 4);
      expect(ctx?.docPath).toBe("docs/srs/01-overview.md");
      expect(ctx?.anchoredText).toContain("authentication");
      expect(ctx?.heading).toBe("Introduction");
      expect(ctx?.sectionAnchor).toBe("sec.srs.overview");
    });
  });

  it("buildCommentInbox assigns sequential pick ids", () => {
    const inbox = buildCommentInbox([
      {
        ...SAMPLE_META,
        replyCount: 1,
        threadDir: "comments/srs/01-overview/x",
        docPath: "docs/srs/01-overview.md",
      },
    ]);
    expect(inbox.inbox[0]?.pickId).toBe("C-001");
    expect(inbox.idePresentation.markdown).toContain("C-001");
  });
});
