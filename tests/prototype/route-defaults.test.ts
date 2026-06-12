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
  it("merges route-defaults.json and computes previewUri", async () => {
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
      expect(detail?.uri).toBe("/orders/:id");
      expect(detail?.previewUri).toBe("/orders/demo-001");
      expect(detail?.prototypePath).toBe("dist/orders/demo-001/");
      expect(detail?.requiresAuth).toBe(true);
      expect(result.screenMap.buildDest).toBe("dist");
      expect(result.screenMap.prototypeBypassAuth).toBe(true);
    });
  });

  it("preserves route defaults from prior screen-map on rebuild", async () => {
    await withTempProject(async (root) => {
      await mkdir(join(root, "docs/basic-design/screens"), { recursive: true });
      await writeFile(join(root, "docs/basic-design/list-screens.md"), LIST, "utf8");
      await mkdir(join(root, "prototype"), { recursive: true });
      await writeFile(
        join(root, "prototype/screen-map.json"),
        JSON.stringify({
          schemaVersion: 1,
          themeName: "stripe",
          buildMode: "spa",
          generatedAt: "2020-01-01T00:00:00.000Z",
          prototypeBypassAuth: true,
          screens: [
            {
              screenId: "order-detail",
              displayName: "Order Detail",
              screenDoc: "docs/basic-design/screens/order-detail.md",
              screenDocPath: "basic-design/screens/order-detail.md",
              prototypeStem: "order-detail",
              prototypePath: "prototype/src/order-detail.html",
              uri: "/orders/:id",
              routeParams: { id: "kept-99" },
              previewUri: "/orders/kept-99",
              htmlExists: false,
            },
          ],
        }),
        "utf8",
      );

      const result = await buildPrototypeManifest({
        projectRoot: root,
        config: spaConfig,
        themeName: "stripe",
      });

      const detail = result.screenMap.screens.find((s) => s.screenId === "order-detail");
      expect(detail?.routeParams).toEqual({ id: "kept-99" });
      expect(detail?.previewUri).toBe("/orders/kept-99");
    });
  });
});
