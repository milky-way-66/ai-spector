import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { withTempProject } from "../helpers/temp-project.js";
import {
  buildScreenMapFromPathMap,
  normalizeDeployPrototypePath,
} from "@/core/prototype/path-map.js";
import type { PrototypeConfig } from "@/core/prototype/types.js";

const config: PrototypeConfig = {
  version: 1,
  listScreenDoc: "docs/basic-design/list-screens.md",
  screenIndexSection: "## 4. Screen Index",
  screenDetailDir: "docs/basic-design/screens/",
  prototypeDir: "prototype",
  srcDir: "prototype/src",
  slugFrom: "screenName",
  defaultTheme: "stripe",
  htpasswdFile: "prototype/.htpasswd",
};

const LIST = `## 4. Screen Index

| Screen | Section (Detail Screen) | User Role | Purpose |
|--------|-------------------------|-----------|---------|
| Login | 5 | All | Sign in |
| Home | 6 | All | Landing |
`;

describe("normalizeDeployPrototypePath", () => {
  it("strips leading slash and trailing slash on routes", () => {
    expect(normalizeDeployPrototypePath("/dist/login/")).toBe("dist/login");
    expect(normalizeDeployPrototypePath("src/login.html")).toBe("src/login.html");
  });
});

describe("buildScreenMapFromPathMap", () => {
  it("merges path-map with Screen Index and sets hosted route_exists", async () => {
    await withTempProject(async (root) => {
      await mkdir(join(root, "docs/basic-design/screens"), { recursive: true });
      await writeFile(join(root, "docs/basic-design/list-screens.md"), LIST, "utf8");
      await mkdir(join(root, "prototype"), { recursive: true });

      const result = await buildScreenMapFromPathMap({
        projectRoot: root,
        config,
        pathMap: {
          schemaVersion: 1,
          buildMode: "spa",
          hosted: true,
          reviewHost: "https://poc.dev.kaopiz.com",
          projectId: "demo",
          deployVersion: "2.0",
          defaultScreenId: "login",
          screens: {
            login: { prototypePath: "/dist/login/" },
            home: { prototypePath: "legacy/home.html" },
          },
        },
      });

      expect(result.screenMap.screens).toHaveLength(2);
      expect(result.screenMap.screens[0]!.prototypePath).toBe("dist/login");
      expect(result.screenMap.screens[0]!.reviewUrl).toBe(
        "https://poc.dev.kaopiz.com/demo/2.0/dist/login",
      );
      expect(result.screenMap.screens.every((s) => s.route_exists)).toBe(true);
      expect(result.screenMap.defaultScreenId).toBe("login");
      expect(result.screenMap.defaultScreen?.screenId).toBe("login");
      expect(result.screenMap.defaultScreen?.reviewUrl).toBe(
        "https://poc.dev.kaopiz.com/demo/2.0/dist/login",
      );
    });
  });

  it("builds reviewUrl without projectId or deployVersion", async () => {
    await withTempProject(async (root) => {
      await mkdir(join(root, "docs/basic-design/screens"), { recursive: true });
      await writeFile(join(root, "docs/basic-design/list-screens.md"), LIST, "utf8");
      await mkdir(join(root, "prototype"), { recursive: true });

      const result = await buildScreenMapFromPathMap({
        projectRoot: root,
        config,
        pathMap: {
          schemaVersion: 1,
          hosted: true,
          reviewHost: "https://poc.dev.kaopiz.com",
          screens: {
            login: { prototypePath: "login" },
          },
        },
      });

      expect(result.screenMap.reviewHost).toBe("https://poc.dev.kaopiz.com");
      expect(result.screenMap.projectId).toBeUndefined();
      expect(result.screenMap.deployVersion).toBeUndefined();
      expect(result.screenMap.screens[0]!.reviewUrl).toBe("https://poc.dev.kaopiz.com/login");
    });
  });

  it("merges path-map with directReviewUrl without URL construction", async () => {
    await withTempProject(async (root) => {
      await mkdir(join(root, "docs/basic-design/screens"), { recursive: true });
      await writeFile(join(root, "docs/basic-design/list-screens.md"), LIST, "utf8");
      await mkdir(join(root, "prototype"), { recursive: true });

      const directUrl = "https://legacy.example.com/app/login";
      const result = await buildScreenMapFromPathMap({
        projectRoot: root,
        config,
        pathMap: {
          schemaVersion: 1,
          hosted: true,
          directReviewUrl: true,
          screens: {
            login: { prototypePath: directUrl },
          },
        },
      });

      expect(result.screenMap.directReviewUrl).toBe(true);
      expect(result.screenMap.screens[0]!.prototypePath).toBe(directUrl);
      expect(result.screenMap.screens[0]!.reviewUrl).toBe(directUrl);
      expect(result.screenMap.reviewHost).toBeUndefined();
    });
  });

  it("strict mode errors when a screen has no path", async () => {
    await withTempProject(async (root) => {
      await mkdir(join(root, "docs/basic-design/screens"), { recursive: true });
      await writeFile(join(root, "docs/basic-design/list-screens.md"), LIST, "utf8");

      await expect(
        buildScreenMapFromPathMap({
          projectRoot: root,
          config,
          pathMap: {
            schemaVersion: 1,
            hosted: true,
            screens: {
              login: { prototypePath: "dist/login" },
            },
          },
          strict: true,
        }),
      ).rejects.toThrow(/Missing prototypePath/);
    });
  });
});
