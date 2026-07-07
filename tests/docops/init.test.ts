import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { pathExists } from "@/core/util/fs.js";
import { initDocopsContract } from "@/core/docops/init.js";
import { DOCOPS_CONFIG_REL } from "@/core/docops/paths.js";
import { countMarkdownInDir } from "@/core/docops/templates.js";
import { withTempDir } from "../helpers/temp-project.js";

describe("initDocopsContract", () => {
  it("creates Writer-ready tree on empty repo", async () => {
    await withTempDir(async (root) => {
      const result = await initDocopsContract({ projectRoot: root });
      expect(result.initialized).toBe(true);
      expect(result.config?.docTypes?.srs?.path).toBe("docs/srs");
      expect(result.config?.docTypes?.basicDesign?.path).toBe("docs/basic-design");
      expect(result.config?.docTypes?.detailDesign?.enabled).toBe(false);
      expect(result.config?.docTypes?.otherDocument?.enabled).toBe(false);
      expect(await pathExists(join(root, DOCOPS_CONFIG_REL))).toBe(true);
      expect(await pathExists(join(root, ".docops/review.config.json"))).toBe(true);
      expect(await pathExists(join(root, ".docops/review-queue/registry.json"))).toBe(true);
      const reviewRegistry = JSON.parse(
        await (await import("node:fs/promises")).readFile(
          join(root, ".docops/review-queue/registry.json"),
          "utf8",
        ),
      );
      expect(reviewRegistry.version).toBe(4);
      expect(await pathExists(join(root, ".docops/guide/README.md"))).toBe(true);
      expect(await pathExists(join(root, ".docops/guide/modules/review.md"))).toBe(true);
      expect(await pathExists(join(root, ".docops/guide/schemas/docops.config.schema.json"))).toBe(true);
      expect(await pathExists(join(root, ".docops/guide/examples/minimal-docops.config.json"))).toBe(true);
      const md = await countMarkdownInDir(join(root, ".docops/templates/srs"));
      expect(md).toBeGreaterThan(0);
      const ddMd = await countMarkdownInDir(join(root, ".docops/templates/detail-design"));
      expect(ddMd).toBeGreaterThan(0);
    });
  });

  it("refuses when config exists without force", async () => {
    await withTempDir(async (root) => {
      await initDocopsContract({ projectRoot: root });
      const second = await initDocopsContract({ projectRoot: root });
      expect(second.initialized).toBe(false);
      expect(second.actions[0]).toMatch(/skip|exists/i);
    });
  });

  it("dry-run does not write files", async () => {
    await withTempDir(async (root) => {
      const result = await initDocopsContract({ projectRoot: root, dryRun: true });
      expect(result.dryRun).toBe(true);
      expect(await pathExists(join(root, DOCOPS_CONFIG_REL))).toBe(false);
    });
  });
});
