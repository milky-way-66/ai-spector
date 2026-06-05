import { join } from "node:path";
import { readFile } from "node:fs/promises";
import { access } from "node:fs/promises";
import type {
  PrototypeConfig,
  PrototypeManifest,
  PrototypeScreenMap,
  PrototypeScreenMapEntry,
} from "./types.js";
import { parseScreenIndexFromList } from "./parse-screen-index.js";
import {
  assertDefaultScreenInPool,
  resolveDefaultScreenId,
} from "./resolve-default-screen.js";
import { applyRouteDefaults, loadRouteDefaults } from "./route-defaults.js";
import { pathExists, readJson, writeJson } from "../util/fs.js";
import { loadDocflowConfig } from "../config/load.js";

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
}

export interface BuildPrototypeManifestResult {
  manifest: PrototypeManifest;
  screenMap: PrototypeScreenMap;
  screenCount: number;
  htmlCount: number;
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

  const manifestScreens = rows.map((r) => ({
    screenId: r.screenId,
    displayName: r.displayName,
    prototypeStem: r.prototypeStem,
    screenDoc: r.screenDoc,
    ...(r.purpose ? { purpose: r.purpose } : {}),
    ...(r.userRole ? { userRole: r.userRole } : {}),
  }));

  const buildMode = opts.config.buildMode ?? "static";
  const buildDest =
    buildMode === "spa"
      ? opts.config.buildDest?.trim() || `${opts.config.prototypeDir}/dist`
      : undefined;
  const spaEntryPath = buildDest ? `${buildDest}/index.html` : undefined;

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
  const previousScreensById = new Map<string, PrototypeScreenMapEntry>();
  if (await pathExists(screenMapPath)) {
    const prior = await readJson<PrototypeScreenMap>(screenMapPath);
    previousDefault = prior.defaultScreenId;
    previousBypassAuth = prior.prototypeBypassAuth;
    for (const s of prior.screens ?? []) {
      previousScreensById.set(s.screenId, s);
    }
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
      let effectivePath: string;
      let exists: boolean;
      if (buildMode === "spa" && spaEntryPath) {
        effectivePath = spaEntryPath;
        exists = spaIndexExists;
      } else {
        effectivePath = r.prototypePath;
        exists = await htmlExists(opts.projectRoot, r.prototypePath);
        if (exists) htmlCount++;
      }
      const baseUri =
        buildMode === "spa" ? `/${r.slug}` : `/src/${r.prototypeStem}.html`;
      const prior = previousScreensById.get(r.screenId);
      const routeApplied = applyRouteDefaults({
        screenId: r.screenId,
        slug: r.slug,
        buildMode,
        baseUri,
        fromFile: routeDefaults?.screens[r.screenId],
        fromPriorEntry: prior,
      });

      // Build per-language screenDocs map when project has multiple doc languages.
      // Values are paths relative to docs/<lang>/ so consumers resolve as:
      //   docs/<lang>/<screenDocs[lang]>   e.g. docs/vi/basic-design/screens/login.md
      let screenDocs: Record<string, string> | undefined;
      if (docLanguages.length > 1) {
        const docFilename = r.specFile ?? `${r.slug}.md`;
        // Strip "docs/" prefix and the lang segment from screenDetailDir to get the
        // lang-neutral relative path. e.g. "docs/basic-design/en/screens" → "basic-design/screens"
        const detailDir = opts.config.screenDetailDir.replace(/\\/g, "/").replace(/\/$/, "");
        const escapedCodes = docLanguages.map((c) => c.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
        const langSegmentRe = new RegExp(`(.*/)(?:${escapedCodes.join("|")})(/.*)$`);
        const match = langSegmentRe.exec(detailDir);
        if (match) {
          // prefix is everything before the lang segment (e.g. "docs/basic-design"),
          // suffix is everything after (e.g. "/screens").
          // Strip leading "docs" or "docs/" so the stored value is relative to docs/<lang>/.
          const prefix = match[1]!.replace(/\/$/, "").replace(/^docs(\/|$)/, "");
          const suffix = match[2]!; // e.g. "/screens"
          const langRelDir = prefix ? `${prefix}${suffix}` : suffix.replace(/^\//, "");
          const langRelPath = join(langRelDir, docFilename).replace(/\\/g, "/");
          screenDocs = Object.fromEntries(docLanguages.map((lang) => [lang, langRelPath]));
        }
      }

      return {
        screenId: r.screenId,
        displayName: r.displayName,
        screenDoc: r.screenDoc,
        ...(screenDocs ? { screenDocs } : {}),
        prototypeStem: r.prototypeStem,
        prototypePath: effectivePath,
        htmlExists: exists,
        ...routeApplied,
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

  const screenMap: PrototypeScreenMap = {
    schemaVersion: 1,
    themeName: opts.themeName,
    buildMode,
    generatedAt,
    ...(defaultScreenId ? { defaultScreenId } : {}),
    ...(prototypeBypassAuth !== undefined ? { prototypeBypassAuth } : {}),
    ...(buildDest ? { buildDest } : {}),
    ...(buildMode === "spa" && opts.config.buildSrc ? { buildSrc: opts.config.buildSrc } : {}),
    screens: mapScreens,
  };

  return {
    manifest,
    screenMap,
    screenCount: rows.length,
    htmlCount,
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
