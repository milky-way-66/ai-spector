import { join } from "node:path";
import { readFile } from "node:fs/promises";
import type {
  PrototypeBuildMode,
  PrototypeConfig,
  PrototypeScreenMap,
  PrototypeScreenMapEntry,
} from "./types.js";
import { parseScreenIndexFromList } from "./parse-screen-index.js";
import { buildScreenDocPaths } from "./screen-doc-paths.js";
import { loadDocflowConfig } from "../config/load.js";
import { pathExists, readJson } from "../util/fs.js";
import { finalizeScreenMap, resolveDefaultScreenId } from "./resolve-default-screen.js";
import {
  enrichScreenMapWithReviewUrls,
  type ReviewUrlContext,
} from "./review-url.js";

export const PATH_MAP_FILE = "path-map.json";

export interface PrototypePathMapScreen {
  /** Deploy-relative path under `{project}/{version}/` (e.g. `dist/login`, `src/login.html`). */
  prototypePath: string;
  /** Override hosted default; omit to use file-level `hosted`. */
  route_exists?: boolean;
}

export interface PrototypePathMapFile {
  schemaVersion: 1;
  buildMode?: PrototypeBuildMode;
  defaultScreenId?: string;
  prototypeBypassAuth?: boolean;
  buildDest?: string;
  /**
   * Prototype is already hosted on the server (not in this repo).
   * Screens default to `route_exists: true` unless overridden per screen.
   */
  hosted?: boolean;
  reviewHost?: string;
  projectId?: string;
  deployVersion?: string;
  /**
   * When true, `prototypePath` per screen is a full URL copied into `reviewUrl` as-is.
   */
  directReviewUrl?: boolean;
  screens: Record<string, PrototypePathMapScreen>;
}

export interface BuildScreenMapFromPathMapOptions {
  projectRoot: string;
  config: PrototypeConfig;
  pathMap: PrototypePathMapFile;
  themeName?: string;
  strict?: boolean;
  reviewUrl?: ReviewUrlContext;
}

export interface BuildScreenMapFromPathMapResult {
  screenMap: PrototypeScreenMap;
  warnings: string[];
  missingScreenIds: string[];
}

/** Strip leading slash; drop trailing slash on route paths (keep `.html` paths as-is). */
export function normalizeDeployPrototypePath(path: string): string {
  let normalized = path.replace(/\\/g, "/").trim().replace(/^\/+/, "");
  if (/\.html?$/i.test(normalized)) {
    return normalized;
  }
  return normalized.replace(/\/+$/, "");
}

export function pathMapFilePath(prototypeDir: string): string {
  return join(prototypeDir, PATH_MAP_FILE);
}

export async function loadPathMapFile(
  projectRoot: string,
  relativePath: string,
): Promise<PrototypePathMapFile | undefined> {
  const path = join(projectRoot, relativePath);
  if (!(await pathExists(path))) {
    return undefined;
  }
  const raw = await readJson<PrototypePathMapFile>(path);
  if (raw.schemaVersion !== 1 || !raw.screens) {
    throw new Error(`Invalid ${relativePath}: schemaVersion must be 1 and screens required`);
  }
  return raw;
}

export async function buildScreenMapFromPathMap(
  opts: BuildScreenMapFromPathMapOptions,
): Promise<BuildScreenMapFromPathMapResult> {
  const listPath = join(opts.projectRoot, opts.config.listScreenDoc);
  if (!(await pathExists(listPath))) {
    throw new Error(
      `Missing ${opts.config.listScreenDoc}. Add basic design Screen Index before mapping paths.`,
    );
  }
  const listMarkdown = await readFile(listPath, "utf8");
  const rows = parseScreenIndexFromList({
    projectRoot: opts.projectRoot,
    config: opts.config,
    listMarkdown,
  });
  if (rows.length === 0) {
    throw new Error(`No screens found in ${opts.config.listScreenDoc}.`);
  }

  let docLanguages: string[] = [];
  try {
    const { config: docflow } = await loadDocflowConfig(opts.projectRoot);
    docLanguages = docflow.languages.map((l) => l.code);
  } catch {
    // single-lang fallback
  }

  const buildMode = opts.pathMap.buildMode ?? opts.config.buildMode ?? "static";
  const hostedDefault = opts.pathMap.hosted ?? false;
  const warnings: string[] = [];
  const missingScreenIds: string[] = [];
  const mapScreens: PrototypeScreenMapEntry[] = [];

  for (const row of rows) {
    const mapped = opts.pathMap.screens[row.screenId];
    if (!mapped?.prototypePath?.trim()) {
      missingScreenIds.push(row.screenId);
      if (opts.strict) {
        continue;
      }
      warnings.push(
        `No prototypePath for "${row.displayName}" (${row.screenId}) in ${PATH_MAP_FILE} — skipped`,
      );
      continue;
    }

    const docFilename = row.specFile ?? `${row.slug}.md`;
    const { screenDocPath, screenDocs } = buildScreenDocPaths({
      screenDetailDir: opts.config.screenDetailDir,
      docFilename,
      docLanguages,
    });

    if (!(await pathExists(join(opts.projectRoot, row.screenDoc)))) {
      warnings.push(
        `Screen design doc missing for "${row.displayName}" (${row.screenId}): ${row.screenDoc}`,
      );
    }

    mapScreens.push({
      screenId: row.screenId,
      displayName: row.displayName,
      screenDocPath,
      ...(screenDocs ? { screenDocs } : {}),
      prototypePath: opts.pathMap.directReviewUrl
        ? mapped.prototypePath.trim()
        : normalizeDeployPrototypePath(mapped.prototypePath),
      route_exists: mapped.route_exists ?? hostedDefault,
    });
  }

  if (opts.strict && missingScreenIds.length > 0) {
    throw new Error(
      `Missing prototypePath for ${missingScreenIds.length} screen(s) in ${PATH_MAP_FILE}: ${missingScreenIds.join(", ")}`,
    );
  }

  if (mapScreens.length === 0) {
    throw new Error(`No screens mapped. Fill ${PATH_MAP_FILE} and retry.`);
  }

  const defaultScreenId = resolveDefaultScreenId(mapScreens, {
    explicit: opts.pathMap.defaultScreenId,
    configDefault: opts.config.defaultScreenId,
  });

  const prototypeBypassAuth =
    opts.pathMap.prototypeBypassAuth ??
    (buildMode === "spa" ? opts.config.prototypeBypassAuth ?? true : undefined);

  const screenMap = finalizeScreenMap(
    enrichScreenMapWithReviewUrls(
      {
        schemaVersion: 1,
        themeName: opts.themeName?.trim() || opts.config.defaultTheme || "external",
        buildMode,
        generatedAt: new Date().toISOString(),
        ...(defaultScreenId ? { defaultScreenId } : {}),
        ...(prototypeBypassAuth !== undefined ? { prototypeBypassAuth } : {}),
        ...(opts.pathMap.buildDest ? { buildDest: opts.pathMap.buildDest } : {}),
        screens: mapScreens,
      },
      [opts.reviewUrl, opts.pathMap, opts.config],
    ),
  );

  return { screenMap, warnings, missingScreenIds };
}
