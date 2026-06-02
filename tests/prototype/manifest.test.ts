import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { withTempProject } from "../helpers/temp-project.js";
import { buildPrototypeManifest } from "../../src/prototype/build-manifest.js";
import type { PrototypeConfig } from "../../src/prototype/types.js";

const config: PrototypeConfig = {
  version: 1,
  listScreenDoc: "docs/basic-design/list-screens.md",
  screenIndexSection: "## 4. Screen Index",
  screenDetailDir: "docs/basic-design/screens/",
  prototypeDir: "prototype",
  srcDir: "prototype/src",
  slugFrom: "screenName",
  defaultTheme: "stripe",
};

const LIST = `## 4. Screen Index

| Screen | Section (Detail Screen) | User Role | Purpose |
|--------|-------------------------|-----------|---------|
| Home | 5 | All | Landing |
`;

describe("buildPrototypeManifest", () => {
  it("builds manifest from list-screens.md", async () => {
    await withTempProject(async (root) => {
      await mkdir(join(root, "docs/basic-design/screens"), { recursive: true });
      await writeFile(join(root, "docs/basic-design/list-screens.md"), LIST, "utf8");
      await mkdir(join(root, "prototype/src"), { recursive: true });
      await writeFile(join(root, "prototype/src/home.html"), "<!DOCTYPE html>", "utf8");

      const result = await buildPrototypeManifest({
        projectRoot: root,
        config,
        themeName: "stripe",
      });

      expect(result.screenCount).toBe(1);
      expect(result.htmlCount).toBe(1);
      expect(result.manifest.themeName).toBe("stripe");
      expect(result.manifest.screens[0]!.prototypeStem).toBe("home");
      expect(result.screenMap.screens[0]!.htmlExists).toBe(true);
    });
  });
});
