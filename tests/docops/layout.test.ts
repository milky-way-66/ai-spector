import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { probeDocopsLayout } from "@/core/docops/layout.js";
import { writeJson } from "@/core/util/fs.js";
import { withTempDir } from "../helpers/temp-project.js";

describe("probeDocopsLayout", () => {
  it("suggests path mismatch when docs are outside configured folder", async () => {
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
        capabilities: { review: false, comments: true, prototype: false },
      });

      await mkdir(join(root, "docs/bd/en"), { recursive: true });
      await writeFile(join(root, "docs/bd/en/screen.md"), "# Screen\n", "utf8");

      const result = await probeDocopsLayout(root);
      expect(result.configuredPaths.srs).toBe("docs/srs");
      expect(result.onDisk.srs?.roots.some((r) => r.path === "docs/bd" && r.fileCount === 0)).toBe(
        false,
      );
      expect(result.agentPrompt).toContain("docops.config.json");
    });
  });
});
