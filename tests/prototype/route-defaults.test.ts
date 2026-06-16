import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { withTempProject } from "../helpers/temp-project.js";
import { buildPrototypeManifest } from "@/core/prototype/build-manifest.js";
import type { PrototypeConfig } from "@/core/prototype/types.js";

const spaConfig: PrototypeConfig = {
  version: 1,
  listScreenDoc: "docs/basic-design/list-screens.md",
  screenIndexSection: "## 4. Screen Index",
  screenDetailDir: "docs/basic-design/screens/",
  prototypeDir: "prototype",
  srcDir: "prototype/src",
  slugFrom: "screenName",
  defaultTheme: "stripe",
  htpasswdFile: "prototype/.htpasswd",
  buildMode: "spa",
  techStack: "vue",
};

const LIST = `## 4. Screen Index

| Screen | Section (Detail Screen) | User Role | Purpose |
|--------|-------------------------|-----------|---------|
| Order Detail | 5 | All | View order |
| Login | 6 | All | Sign in |
`;

describe("route defaults in screen-map", () => {
  it("merges route-defaults.json into prototypePath", async () => {
    await withTempProject(async (root) => {
      await mkdir(join(root, "docs/basic-design/screens"), { recursive: true });
      await writeFile(join(root, "docs/basic-design/list-screens.md"), LIST, "utf8");
      await mkdir(join(root, "prototype"), { recursive: true });
      await writeFile(
        join(root, "prototype/route-defaults.json"),
        JSON.stringify({
          schemaVersion: 1,
          prototypeBypassAuth: true,
          screens: {
            "order-detail": {
              routePattern: "/orders/:id",
              routeParams: { id: "demo-001" },
              requiresAuth: true,
            },
          },
        }),
        "utf8",
      );

      const result = await buildPrototypeManifest({
        projectRoot: root,
        config: spaConfig,
        themeName: "stripe",
      });

      const detail = result.screenMap.screens.find((s) => s.screenId === "order-detail");
      expect(detail?.prototypePath).toBe("dist/orders/demo-001/");
      expect(detail?.route_exists).toBe(false);
      expect(result.screenMap.buildDest).toBe("dist");
      expect(result.screenMap.prototypeBypassAuth).toBe(true);

      const login = result.screenMap.screens.find((s) => s.screenId === "login");
      expect(login?.prototypePath).toBe("dist/login/");
    });
  });

  it("marks route_exists when SPA build entrypoint exists", async () => {
    await withTempProject(async (root) => {
      await mkdir(join(root, "docs/basic-design/screens"), { recursive: true });
      await writeFile(join(root, "docs/basic-design/list-screens.md"), LIST, "utf8");
      await mkdir(join(root, "prototype/dist"), { recursive: true });
      await writeFile(join(root, "prototype/dist/index.html"), "<!DOCTYPE html>", "utf8");

      const result = await buildPrototypeManifest({
        projectRoot: root,
        config: spaConfig,
        themeName: "stripe",
      });

      expect(result.screenMap.screens.every((s) => s.route_exists)).toBe(true);
    });
  });
});
