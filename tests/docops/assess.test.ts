import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { writeJson } from "@/core/util/fs.js";
import { assessDocopsProject } from "@/core/docops/assess.js";
import { withTempDir } from "../helpers/temp-project.js";

async function writeLegacyFixture(root: string): Promise<void> {
  await writeJson(join(root, ".ai-spector/docflow.config.json"), {
    version: 1,
    languages: [{ code: "en", label: "English" }],
    packs: { srs: "builtin", basicDesign: "builtin" },
  });
}

describe("assessDocopsProject", () => {
  it("layout none on empty repo", async () => {
    await withTempDir(async (root) => {
      const a = await assessDocopsProject(root);
      expect(a.layout).toBe("none");
      expect(a.recommendedAction).toBe("init");
      expect(a.writerReady).toBe(false);
    });
  });

  it("layout legacy when only docflow exists", async () => {
    await withTempDir(async (root) => {
      await writeLegacyFixture(root);
      const a = await assessDocopsProject(root);
      expect(a.layout).toBe("legacy");
      expect(a.recommendedAction).toBe("migrate");
    });
  });

  it("flags short docTypes paths as blocking gaps", async () => {
    await withTempDir(async (root) => {
      await writeJson(join(root, ".docops/docops.config.json"), {
        schemaVersion: "1.0",
        docsRoot: "docs",
        languages: [{ code: "en", label: "English", path: "en" }],
        primaryLanguage: "en",
        docTypes: {
          srs: {
            enabled: true,
            path: "srs",
            label: "SRS",
            templatesPath: ".docops/templates/srs",
          },
        },
        paths: {
          comments: ".docops/comments",
          reviewConfig: ".docops/review.config.json",
          reviewQueue: ".docops/review-queue",
          prototypeConfig: ".docops/prototype/config.json",
          prototypeScreenMap: ".docops/prototype/screen-map.json",
        },
        capabilities: { review: true, comments: true, prototype: false },
      });
      await writeJson(join(root, ".docops/review.config.json"), {
        schemaVersion: "1.0",
        extends: "kaopiz-default",
      });
      await writeJson(join(root, ".docops/review-queue/registry.json"), {
        version: 3,
        documents: {},
      });
      await mkdir(join(root, ".docops/templates/srs"), { recursive: true });
      await writeFile(join(root, ".docops/templates/srs/01.md"), "# x");
      await mkdir(join(root, ".docops/comments"), { recursive: true });
      const a = await assessDocopsProject(root);
      expect(a.layout).toBe("docops");
      expect(a.writerReady).toBe(false);
      expect(a.recommendedAction).toBe("repair");
      expect(a.gaps.some((g) => g.id === "DOCOPS-PATH-srs")).toBe(true);
    });
  });

  it("writerReady when docTypes use canonical docs/ paths", async () => {
    await withTempDir(async (root) => {
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
        paths: {
          comments: ".docops/comments",
          reviewConfig: ".docops/review.config.json",
          reviewQueue: ".docops/review-queue",
          prototypeConfig: ".docops/prototype/config.json",
          prototypeScreenMap: ".docops/prototype/screen-map.json",
        },
        capabilities: { review: true, comments: true, prototype: false },
      });
      await writeJson(join(root, ".docops/review.config.json"), {
        schemaVersion: "1.0",
        extends: "kaopiz-default",
      });
      await writeJson(join(root, ".docops/review-queue/registry.json"), {
        version: 3,
        documents: {},
      });
      await mkdir(join(root, ".docops/templates/srs"), { recursive: true });
      await writeFile(join(root, ".docops/templates/srs/01.md"), "# x");
      await mkdir(join(root, ".docops/comments"), { recursive: true });
      const a = await assessDocopsProject(root);
      expect(a.layout).toBe("docops");
      expect(a.writerReady).toBe(true);
      expect(a.recommendedAction).toBe("ok");
    });
  });
});
