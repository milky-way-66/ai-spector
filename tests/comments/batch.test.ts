import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  buildPrototypeBatchGroups,
  resolveThreadPicks,
} from "@/core/comments/batch.js";
import {
  buildCommentFacets,
  parseScreenFromPhrase,
  threadMatchesFilters,
} from "@/core/comments/filters.js";
import { buildCommentInbox } from "@/core/comments/inbox.js";
import { buildCommentInboxPayload, buildCommentBatchPlanPayload } from "@/core/comments/plan.js";
import { listThreads } from "@/core/comments/storage.js";
import {
  runCommentsBatchResolve,
  runCommentsFacets,
} from "@/core/operations/comments.js";
import { writeJson } from "@/core/util/fs.js";
import { withTempProject } from "../helpers/temp-project.js";

const LOGIN_META = {
  threadId: "20260617T045148Z_cd826aab-0626-4c8a-8aa3-26535c7f78f4",
  filePath: "prototype/src/login.html",
  commentType: "prototype" as const,
  originBranch: "main",
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
    selector: "h1",
    textExcerpt: "Welcome",
    baseCommitSha: "abc",
    branchName: "main",
    filePath: "prototype/src/login.html",
    anchorState: "active" as const,
  },
};

const HOME_META = {
  ...LOGIN_META,
  threadId: "20260617T055148Z_cd826aab-0626-4c8a-8aa3-26535c7f78f5",
  filePath: "prototype/src/home.html",
  anchor: {
    ...LOGIN_META.anchor,
    url: "src/home.html",
    filePath: "prototype/src/home.html",
    selector: "h2",
  },
};

async function seedPrototypeThreads(root: string): Promise<void> {
  for (const meta of [LOGIN_META, HOME_META]) {
    const dir = join(root, ".docops/comments/prototype/src", meta.anchor.url.split("/").pop()!, meta.threadId);
    await mkdir(dir, { recursive: true });
    await writeJson(join(dir, "meta_data.json"), meta);
    await writeJson(join(dir, `${meta.threadId}-body`), {
      commentId: `${meta.threadId}-body`,
      threadId: meta.threadId,
      body: `Change ${meta.anchor.selector} on ${meta.anchor.url}`,
      authorId: 42,
      createdAt: "2026-06-17T04:51:48Z",
      parentCommentId: null,
      editedAt: null,
      deletedAt: null,
    });
  }
  await mkdir(join(root, "prototype/src"), { recursive: true });
  await writeFile(join(root, "prototype/src/login.html"), "<h1>Welcome</h1>");
  await writeFile(join(root, "prototype/src/home.html"), "<h2>Home</h2>");
}

describe("comment filters", () => {
  it("parses screen from phrase and matches filters", () => {
    expect(parseScreenFromPhrase("resolve all comments on login screen")).toBe("login");
    expect(parseScreenFromPhrase("login screen comments")).toBe("login");

    const login = { ...LOGIN_META, replyCount: 1, threadDir: "x", docPath: "prototype/src/login.html" };
    expect(threadMatchesFilters(login, { screen: "login", status: "open" })).toBe(true);
    expect(threadMatchesFilters(login, { screen: "home", status: "open" })).toBe(false);
    expect(threadMatchesFilters(login, { pathPrefix: "prototype/src/", status: "open" })).toBe(true);
  });
});

describe("prototype batch inbox and plan", () => {
  it("groups screens and builds cross-screen batch plan", async () => {
    await withTempProject(async (root) => {
      await seedPrototypeThreads(root);

      const loginOnly = await listThreads({
        projectRoot: root,
        filters: { screen: "login", commentTypes: ["prototype"], status: "open" },
      });
      expect(loginOnly).toHaveLength(1);

      const inbox = await buildCommentInboxPayload({
        projectRoot: root,
        filters: { commentTypes: ["prototype"], status: "open" },
        groupByScreen: true,
      });
      expect(inbox.batches).toHaveLength(2);
      expect(inbox.batches?.[0]?.batchId).toBe("B-001");
      expect(inbox.idePresentation.mode).toBe("prototype_batch_pick_list");

      const screenPlan = await buildCommentBatchPlanPayload({
        projectRoot: root,
        batchId: "B-001",
        filters: { commentTypes: ["prototype"], status: "open" },
      });
      expect(screenPlan.scope.mode).toBe("screen");
      expect(screenPlan.threads).toHaveLength(1);
      expect(screenPlan.workflow.phases).toContain("wait_explicit_yes");

      const crossPlan = await buildCommentBatchPlanPayload({
        projectRoot: root,
        picks: ["B-001", "B-002"],
        filters: { commentTypes: ["prototype"], status: "open" },
      });
      expect(crossPlan.scope.mode).toBe("cross_screen");
      expect(crossPlan.threads).toHaveLength(2);
      expect(crossPlan.targets).toHaveLength(2);
    });
  });

  it("batch-resolves multiple picks", async () => {
    await withTempProject(async (root) => {
      await seedPrototypeThreads(root);

      const result = await runCommentsBatchResolve({
        root,
        picks: ["B-001", "B-002"],
        dryRun: true,
      });
      expect(result.count).toBe(2);
      expect(result.dryRun).toBe(true);
    });
  });

  it("facets lists screens", async () => {
    await withTempProject(async (root) => {
      await seedPrototypeThreads(root);
      const threads = await listThreads({
        projectRoot: root,
        filters: { status: "all" },
      });
      const facets = buildCommentFacets(threads);
      expect(facets.screens.map((s) => s.value).sort()).toEqual(["home", "login"]);

      const viaOp = await runCommentsFacets({ root });
      expect(viaOp.facets.screens.length).toBeGreaterThanOrEqual(2);
    });
  });
});

describe("batch pick resolution", () => {
  it("resolves B-001 to all screen threads", () => {
    const inbox = buildCommentInbox(
      [
        { ...LOGIN_META, replyCount: 1, threadDir: "x", docPath: "prototype/src/login.html" },
        {
          ...HOME_META,
          threadId: "t2",
          replyCount: 1,
          threadDir: "y",
          docPath: "prototype/src/home.html",
          anchor: { ...HOME_META.anchor, url: "src/home.html" },
        },
      ],
      { groupByScreen: true },
    );
    const batches = buildPrototypeBatchGroups(inbox.inbox);
    inbox.batches = batches;
    const loginBatch = batches.find((b) => b.screenStem === "login");
    expect(loginBatch?.batchId).toBeDefined();
    const picked = resolveThreadPicks(inbox, [loginBatch!.batchId]);
    expect(picked).toHaveLength(1);
    expect(picked[0]?.filePath).toContain("login");
  });
});
