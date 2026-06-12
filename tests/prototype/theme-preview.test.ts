import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { packageBundleRoot } from "@/core/config/load.js";
import {
  installThemePreviews,
  resolveThemePreviewPath,
} from "@/core/prototype/theme-preview.js";
import { pathExists } from "@/core/util/fs.js";
import { withTempDir } from "../helpers/temp-project.js";

describe("theme preview", () => {
  it("resolveThemePreviewPath points at preview.html in theme folder", () => {
    const path = resolveThemePreviewPath("stripe");
    expect(path).toBe(join(packageBundleRoot(), "assets", "themes", "stripe", "preview.html"));
  });

  it("installThemePreviews moves html into theme folders", async () => {
    await withTempDir(async (root) => {
      const themesRoot = join(root, "themes");
      const staging = join(root, "staging");
      await mkdir(join(themesRoot, "stripe"), { recursive: true });
      await mkdir(join(themesRoot, "vercel"), { recursive: true });
      await mkdir(staging, { recursive: true });
      await writeFile(join(staging, "stripe.html"), "<html>stripe</html>", "utf8");
      await writeFile(join(staging, "vercel.html"), "<html>vercel</html>", "utf8");
      await writeFile(join(staging, "orphan.html"), "<html>orphan</html>", "utf8");

      const result = await installThemePreviews({ from: staging, themesRoot });
      expect(result.moved).toEqual(["stripe", "vercel"]);
      expect(result.missingTheme).toEqual(["orphan"]);
      expect(await pathExists(join(themesRoot, "stripe", "preview.html"))).toBe(true);
      expect(await pathExists(join(staging, "stripe.html"))).toBe(false);
      expect(await pathExists(join(staging, "orphan.html"))).toBe(true);
    });
  });

  it("installThemePreviews skips when preview.html already exists", async () => {
    await withTempDir(async (root) => {
      const themesRoot = join(root, "themes");
      const staging = join(root, "staging");
      await mkdir(join(themesRoot, "stripe"), { recursive: true });
      await mkdir(staging, { recursive: true });
      await writeFile(join(themesRoot, "stripe", "preview.html"), "<html>old</html>", "utf8");
      await writeFile(join(staging, "stripe.html"), "<html>new</html>", "utf8");

      const result = await installThemePreviews({ from: staging, themesRoot });
      expect(result.moved).toEqual([]);
      expect(result.skipped).toEqual(["stripe"]);
    });
  });
});
