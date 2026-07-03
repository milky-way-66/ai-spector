import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { writeJson } from "@/core/util/fs.js";
import { assessDocopsProject } from "@/core/docops/assess.js";
import {
  bootstrapEntityRegistry,
  isLegacyPathKeyedProject,
} from "@/core/docops/entity-keying.js";
import { DEFAULT_DOCOPS_PATHS } from "@/core/docops/paths.js";
import { listDocumentEntities } from "@/core/docops/registry/load.js";
import { loadRegistry } from "@/core/reviews/storage.js";
import { withTempDir } from "../helpers/temp-project.js";

async function writeMinimalDocops(root: string): Promise<void> {
  await writeJson(join(root, ".docops/docops.config.json"), {
    schemaVersion: "1.0",
    docsRoot: "docs",
    languages: [{ code: "en", label: "English", path: "en" }],
    primaryLanguage: "en",
    docTypes: {
      srs: {
        enabled: true,
        path: "docs/srs",
        label: "SRS",
        templatesPath: ".docops/templates/srs",
      },
    },
    paths: { ...DEFAULT_DOCOPS_PATHS },
    capabilities: { review: true, comments: true, prototype: false },
  });
  await writeJson(join(root, ".docops/review.config.json"), {
    schemaVersion: "1.0",
    extends: "kaopiz-default",
  });
  await writeJson(join(root, ".docops/review-queue/registry.json"), {
    version: 4,
    documents: {},
  });
  await mkdir(join(root, ".docops/templates/srs"), { recursive: true });
  await writeFile(join(root, ".docops/templates/srs/01.md"), "# x");
  await mkdir(join(root, ".docops/comments"), { recursive: true });
}

describe("entity-keying", () => {
  it("detects legacy v3 review registry keys", async () => {
    await withTempDir(async (root) => {
      await writeMinimalDocops(root);
      await writeJson(join(root, ".docops/review-queue/registry.json"), {
        version: 3,
        documents: {
          "srs/01-overview": {
            version: 3,
            logicalPath: "srs/01-overview",
            contentHash: "abc",
            overallStatus: "pending_internal",
            internal: { status: "pending", votes: [] },
            client: { status: "pending", votes: [] },
          },
        },
      });
      expect(await isLegacyPathKeyedProject(root)).toBe(true);
    });
  });

  it("bootstrapEntityRegistry syncs docs and keeps v4 review registry", async () => {
    await withTempDir(async (root) => {
      await writeMinimalDocops(root);
      await mkdir(join(root, "docs/srs/en"), { recursive: true });
      await writeFile(join(root, "docs/srs/en/01-overview.md"), "# Overview\n");

      const result = await bootstrapEntityRegistry(root);
      expect(result.skipped).toBe(false);
      expect(result.reviewRegistryV4).toBe(true);

      const { loadOrDeriveDocopsConfig } = await import("@/core/docops/config.js");
      const config = await loadOrDeriveDocopsConfig(root);
      const listed = await listDocumentEntities(root, config);
      expect(listed).toHaveLength(1);

      const review = await loadRegistry(root);
      expect(review.version).toBe(4);
    });
  });
});

describe("assessDocopsProject entity registry", () => {
  it("flags stale entity registry when docs exist but registry is empty", async () => {
    await withTempDir(async (root) => {
      await writeMinimalDocops(root);
      await mkdir(join(root, "docs/srs/en"), { recursive: true });
      await writeFile(join(root, "docs/srs/en/01-overview.md"), "# x\n");

      const a = await assessDocopsProject(root);
      expect(a.entityRegistry?.keying).toBe("entityId");
      expect(a.entityRegistry?.synced).toBe(false);
      expect(a.gaps.some((g) => g.id === "DOCOPS-REG-001")).toBe(true);
    });
  });
});
