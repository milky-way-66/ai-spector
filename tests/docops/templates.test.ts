import { join } from "node:path";
import { mkdir, writeFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { copyTemplates, countMarkdownInDir } from "@/core/docops/templates.js";
import { withTempDir } from "../helpers/temp-project.js";

describe("countMarkdownInDir", () => {
  it("returns 0 for missing dir", async () => {
    await withTempDir(async (root) => {
      expect(await countMarkdownInDir(join(root, "nope"))).toBe(0);
    });
  });

  it("counts .md files recursively", async () => {
    await withTempDir(async (root) => {
      const dir = join(root, ".docops/templates/srs");
      await mkdir(dir, { recursive: true });
      await writeFile(join(dir, "a.md"), "# A");
      await mkdir(join(dir, "sub"), { recursive: true });
      await writeFile(join(dir, "sub/b.md"), "# B");
      expect(await countMarkdownInDir(dir)).toBe(2);
    });
  });
});

describe("copyTemplates", () => {
  it("skips destination that already has markdown", async () => {
    await withTempDir(async (root) => {
      const dest = join(root, ".docops/templates/srs");
      await mkdir(dest, { recursive: true });
      await writeFile(join(dest, "existing.md"), "# keep");

      const src = join(root, "src-pack");
      await mkdir(src, { recursive: true });
      await writeFile(join(src, "new.md"), "# new");

      const result = await copyTemplates({
        projectRoot: root,
        layerKey: "srs",
        destRel: ".docops/templates/srs",
        sources: [src],
        dryRun: false,
      });
      expect(result.copied).toBe(false);
      expect(result.actions.some((a) => a.includes("skip"))).toBe(true);
      expect(await countMarkdownInDir(dest)).toBe(1);
    });
  });

  it("copies from first non-empty source", async () => {
    await withTempDir(async (root) => {
      const dest = join(root, ".docops/templates/srs");
      await mkdir(dest, { recursive: true });

      const empty = join(root, "empty");
      await mkdir(empty, { recursive: true });

      const src = join(root, "pack/templates");
      await mkdir(src, { recursive: true });
      await writeFile(join(src, "intro.md"), "# Intro");

      const result = await copyTemplates({
        projectRoot: root,
        layerKey: "srs",
        destRel: ".docops/templates/srs",
        sources: [empty, src],
        dryRun: false,
      });
      expect(result.copied).toBe(true);
      expect(await countMarkdownInDir(dest)).toBe(1);
    });
  });
});
