import { join } from "node:path";
import type { PrototypeScreenMapEntry } from "./types.js";
import { buildPreviewUri, routePatternHasUnresolvedParams } from "./preview-uri.js";
import { pathExists, readJson } from "../util/fs.js";

export interface PrototypeRouteDefaultsScreen {
  /** Router path pattern; defaults to screen slug route `/<slug>`. */
  routePattern?: string;
  /** Default path-param values for preview / deep links (e.g. `{ "id": "demo-001" }`). */
  routeParams?: Record<string, string>;
  /** Default query-string values for preview (e.g. `{ "tab": "overview" }`). */
  queryParams?: Record<string, string>;
  /** When true, production would guard this route; prototype SPA should still allow direct access. */
  requiresAuth?: boolean;
}

export interface PrototypeRouteDefaultsFile {
  schemaVersion: 1;
  /**
   * When true (default for prototypes), SPA router guards must not redirect unauthenticated
   * users away from deep-linked routes — reviewers open any screen-map previewUri directly.
   */
  prototypeBypassAuth?: boolean;
  screens: Record<string, PrototypeRouteDefaultsScreen>;
}

const ROUTE_DEFAULTS_FILE = "route-defaults.json";

export function routeDefaultsPath(prototypeDir: string): string {
  return join(prototypeDir, ROUTE_DEFAULTS_FILE);
}

export async function loadRouteDefaults(
  projectRoot: string,
  prototypeDir: string,
): Promise<PrototypeRouteDefaultsFile | undefined> {
  const path = join(projectRoot, prototypeDir, ROUTE_DEFAULTS_FILE);
  if (!(await pathExists(path))) {
    return undefined;
  }
  const raw = await readJson<PrototypeRouteDefaultsFile>(path);
  if (raw.schemaVersion !== 1 || !raw.screens) {
    return undefined;
  }
  return raw;
}

export interface ApplyRouteDefaultsInput {
  screenId: string;
  slug: string;
  buildMode: "static" | "spa";
  baseUri: string;
  fromFile?: PrototypeRouteDefaultsScreen;
  fromPriorEntry?: Pick<
    PrototypeScreenMapEntry,
    "routePattern" | "routeParams" | "queryParams" | "requiresAuth" | "uri"
  >;
}

export interface ApplyRouteDefaultsResult {
  uri: string;
  routePattern?: string;
  routeParams?: Record<string, string>;
  queryParams?: Record<string, string>;
  previewUri?: string;
  requiresAuth?: boolean;
}

/**
 * Merge route defaults (file → prior screen-map) and compute previewUri for SPA screens.
 */
export function applyRouteDefaults(input: ApplyRouteDefaultsInput): ApplyRouteDefaultsResult {
  const merged: PrototypeRouteDefaultsScreen = {
    routePattern: input.fromPriorEntry?.routePattern ?? input.fromPriorEntry?.uri,
    routeParams: input.fromPriorEntry?.routeParams,
    queryParams: input.fromPriorEntry?.queryParams,
    requiresAuth: input.fromPriorEntry?.requiresAuth,
    ...input.fromFile,
  };

  if (input.buildMode !== "spa") {
    return { uri: input.baseUri };
  }

  const routePattern = merged.routePattern?.trim() || input.fromPriorEntry?.uri || input.baseUri;
  const routeParams = merged.routeParams;
  const queryParams = merged.queryParams;
  const requiresAuth = merged.requiresAuth;

  const hasUnresolved = routePatternHasUnresolvedParams(routePattern, routeParams);
  const previewUri = hasUnresolved
    ? undefined
    : buildPreviewUri(routePattern, routeParams, queryParams);

  return {
    uri: routePattern,
    ...(routePattern !== input.baseUri ? { routePattern } : {}),
    ...(routeParams && Object.keys(routeParams).length > 0 ? { routeParams } : {}),
    ...(queryParams && Object.keys(queryParams).length > 0 ? { queryParams } : {}),
    ...(previewUri ? { previewUri } : {}),
    ...(requiresAuth !== undefined ? { requiresAuth } : {}),
  };
}
