import { join } from "node:path";
import { readFile } from "node:fs/promises";
import { access } from "node:fs/promises";
import type {
  PrototypeConfig,
  PrototypeManifest,
  PrototypeScreenMap,
} from "./types.js";
import { parseScreenIndexFromList } from "./parse-screen-index.js";
import {
  assertDefaultScreenInPool,
  finalizeScreenMap,
  resolveDefaultScreenId,
} from "./resolve-default-screen.js";
import { applyRouteDefaults, loadRouteDefaults } from "./route-defaults.js";
import { pathExists, readJson, writeJson } from "../util/fs.js";
import { loadDocflowConfig } from "../config/load.js";
import { buildScreenDocPaths } from "./screen-doc-paths.js";
import { toDeployBasePath, toDeployPrototypePath, toSpaScreenPrototypePath } from "./deploy-path.js";
import {
  enrichScreenMapWithReviewUrls,
  type ReviewUrlContext,
} from "./review-url.js";

async function htmlExists(projectRoot: string, relativePath: string): Promise<boolean> {
  try {
    await access(join(projectRoot, relativePath));
    return true;
  } catch {
    return false;
  }
}

export interface BuildPrototypeManifestOptions {
  projectRoot: string;
  config: PrototypeConfig;
  themeName: string;
  /** Override default entry screen (Screen Index id). */
  defaultScreenId?: string;
  reviewUrl?: ReviewUrlContext;
}

export interface BuildPrototypeManifestResult {
  manifest: PrototypeManifest;
  screenMap: PrototypeScreenMap;
  screenCount: number;
  htmlCount: number;
  warnings: string[];
}

export async function buildPrototypeManifest(
  opts: BuildPrototypeManifestOptions,
): Promise<BuildPrototypeManifestResult> {
  const listPath = join(opts.projectRoot, opts.config.listScreenDoc);
  if (!(await pathExists(listPath))) {
    throw new Error(
      `Missing ${opts.config.listScreenDoc}. Run /generate-basic-design (list + screen details) first.`,
    );
  }
  const listMarkdown = await readFile(listPath, "utf8");
  const rows = parseScreenIndexFromList({
    projectRoot: opts.projectRoot,
    config: opts.config,
    listMarkdown,
  });
  if (rows.length === 0) {
    throw new Error(
      `No screens found in ${opts.config.listScreenDoc} (${opts.config.screenIndexSection}). Add rows to the Screen Index table.`,
    );
  }

  const generatedAt = new Date().toISOString();
  let htmlCount = 0;
  const warnings: string[] = [];

  const manifestScreens = rows.map((r) => ({
    screenId: r.screenId,
    displayName: r.displayName,
    prototypeStem: r.prototypeStem,
    screenDoc: r.screenDoc,
    ...(r.purpose ? { purpose: r.purpose } : {}),
    ...(r.userRole ? { userRole: r.userRole } : {}),
  }));

  const buildMode = opts.config.buildMode ?? "static";
  const repoBuildDest =
    buildMode === "spa"
      ? opts.config.buildDest?.trim() || `${opts.config.prototypeDir}/dist`
      : undefined;
  const deployBuildDest = repoBuildDest
    ? toDeployBasePath(repoBuildDest, opts.config.prototypeDir)
    : undefined;
  const spaEntryPath = repoBuildDest ? `${repoBuildDest}/index.html` : undefined;

  // Load docflow languages for multi-lang screenDocs (best-effort; ignore if config missing).
  let docLanguages: string[] = [];
  try {
    const { config: docflow } = await loadDocflowConfig(opts.projectRoot);
    docLanguages = docflow.languages.map((l) => l.code);
  } catch {
    // No docflow config — single-lang fallback
  }

  const routeDefaults = await loadRouteDefaults(
    opts.projectRoot,
    opts.config.prototypeDir,
  );

  const screenMapPath = join(
    opts.projectRoot,
    opts.config.prototypeDir,
    "screen-map.json",
  );
  let previousDefault: string | undefined;
  let previousBypassAuth: boolean | undefined;
  let previousReview: ReviewUrlContext | undefined;
  if (await pathExists(screenMapPath)) {
    const prior = await readJson<PrototypeScreenMap>(screenMapPath);
    previousDefault = prior.defaultScreenId;
    previousBypassAuth = prior.prototypeBypassAuth;
    previousReview = {
      reviewHost: prior.reviewHost,
      projectId: prior.projectId,
      deployVersion: prior.deployVersion,
      directReviewUrl: prior.directReviewUrl,
    };
  }

  // For SPA mode, htmlExists is shared across all screens — check once.
  const spaIndexExists = spaEntryPath
    ? await htmlExists(opts.projectRoot, spaEntryPath)
    : false;
  // SPA: count 1 if the build entrypoint exists (not N×screens), or 0.
  if (buildMode === "spa") {
    htmlCount = spaIndexExists ? 1 : 0;
  }

  const mapScreens = await Promise.all(
    rows.map(async (r) => {
      let exists: boolean;
      if (buildMode === "spa" && spaEntryPath) {
        exists = spaIndexExists;
      } else {
        exists = await htmlExists(opts.projectRoot, r.prototypePath);
        if (exists) htmlCount++;
      }
      const baseUri =
        buildMode === "spa" ? `/${r.slug}` : `/src/${r.prototypeStem}.html`;
      const routeApplied = applyRouteDefaults({
        screenId: r.screenId,
        slug: r.slug,
        buildMode,
        baseUri,
        fromFile: routeDefaults?.screens[r.screenId],
      });

      const effectivePath =
        buildMode === "spa" && deployBuildDest
          ? toSpaScreenPrototypePath(
              deployBuildDest,
              routeApplied.previewUri ?? routeApplied.uri,
            )
          : toDeployPrototypePath(r.prototypePath, opts.config.prototypeDir);

      const docFilename = r.specFile ?? `${r.slug}.md`;
      const { screenDocPath, screenDocs } = buildScreenDocPaths({
        screenDetailDir: opts.config.screenDetailDir,
        docFilename,
        docLanguages,
      });

      if (!(await pathExists(join(opts.projectRoot, r.screenDoc)))) {
        warnings.push(
          `Screen design doc missing for "${r.displayName}" (${r.screenId}): ${r.screenDoc}. ` +
            `If the filename differs from the slug, add a "Spec file" column in ${opts.config.listScreenDoc}.`,
        );
      }

      return {
        screenId: r.screenId,
        displayName: r.displayName,
        screenDocPath,
        ...(screenDocs ? { screenDocs } : {}),
        prototypePath: effectivePath,
        route_exists: exists,
      };
    }),
  );

  const manifest: PrototypeManifest = {
    schemaVersion: 1,
    themeName: opts.themeName,
    generatedAt,
    screens: manifestScreens,
  };

  if (opts.defaultScreenId?.trim()) {
    assertDefaultScreenInPool(opts.defaultScreenId, mapScreens);
  }

  const defaultScreenId = resolveDefaultScreenId(mapScreens, {
    explicit: opts.defaultScreenId,
    previous: previousDefault,
    configDefault: opts.config.defaultScreenId,
  });

  const prototypeBypassAuth =
    routeDefaults?.prototypeBypassAuth ??
    previousBypassAuth ??
    (buildMode === "spa" ? opts.config.prototypeBypassAuth ?? true : undefined);

  const screenMap = finalizeScreenMap(
    enrichScreenMapWithReviewUrls(
      {
        schemaVersion: 1,
        themeName: opts.themeName,
        buildMode,
        generatedAt,
        ...(defaultScreenId ? { defaultScreenId } : {}),
        ...(prototypeBypassAuth !== undefined ? { prototypeBypassAuth } : {}),
        ...(deployBuildDest ? { buildDest: deployBuildDest } : {}),
        ...(buildMode === "spa" && opts.config.buildSrc ? { buildSrc: opts.config.buildSrc } : {}),
        screens: mapScreens,
      },
      [opts.reviewUrl, previousReview, opts.config],
    ),
  );

  return {
    manifest,
    screenMap,
    screenCount: rows.length,
    htmlCount,
    warnings,
  };
}

export async function writePrototypeManifestFiles(
  projectRoot: string,
  config: PrototypeConfig,
  result: BuildPrototypeManifestResult,
): Promise<{ manifestPath: string; screenMapPath: string }> {
  const manifestPath = join(projectRoot, config.prototypeDir, "manifest.json");
  const screenMapPath = join(projectRoot, config.prototypeDir, "screen-map.json");
  await writeJson(manifestPath, result.manifest);
  await writeJson(screenMapPath, result.screenMap);
  return { manifestPath, screenMapPath };
}
