import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { withTempProject } from "../helpers/temp-project.js";
import { writeJson } from "@/core/util/fs.js";
import { resolveReviewDocPath } from "@/core/reviews/doc-resolve.js";

async function setupMultiLangProject(
  root: string,
  langs: Array<{ code: string; label: string }>,
): Promise<void> {
  await writeJson(join(root, ".ai-spector/docflow.config.json"), {
    version: 1,
    languages: langs,
    paths: {
      graph: ".ai-spector/graph/traceability.graph.json",
      registry: ".ai-spector/registry/section-registry.json",
      templates: ".ai-spector/templates",
    },
  });
}

describe("resolveReviewDocPath", () => {
  it("resolves flat path when document exists at root", async () => {
    await withTempProject(async (root) => {
      await setupMultiLangProject(root, [{ code: "en", label: "English" }]);
      await mkdir(join(root, "docs/srs"), { recursive: true });
      await writeFile(join(root, "docs/srs/1-introduction.md"), "# Intro", "utf8");

      const resolved = await resolveReviewDocPath(root, "srs/1-introduction");
      expect(resolved.docPath).toBe("docs/srs/1-introduction.md");
    });
  });

  it("resolves primary language subfolder when file exists", async () => {
    await withTempProject(async (root) => {
      await setupMultiLangProject(root, [
        { code: "en", label: "English" },
        { code: "vi", label: "Vietnamese" },
      ]);
      await mkdir(join(root, "docs/srs/en"), { recursive: true });
      await writeFile(join(root, "docs/srs/en/1-introduction.md"), "# Intro EN", "utf8");

      const resolved = await resolveReviewDocPath(root, "srs/1-introduction");
      expect(resolved.docPath).toBe("docs/srs/en/1-introduction.md");
    });
  });

  it("falls back to secondary language when primary is missing", async () => {
    await withTempProject(async (root) => {
      await setupMultiLangProject(root, [
        { code: "en", label: "English" },
        { code: "vi", label: "Vietnamese" },
      ]);
      await mkdir(join(root, "docs/srs/vi"), { recursive: true });
      await writeFile(join(root, "docs/srs/vi/1-introduction.md"), "# Intro VI", "utf8");

      const resolved = await resolveReviewDocPath(root, "srs/1-introduction");
      expect(resolved.docPath).toBe("docs/srs/vi/1-introduction.md");
    });
  });

  it("prefers clientLanguage for client track when both exist", async () => {
    await withTempProject(async (root) => {
      await writeJson(join(root, ".ai-spector/docflow.config.json"), {
        version: 1,
        languages: [
          { code: "en", label: "English" },
          { code: "vi", label: "Vietnamese" },
        ],
        clientLanguage: "vi",
        paths: {
          graph: ".ai-spector/graph/traceability.graph.json",
          registry: ".ai-spector/registry/section-registry.json",
          templates: ".ai-spector/templates",
        },
      });
      await mkdir(join(root, "docs/srs/en"), { recursive: true });
      await mkdir(join(root, "docs/srs/vi"), { recursive: true });
      await writeFile(join(root, "docs/srs/en/1-introduction.md"), "# Intro EN", "utf8");
      await writeFile(join(root, "docs/srs/vi/1-introduction.md"), "# Intro VI", "utf8");

      const internal = await resolveReviewDocPath(root, "srs/1-introduction", { track: "internal" });
      expect(internal.docPath).toBe("docs/srs/en/1-introduction.md");

      const client = await resolveReviewDocPath(root, "srs/1-introduction", { track: "client" });
      expect(client.docPath).toBe("docs/srs/vi/1-introduction.md");
    });
  });

  it("throws descriptive error when no path matches", async () => {
    await withTempProject(async (root) => {
      await setupMultiLangProject(root, [
        { code: "en", label: "English" },
        { code: "vi", label: "Vietnamese" },
      ]);

      await expect(resolveReviewDocPath(root, "srs/missing")).rejects.toThrow(
        /Document not found for logical path "srs\/missing"/,
      );
    });
  });
});
