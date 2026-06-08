import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import type { PrototypeScreenMapEntry } from "./types.js";
import { pathExists } from "../util/fs.js";
import { toDeployBasePath, toSpaScreenPrototypePath } from "./deploy-path.js";

/** All deploy-prefix paths that need an index.html copy (every URL segment). */
export function spaFallbackDeployPaths(
  deployBase: string,
  previewOrRoute: string,
): string[] {
  const pathname = previewOrRoute.split("?")[0]!.split("#")[0]!;
  const route = pathname.startsWith("/") ? pathname.slice(1) : pathname;
  if (!route) {
    return [];
  }
  const parts = route.split("/").filter(Boolean);
  const base = deployBase.replace(/\/$/, "");
  const paths: string[] = [];
  for (let i = 1; i <= parts.length; i++) {
    paths.push(`${base}/${parts.slice(0, i).join("/")}`);
  }
  return paths;
}

function routePartFromDeployPath(deployPath: string, deployBase: string): string {
  const normalizedDeploy = deployPath.replace(/\\/g, "/").replace(/\/+$/, "");
  const base = deployBase.replace(/\/$/, "");
  if (normalizedDeploy === base) {
    return "";
  }
  if (normalizedDeploy.startsWith(`${base}/`)) {
    return normalizedDeploy.slice(base.length + 1);
  }
  return normalizedDeploy;
}

function deployPathToRepoIndexPath(
  deployPath: string,
  repoBuildDest: string,
  deployBase: string,
): string {
  const routePart = routePartFromDeployPath(deployPath, deployBase);
  return join(repoBuildDest, routePart, "index.html").replace(/\\/g, "/");
}

/** Relative base href so `./assets/…` resolves to the SPA build root, not the nested folder. */
export function baseHrefForRouteDepth(routeSegmentCount: number): string {
  if (routeSegmentCount <= 0) {
    return "./";
  }
  return "../".repeat(routeSegmentCount);
}

export function injectSpaFallbackBaseHref(html: string, baseHref: string): string {
  const baseTag = `<base href="${baseHref.replace(/"/g, "&quot;")}">`;
  if (/<base\s[\s\S]*?\/?>/i.test(html)) {
    return html.replace(/<base\s[\s\S]*?\/?>/i, baseTag);
  }
  if (/<head(\s[^>]*)?>/i.test(html)) {
    return html.replace(/<head(\s[^>]*)?>/i, (match) => `${match}\n    ${baseTag}`);
  }
  return `${baseTag}\n${html}`;
}

function fallbackIndexHtml(rootIndexHtml: string, deployPath: string, deployBase: string): string {
  const depth = routePartFromDeployPath(deployPath, deployBase)
    .split("/")
    .filter(Boolean).length;
  return injectSpaFallbackBaseHref(rootIndexHtml, baseHrefForRouteDepth(depth));
}

/**
 * Copy the SPA entry index.html into each screen route directory so zip/static hosts
 * can serve deep links without nginx try_files (e.g. dist/trip/x/print/index.html).
 */
export async function writeSpaRouteFallbacks(opts: {
  projectRoot: string;
  repoBuildDest: string;
  prototypeDir: string;
  deployBase: string;
  screens: PrototypeScreenMapEntry[];
}): Promise<{ filesWritten: number; paths: string[] }> {
  const rootIndex = join(opts.projectRoot, opts.repoBuildDest, "index.html");
  if (!(await pathExists(rootIndex))) {
    return { filesWritten: 0, paths: [] };
  }

  const indexHtml = await readFile(rootIndex, "utf8");
  const deployBase =
    opts.deployBase || toDeployBasePath(opts.repoBuildDest, opts.prototypeDir);

  const deployPaths = new Set<string>();
  for (const screen of opts.screens) {
    const preview = screen.previewUri ?? screen.uri;
    for (const path of spaFallbackDeployPaths(deployBase, preview)) {
      deployPaths.add(path);
    }
    deployPaths.add(toSpaScreenPrototypePath(deployBase, preview));
  }

  const written: string[] = [];
  for (const deployPath of deployPaths) {
    const relIndex = deployPathToRepoIndexPath(
      deployPath,
      opts.repoBuildDest,
      deployBase,
    );
    if (relIndex.replace(/\\/g, "/").endsWith("/index.html") && deployPath === deployBase) {
      continue;
    }
    const absIndex = join(opts.projectRoot, relIndex);
    if (absIndex.replace(/\\/g, "/") === rootIndex.replace(/\\/g, "/")) {
      continue;
    }
    await mkdir(dirname(absIndex), { recursive: true });
    await writeFile(
      absIndex,
      fallbackIndexHtml(indexHtml, deployPath, deployBase),
      "utf8",
    );
    written.push(relIndex.replace(/\\/g, "/"));
  }

  return { filesWritten: written.length, paths: written };
}
