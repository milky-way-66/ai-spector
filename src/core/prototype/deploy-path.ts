/**
 * Deploy-facing paths written to screen-map.json (SPA).
 * Repo sync still uses config.buildDest e.g. prototype/dist; consumers serve at domain/prefix/dist/.
 */

/** Repo buildDest → deploy base (strip prototypeDir prefix, no index.html). */
export function toDeployBasePath(
  repoBuildDest: string,
  prototypeDir = "prototype",
): string {
  let normalized = repoBuildDest.replace(/\\/g, "/").replace(/\/$/, "");
  const prefix = `${prototypeDir.replace(/\\/g, "/").replace(/\/$/, "")}/`;
  if (normalized.startsWith(prefix)) {
    normalized = normalized.slice(prefix.length);
  }
  return normalized || "dist";
}

/** Per-screen deploy path: `<deployBase>/<route>/` from previewUri or uri (trailing slash for static directory index). */
export function toSpaScreenPrototypePath(
  deployBase: string,
  previewOrRoute: string,
): string {
  const pathname = previewOrRoute.split("?")[0]!.split("#")[0]!;
  const route = pathname.startsWith("/") ? pathname.slice(1) : pathname;
  const base = deployBase.replace(/\/$/, "");
  return route ? `${base}/${route.replace(/\/+$/, "")}/` : base;
}
