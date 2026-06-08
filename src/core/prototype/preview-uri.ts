/**
 * Build a concrete preview URL from a route pattern and default param values.
 * Used in screen-map.json so reviewers can open detail screens without manual URL editing.
 */
export function buildPreviewUri(
  routePattern: string,
  routeParams?: Record<string, string>,
  queryParams?: Record<string, string>,
): string {
  let path = routePattern.trim() || "/";
  if (!path.startsWith("/")) {
    path = `/${path}`;
  }

  if (routeParams) {
    for (const [key, value] of Object.entries(routeParams)) {
      const encoded = encodeURIComponent(value);
      path = path.replace(`:${key}`, encoded).replace(`[${key}]`, encoded);
    }
  }

  if (queryParams && Object.keys(queryParams).length > 0) {
    const qs = new URLSearchParams(queryParams).toString();
    if (qs) {
      path += path.includes("?") ? `&${qs}` : `?${qs}`;
    }
  }

  return path;
}

/** True when the pattern still has unresolved dynamic segments (e.g. :id). */
export function routePatternHasUnresolvedParams(
  routePattern: string,
  routeParams?: Record<string, string>,
): boolean {
  const paramNames = [...routePattern.matchAll(/:([A-Za-z0-9_]+)/g)].map((m) => m[1]!);
  if (paramNames.length === 0) {
    return false;
  }
  if (!routeParams) {
    return true;
  }
  return paramNames.some((name) => !routeParams[name]?.trim());
}
