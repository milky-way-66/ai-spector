import { describe, expect, it } from "vitest";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { withTempProject } from "../helpers/temp-project.js";
import { buildPrototypeManifest } from "../../src/prototype/build-manifest.js";
import {
  buildScreenDocPaths,
  toLangNeutralDocDir,
} from "../../src/prototype/screen-doc-paths.js";
import type { PrototypeConfig } from "../../src/prototype/types.js";
import { writeJson } from "../../src/util/fs.js";

describe("screen doc path helpers", () => {
  it("derives lang-neutral directory from multi-lang detail dir", () => {
    expect(
      toLangNeutralDocDir("docs/basic-design/en/screens", ["en", "vi"]),
    ).toBe("basic-design/screens");
  });

  it("derives lang-neutral directory from single-lang detail dir", () => {
    expect(toLangNeutralDocDir("docs/basic-design/screens/", [])).toBe(
      "basic-design/screens",
    );
  });

  it("builds logical screenDoc and full per-language screenDocs", () => {
    const result = buildScreenDocPaths({
      screenDetailDir: "docs/basic-design/en/screens",
      docFilename: "login.md",
      docLanguages: ["en", "vi"],
    });

    expect(result).toEqual({
      screenDoc: "basic-design/screens/login.md",
      screenDocs: {
        en: "docs/basic-design/en/screens/login.md",
        vi: "docs/basic-design/vi/screens/login.md",
      },
    });
  });

  it("builds logical screenDoc only for single-language projects", () => {
    const result = buildScreenDocPaths({
      screenDetailDir: "docs/basic-design/screens/",
      docFilename: "home.md",
      docLanguages: ["en"],
    });

    expect(result).toEqual({
      screenDoc: "basic-design/screens/home.md",
    });
  });
});

const multiLangConfig: PrototypeConfig = {
  version: 1,
  listScreenDoc: "docs/basic-design/en/list-screens.md",
  screenIndexSection: "## 4. Screen Index",
  screenDetailDir: "docs/basic-design/en/screens/",
  prototypeDir: "prototype",
  srcDir: "prototype/src",
  slugFrom: "screenName",
  defaultTheme: "stripe",
  htpasswdFile: "prototype/.htpasswd",
  buildMode: "spa",
};

const LIST = `## 4. Screen Index

| Screen | Section (Detail Screen) | User Role | Purpose |
|--------|-------------------------|-----------|---------|
| Login | 5 | All | Sign in |
`;

describe("screen-map screen doc paths", () => {
  it("writes logical screenDoc and full screenDocs in multi-lang projects", async () => {
    await withTempProject(async (root) => {
      await writeJson(join(root, ".ai-spector/docflow.config.json"), {
        version: 1,
        languages: [
          { code: "en", label: "English" },
          { code: "vi", label: "Vietnamese" },
        ],
        paths: {},
      });
      await mkdir(join(root, "docs/basic-design/en/screens"), { recursive: true });
      await writeFile(join(root, "docs/basic-design/en/list-screens.md"), LIST, "utf8");
      await mkdir(join(root, "prototype"), { recursive: true });

      const result = await buildPrototypeManifest({
        projectRoot: root,
        config: multiLangConfig,
        themeName: "stripe",
      });

      const login = result.screenMap.screens[0]!;
      expect(login.screenDoc).toBe("basic-design/screens/login.md");
      expect(login.screenDocs).toEqual({
        en: "docs/basic-design/en/screens/login.md",
        vi: "docs/basic-design/vi/screens/login.md",
      });
      expect(result.manifest.screens[0]!.screenDoc).toBe(
        "docs/basic-design/en/screens/login.md",
      );
    });
  });
});
