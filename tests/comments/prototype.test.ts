import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { readPrototypeAnchorContext } from "@/core/comments/anchor.js";
import { buildCommentInbox, formatInboxForChat } from "@/core/comments/inbox.js";
import {
  logicalPathToPrototypePath,
  matchesFilePathFilter,
  normalizeLogicalPath,
  screenStemFromPrototypeUrl,
} from "@/core/comments/paths.js";
import {
  buildCommentInboxPayload,
  buildCommentPlan,
  resolvePickId,
} from "@/core/comments/plan.js";
import {
  findThreadById,
  getThread,
  listThreads,
  resolveThread,
} from "@/core/comments/storage.js";
import { writeJson } from "@/core/util/fs.js";
import { withTempProject } from "../helpers/temp-project.js";

const PROTO_META = {
  threadId: "20260617T045148Z_cd826aab-0626-4c8a-8aa3-26535c7f78f4",
  filePath: "prototype/src/login.html",
  commentType: "prototype" as const,
  originBranch: "release/3.2",
  status: "open" as const,
  version: 1,
  createdAt: "2026-06-17T04:51:48Z",
  updatedAt: "2026-06-17T04:51:48Z",
  createdBy: 42,
  resolvedAt: null,
  resolvedBy: null,
  resolvedInCommitSha: null,
  anchor: {
    url: "src/login.html",
    selector: "html>body>main.card>h1",
    textExcerpt: "Prototype Engine",
    tagName: "h1",
    baseCommitSha: "0bc787f7f9576bffd5780dd4977a608e73cc15a6",
    branchName: "release/3.2",
    filePath: "prototype/src/login.html",
    anchorState: "active" as const,
  },
};

async function seedPrototypeThread(root: string): Promise<void> {
  const threadId = PROTO_META.threadId;
  const dir = join(root, ".docops/comments/prototype/src/login.html", threadId);
  await mkdir(dir, { recursive: true });
  await writeJson(join(dir, "meta_data.json"), PROTO_META);
  await writeJson(join(dir, "20260617T045148Z_a1b2c3d4-0626-4c8a-8aa3-26535c7f78f4"), {
    commentId: "20260617T045148Z_a1b2c3d4-0626-4c8a-8aa3-26535c7f78f4",
    threadId,
    body: "Make the heading larger and use brand color.",
    authorId: 42,
    createdAt: "2026-06-17T04:51:48Z",
    parentCommentId: null,
    editedAt: null,
    deletedAt: null,
  });
  await mkdir(join(root, "prototype/src"), { recursive: true });
  await writeFile(
    join(root, "prototype/src/login.html"),
    `<!DOCTYPE html><html><body><main class="card"><h1>Prototype Engine</h1></main></body></html>`,
  );
}

describe("prototype comment paths", () => {
  it("maps prototype logical paths and screen stems", () => {
    expect(logicalPathToPrototypePath("prototype/src/login.html")).toBe("prototype/src/login.html");
    expect(logicalPathToPrototypePath("srs/01-overview")).toBeNull();
    expect(screenStemFromPrototypeUrl("src/login.html")).toBe("login");
    expect(screenStemFromPrototypeUrl("index.html")).toBe("index");
    expect(matchesFilePathFilter("prototype/src/login.html", "prototype")).toBe(true);
    expect(matchesFilePathFilter("srs/01-overview", "prototype")).toBe(false);
    expect(normalizeLogicalPath("prototype/src/login.html")).toBe("prototype/src/login.html");
  });
});

describe("prototype comment storage", () => {
  it("lists, plans, and resolves prototype threads", async () => {
    await withTempProject(async (root) => {
      await seedPrototypeThread(root);

      const allProto = await listThreads({
        projectRoot: root,
        filePath: "prototype",
        commentTypes: ["prototype"],
        status: "open",
      });
      expect(allProto).toHaveLength(1);
      expect(allProto[0]?.docPath).toBe("prototype/src/login.html");
      expect(allProto[0]?.commentType).toBe("prototype");

      const docsOnly = await listThreads({
        projectRoot: root,
        commentTypes: ["document"],
        status: "open",
      });
      expect(docsOnly).toHaveLength(0);

      const detail = await findThreadById(root, PROTO_META.threadId);
      expect(detail?.comments[0]?.body).toContain("heading larger");

      const ctx = await readPrototypeAnchorContext(root, PROTO_META.filePath, PROTO_META.anchor);
      expect(ctx?.prototypePath).toBe("prototype/src/login.html");
      expect(ctx?.htmlPreview).toContain("Prototype Engine");

      const inbox = await buildCommentInboxPayload({
        projectRoot: root,
        filePath: "prototype",
        commentTypes: ["prototype"],
        status: "open",
      });
      expect(inbox.inbox[0]?.pickId).toBe("C-001");
      expect(inbox.inbox[0]?.commentType).toBe("prototype");
      expect(inbox.idePresentation.markdown).toContain("prototype");
      expect(inbox.idePresentation.markdown).toContain("login.html");

      const picked = resolvePickId(inbox, "C-001");
      expect(picked?.filePath).toBe("prototype/src/login.html");

      const plan = await buildCommentPlan({
        projectRoot: root,
        graphPath: join(root, ".ai-spector/traceability/graph.json"),
        rulesPath: join(root, ".ai-spector/traceability/impact-rules.json"),
        threadId: PROTO_META.threadId,
        filePath: "prototype/src/login.html",
        pickId: "C-001",
      });
      expect(plan.workflow.phases).toContain("apply_edit_to_prototype_html");
      expect(plan.workflow.suggestEdit.instruction).toContain("src/login.html");

      const resolved = await resolveThread({
        projectRoot: root,
        logicalPath: "prototype/src/login.html",
        threadId: PROTO_META.threadId,
        resolvedBy: "engineer",
        resolvedInCommitSha: "cafebabe",
      });
      expect(resolved.thread.status).toBe("resolved");
      expect(resolved.commitMessageSuggestion).toContain("prototype comment");

      const after = await getThread(root, "prototype/src/login.html", PROTO_META.threadId);
      expect(after?.status).toBe("resolved");
    });
  });

  it("buildCommentInbox renders prototype rows", () => {
    const inbox = buildCommentInbox([
      {
        ...PROTO_META,
        replyCount: 1,
        threadDir: "comments/prototype/src/login.html/x",
        docPath: "prototype/src/login.html",
      },
    ]);
    expect(inbox.inbox[0]?.location).toContain("html>body");
    expect(formatInboxForChat(inbox)).toContain("C-001");
  });
});
