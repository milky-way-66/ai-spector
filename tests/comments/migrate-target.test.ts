import { describe, expect, it } from "vitest";
import { join } from "node:path";
import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { migrateCommentsToTargetIds } from "@/core/comments/migrate.js";
import {
  documentLocation,
  parseCommentStoragePath,
  screenLocation,
} from "@/core/comments/target-paths.js";
import { listThreads } from "@/core/comments/storage.js";
import { syncDocopsRegistry } from "@/core/docops/registry/sync.js";
import { DEFAULT_DOCOPS_PATHS } from "@/core/docops/paths.js";
import type { DocopsConfig } from "@/core/docops/types.js";

function baseConfig(): DocopsConfig {
  return {
    schemaVersion: "1.0",
    docsRoot: "docs",
    languages: [{ code: "en", label: "English" }],
    primaryLanguage: "en",
    paths: { ...DEFAULT_DOCOPS_PATHS },
    capabilities: {
      review: true,
      comments: true,
      prototype: true,
      graph: false,
      generate: false,
      translate: false,
    },
    docTypes: {
      srs: { enabled: true, path: "docs/srs", label: "SRS" },
    },
  };
}

describe("parseCommentStoragePath", () => {
  it("parses document and screen layouts", () => {
    const docId = "a1b2c3d4-e5f6-4123-abcd-ef1234567890";
    expect(parseCommentStoragePath(`documents/${docId}`)?.kind).toBe("document");
    expect(parseCommentStoragePath("screens/SCR-001")?.kind).toBe("prototype_screen");
    expect(parseCommentStoragePath("srs/foo.md")?.kind).toBe("legacy");
  });
});

describe("migrateCommentsToTargetIds", () => {
  it("moves legacy document threads to documents/{entityId}", async () => {
    const root = await mkdtemp(join(tmpdir(), "comments-migrate-"));
    const config = baseConfig();
    await mkdir(join(root, ".docops"), { recursive: true });
    await writeFile(
      join(root, ".docops/docops.config.json"),
      JSON.stringify(config, null, 2),
      "utf8",
    );
    await mkdir(join(root, "docs/srs"), { recursive: true });
    await writeFile(join(root, "docs/srs/intro.md"), "# Intro\n", "utf8");
    await syncDocopsRegistry({ projectRoot: root });

    const index = await syncDocopsRegistry({ projectRoot: root });
    void index;

    const registry = await import("@/core/docops/registry/load.js").then((m) =>
      m.loadRegistryIndex(root, config),
    );
    const entityId = registry.documents[0]!.entityId;

    const threadId = "20260626T120000Z_test-thread";
    const legacyDir = join(root, ".docops/comments/srs/intro.md", threadId);
    await mkdir(legacyDir, { recursive: true });
    await writeFile(
      join(legacyDir, "meta_data.json"),
      JSON.stringify(
        {
          threadId,
          filePath: "srs/intro.md",
          commentType: "document",
          originBranch: "main",
          status: "open",
          version: 1,
          createdAt: "2026-06-26T12:00:00Z",
          updatedAt: "2026-06-26T12:00:00Z",
          createdBy: 1,
          resolvedAt: null,
          resolvedBy: null,
          resolvedInCommitSha: null,
          anchor: {
            branchName: "main",
            baseCommitSha: "abc",
            filePath: "srs/intro.md",
            language: "en",
            startLine: 1,
            endLine: 1,
          },
        },
        null,
        2,
      ),
      "utf8",
    );
    await writeFile(
      join(legacyDir, "20260626T120001Z_comment"),
      JSON.stringify(
        {
          commentId: "20260626T120001Z_comment",
          threadId,
          body: "note",
          authorId: 1,
          createdAt: "2026-06-26T12:00:01Z",
          parentCommentId: null,
          editedAt: null,
          deletedAt: null,
        },
        null,
        2,
      ),
      "utf8",
    );

    const result = await migrateCommentsToTargetIds({ projectRoot: root });
    expect(result.moved).toBe(1);

    const threads = await listThreads({
      projectRoot: root,
      filters: { entityId, status: "all" },
    });
    expect(threads).toHaveLength(1);
    expect(threads[0]!.targetId).toBe(entityId);
    expect(threads[0]!.threadDir).toContain(`documents/${entityId}`);
  });
});

describe("comment target locations", () => {
  it("builds expected storage paths", () => {
    const docId = "a1b2c3d4-e5f6-4123-abcd-ef1234567890";
    expect(documentLocation(docId).storagePath).toBe(`documents/${docId}`);
    expect(screenLocation("SCR-001").storagePath).toBe("screens/SCR-001");
  });
});
