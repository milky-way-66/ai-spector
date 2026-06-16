/**
 * Deploy-facing paths written to screen-map.json.
 * Repo paths include prototypeDir (e.g. prototype/src, prototype/dist);
 * screen-map prototypePath is relative to deploy root current/ (e.g. src/login.html, dist/login).
 */

/** Repo path under prototypeDir → deploy path (strip prototypeDir prefix). */
export function toDeployPrototypePath(
  repoRelativePath: string,
  prototypeDir = "prototype",
): string {
  let normalized = repoRelativePath.replace(/\\/g, "/");
  const prefix = `${prototypeDir.replace(/\\/g, "/").replace(/\/$/, "")}/`;
  if (normalized.startsWith(prefix)) {
    normalized = normalized.slice(prefix.length);
  }
  return normalized;
}

/** Repo buildDest → deploy base (strip prototypeDir prefix, no index.html). */
export function toDeployBasePath(
  repoBuildDest: string,
  prototypeDir = "prototype",
): string {
  return toDeployPrototypePath(repoBuildDest, prototypeDir) || "dist";
}

/** Per-screen SPA deploy path: `<deployBase>/<route>` from previewUri or route pattern. */
export function toSpaScreenPrototypePath(
  deployBase: string,
  previewOrRoute: string,
): string {
  const pathname = previewOrRoute.split("?")[0]!.split("#")[0]!;
  const route = pathname.startsWith("/") ? pathname.slice(1) : pathname;
  const base = deployBase.replace(/\/$/, "");
  const normalizedRoute = route.replace(/\/+$/, "");
  return normalizedRoute ? `${base}/${normalizedRoute}` : base;
}
