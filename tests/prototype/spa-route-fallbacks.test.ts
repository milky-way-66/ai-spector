import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { withTempProject } from "../helpers/temp-project.js";
import {
  baseHrefForRouteDepth,
  injectSpaFallbackBaseHref,
  spaFallbackDeployPaths,
  writeSpaRouteFallbacks,
} from "@/core/prototype/spa-route-fallbacks.js";

describe("spa route fallbacks", () => {
  it("computes base href depth for nested routes", () => {
    expect(baseHrefForRouteDepth(0)).toBe("./");
    expect(baseHrefForRouteDepth(3)).toBe("../../../");
  });

  it("injects base href so assets resolve from dist root", () => {
    const html = `<!DOCTYPE html><html><head></head><body><script src="./assets/index.js"></script></body></html>`;
    const out = injectSpaFallbackBaseHref(html, "../../../");
    expect(out).toContain('<base href="../../../">');
  });

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
            prototypePath: "dist/trip/acme-march-2026/print/",
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

      const nested = await readFile(
        join(dist, "trip/acme-march-2026/print/index.html"),
        "utf8",
      );
      expect(nested).toContain('<base href="../../../">');
    });
  });
});
