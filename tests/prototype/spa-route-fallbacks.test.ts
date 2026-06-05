import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { withTempProject } from "../helpers/temp-project.js";
import {
  spaFallbackDeployPaths,
  writeSpaRouteFallbacks,
} from "../../src/prototype/spa-route-fallbacks.js";

describe("spa route fallbacks", () => {
  it("lists every path segment for nested routes", () => {
    expect(spaFallbackDeployPaths("dist", "/trip/acme-march-2026/print")).toEqual([
      "dist/trip",
      "dist/trip/acme-march-2026",
      "dist/trip/acme-march-2026/print",
    ]);
  });

  it("writes index.html copy at each route directory", async () => {
    await withTempProject(async (root) => {
      const dist = join(root, "prototype/dist");
      await mkdir(dist, { recursive: true });
      await writeFile(join(dist, "index.html"), "<!DOCTYPE html><html></html>", "utf8");

      const result = await writeSpaRouteFallbacks({
        projectRoot: root,
        repoBuildDest: "prototype/dist",
        prototypeDir: "prototype",
        deployBase: "dist",
        screens: [
          {
            screenId: "print",
            displayName: "Print",
            screenDoc: "docs/x.md",
            screenDocPath: "x.md",
            prototypeStem: "print",
            prototypePath: "dist/trip/acme-march-2026/print",
            uri: "/trip/:id/print",
            previewUri: "/trip/acme-march-2026/print",
            htmlExists: true,
          },
        ],
      });

      expect(result.filesWritten).toBeGreaterThan(0);
      expect(result.paths).toContain(
        "prototype/dist/trip/acme-march-2026/print/index.html",
      );
    });
  });
});
