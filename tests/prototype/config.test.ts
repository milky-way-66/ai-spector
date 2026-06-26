import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { withTempProject } from "../helpers/temp-project.js";
import {
  persistPrototypeDefaultTheme,
  readPrototypeThemeName,
} from "@/core/prototype/config.js";
import type { PrototypeConfig } from "@/core/prototype/types.js";

const config: PrototypeConfig = {
  version: 1,
  listScreenDoc: "docs/basic-design/list-screens.md",
  screenIndexSection: "## 4. Screen Index",
  screenDetailDir: "docs/basic-design/screens/",
  prototypeDir: "prototype",
  srcDir: "prototype/src",
  slugFrom: "screenName",
  defaultTheme: "vercel",
  htpasswdFile: "prototype/.htpasswd",
};

describe("readPrototypeThemeName", () => {
  it("prefers theme.json over manifest", async () => {
    await withTempProject(async (root) => {
      await mkdir(join(root, "prototype"), { recursive: true });
      await writeFile(
        join(root, "prototype/theme.json"),
        JSON.stringify({ themeName: "stripe" }),
        "utf8",
      );
      await writeFile(
        join(root, "prototype/manifest.json"),
        JSON.stringify({ themeName: "linear.app" }),
        "utf8",
      );

      expect(await readPrototypeThemeName(root, config)).toBe("stripe");
    });
  });

  it("falls back to manifest when theme.json is missing", async () => {
    await withTempProject(async (root) => {
      await mkdir(join(root, "prototype"), { recursive: true });
      await writeFile(
        join(root, "prototype/manifest.json"),
        JSON.stringify({ themeName: "stripe" }),
        "utf8",
      );

      expect(await readPrototypeThemeName(root, config)).toBe("stripe");
    });
  });
});

describe("persistPrototypeDefaultTheme", () => {
  it("writes defaultTheme to prototype.config.json", async () => {
    await withTempProject(async (root) => {
      await persistPrototypeDefaultTheme(root, "stripe");
      const raw = await import("node:fs/promises").then((fs) =>
        fs.readFile(
          join(root, ".docops/prototype/config.json"),
          "utf8",
        ),
      );
      const parsed = JSON.parse(raw) as { defaultTheme: string };
      expect(parsed.defaultTheme).toBe("stripe");
    });
  });
});
