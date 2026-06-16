import type { PrototypeScreenMapEntry, PrototypeScreenMap } from "./types.js";

export interface ResolveDefaultScreenOptions {
  /** CLI or persisted config override. */
  explicit?: string;
  /** Previous `screen-map.json` → `defaultScreenId`. */
  previous?: string;
  /** `prototype.config.json` → `defaultScreenId`. */
  configDefault?: string;
}

/**
 * Pick the default entry screen from the current manifest state.
 * Prefers screens that already have a route/file; falls back to the full index order.
 */
export function resolveDefaultScreenId(
  screens: PrototypeScreenMapEntry[],
  opts: ResolveDefaultScreenOptions = {},
): string | undefined {
  if (screens.length === 0) {
    return undefined;
  }

  const withRoutes = screens.filter((s) => s.route_exists);
  const pool = withRoutes.length > 0 ? withRoutes : screens;
  const poolIds = new Set(pool.map((s) => s.screenId));

  const pick = (id?: string): string | undefined =>
    id?.trim() && poolIds.has(id.trim()) ? id.trim() : undefined;

  return (
    pick(opts.explicit) ??
    pick(opts.previous) ??
    pick(opts.configDefault) ??
    pool[0]!.screenId
  );
}

/** Attach `defaultScreenId` and denormalized `defaultScreen` for web UI consumption. */
export function finalizeScreenMap(screenMap: PrototypeScreenMap): PrototypeScreenMap {
  if (screenMap.screens.length === 0) {
    return screenMap;
  }

  const defaultScreenId =
    screenMap.defaultScreenId ?? resolveDefaultScreenId(screenMap.screens);
  if (!defaultScreenId) {
    return screenMap;
  }

  const defaultScreen = screenMap.screens.find((s) => s.screenId === defaultScreenId);
  if (!defaultScreen) {
    return { ...screenMap, defaultScreenId };
  }

  return { ...screenMap, defaultScreenId, defaultScreen };
}

export function formatDefaultScreenChoices(
  screens: PrototypeScreenMapEntry[],
): string {
  const withRoutes = screens.filter((s) => s.route_exists);
  const pool = withRoutes.length > 0 ? withRoutes : screens;
  return pool.map((s) => `${s.screenId} (${s.displayName})`).join(", ");
}

export function assertDefaultScreenInPool(
  screenId: string,
  screens: PrototypeScreenMapEntry[],
): void {
  const withRoutes = screens.filter((s) => s.route_exists);
  const pool = withRoutes.length > 0 ? withRoutes : screens;
  const poolIds = new Set(pool.map((s) => s.screenId));
  if (!poolIds.has(screenId.trim())) {
    throw new Error(
      `Unknown or unavailable default screen "${screenId}". Choose one of: ${formatDefaultScreenChoices(screens)}`,
    );
  }
}
