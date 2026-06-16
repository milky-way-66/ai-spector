import { mkdir, writeFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { copyTree, pathExists, writeJson } from "../util/fs.js";
import { scaffoldBundleRoot } from "../config/load.js";
import {
  isPrototypeBasicAuthConfigured,
  loadPrototypeConfig,
  persistPrototypeBasicAuth,
  persistPrototypeDefaultScreen,
  persistPrototypeDefaultTheme,
  persistPrototypeTechStack,
  readPrototypeThemeName,
} from "../prototype/config.js";
import type { PrototypeTechStack } from "../prototype/types.js";
import { writeHtpasswdFile } from "../prototype/htpasswd.js";
import {
  buildPrototypeManifest,
  writePrototypeManifestFiles,
} from "../prototype/build-manifest.js";
import {
  assertThemeExists,
  installThemeDesign,
  listBundledThemes,
  readThemeSummary,
} from "../prototype/themes.js";
import {
  installThemePreviews,
  resolveThemePreviewPath,
  themeHasPreview,
} from "../prototype/theme-preview.js";
import { openInBrowser } from "../util/open-browser.js";
import { rewriteBuildAssetRefs } from "../prototype/rewrite-build-assets.js";
import {
  buildScreenMapFromPathMap,
  loadPathMapFile,
  PATH_MAP_FILE,
} from "../prototype/path-map.js";
import {
  formatPrototypeIssues,
  validatePrototype,
} from "../prototype/validate.js";
import type { PrototypeConfig, PrototypeScreenMap } from "../prototype/types.js";
import type { ReviewUrlContext } from "../prototype/review-url.js";

function reviewUrlOpts(opts: {
  reviewHost?: string;
  projectId?: string;
  deployVersion?: string;
  directReviewUrl?: boolean;
  /** CLI alias for deployVersion */
  version?: string;
}): ReviewUrlContext | undefined {
  const deployVersion = opts.deployVersion?.trim() || opts.version?.trim();
  if (
    !opts.reviewHost?.trim() &&
    !opts.projectId?.trim() &&
    !deployVersion &&
    opts.directReviewUrl === undefined
  ) {
    return undefined;
  }
  return {
    reviewHost: opts.reviewHost?.trim(),
    projectId: opts.projectId?.trim(),
    deployVersion,
    directReviewUrl: opts.directReviewUrl,
  };
}

function logScreenMapEntries(screenMap: PrototypeScreenMap): void {
  if (screenMap.directReviewUrl) {
    console.log("  directReviewUrl: true — reviewUrl copied from prototypePath (full URL)");
  } else if (screenMap.reviewHost) {
    const parts = [screenMap.projectId, screenMap.deployVersion].filter(Boolean).join("/");
    console.log(`  review base: ${screenMap.reviewHost}${parts ? `/${parts}` : ""}`);
  } else {
    console.log("Review URL pattern:");
    console.log("  https://{host}/{projectId?}/{deployVersion?}/{prototypePath}");
    console.log("  Set reviewHost in path-map.json or prototype config (projectId and deployVersion optional).");
  }
  console.log("");
  console.log("Screen mapping:");
  for (const s of screenMap.screens) {
    const status = s.route_exists ? "ready" : "pending";
    if (s.reviewUrl) {
      console.log(`  ${s.displayName.padEnd(24)} ${s.reviewUrl} (${status})`);
    } else {
      console.log(`  ${s.screenDocPath.padEnd(40)} → ${s.prototypePath} (${status})`);
    }
  }
}

export interface PrototypeThemesOptions {
  json?: boolean;
}

export async function runPrototypeThemes(opts: PrototypeThemesOptions = {}): Promise<void> {
  const themes = await listBundledThemes();
  if (opts.json) {
    const withPreview = await Promise.all(
      themes.map(async (name) => ({
        name,
        summary: await readThemeSummary(name),
        preview: await themeHasPreview(name),
      })),
    );
    console.log(JSON.stringify({ themes: withPreview }, null, 2));
    return;
  }
  console.log(`Bundled prototype themes (${themes.length}):`);
  for (const name of themes) {
    const summary = await readThemeSummary(name);
    const preview = (await themeHasPreview(name)) ? " [preview]" : "";
    console.log(summary ? `  ${name} — ${summary}${preview}` : `  ${name}${preview}`);
  }
  console.log("");
  console.log("Preview a theme: npx ai-spector prototype preview <name> [--open]");
  console.log("Use: npx ai-spector prototype setup --theme <name>");
}

const SUPPORTED_STACKS: PrototypeTechStack[] = [
  "html",
  "vue",
  "react",
  "nuxt",
  "next",
  "svelte",
  "angular",
];

export interface PrototypeStackOptions {
  root?: string;
  stack: string;
}

export async function runPrototypeStack(opts: PrototypeStackOptions): Promise<void> {
  const stack = opts.stack.trim().toLowerCase() as PrototypeTechStack;
  if (!SUPPORTED_STACKS.includes(stack)) {
    throw new Error(
      `Unknown tech stack "${stack}". Supported: ${SUPPORTED_STACKS.join(", ")}`,
    );
  }
  const { projectRoot } = await loadPrototypeConfig(opts.root);
  const config = await persistPrototypeTechStack(projectRoot, stack);
  console.log(`Tech stack set to "${stack}" (buildMode: ${config.buildMode})`);
  console.log(`  saved to .ai-spector/.docflow/config/prototype/config.json`);
}

export interface PrototypeAuthOptions {
  root?: string;
  username?: string;
  password?: string;
  fromConfig?: boolean;
}

export async function runPrototypeAuth(opts: PrototypeAuthOptions = {}): Promise<void> {
  const { projectRoot, config } = await loadPrototypeConfig(opts.root);

  let username = opts.username?.trim();
  let password = opts.password;

  if (opts.fromConfig) {
    if (!isPrototypeBasicAuthConfigured(config)) {
      throw new Error(
        "No basicAuth in prototype/config.json — run: npx ai-spector prototype auth --username <u> --password <p>",
      );
    }
    username = config.basicAuth.username;
    password = config.basicAuth.password;
  }

  if (!username || !password) {
    throw new Error(
      "username and password required: npx ai-spector prototype auth --username <u> --password <p>",
    );
  }

  const next = await persistPrototypeBasicAuth(projectRoot, { username, password });
  const htpasswdPath = join(projectRoot, next.htpasswdFile);
  await writeHtpasswdFile(htpasswdPath, username, password);

  console.log(`Prototype basic auth configured for user "${username}"`);
  console.log(`  credentials: .ai-spector/.docflow/config/prototype/config.json (basicAuth)`);
  console.log(`  htpasswd: ${next.htpasswdFile}`);
}

export interface PrototypeSetupOptions {
  root?: string;
  theme?: string;
  emitManifest?: boolean;
  forceDesign?: boolean;
}

export async function runPrototypeSetup(opts: PrototypeSetupOptions = {}): Promise<void> {
  const { projectRoot, config } = await loadPrototypeConfig(opts.root);
  const theme =
    opts.theme?.trim() ||
    (await readPrototypeThemeName(projectRoot, config)) ||
    config.defaultTheme;

  await assertThemeExists(theme);

  const prototypeRoot = join(projectRoot, config.prototypeDir);
  const srcDir = join(projectRoot, config.srcDir);
  await mkdir(srcDir, { recursive: true });

  const scaffoldProto = join(scaffoldBundleRoot(), "prototype");
  if (await pathExists(scaffoldProto)) {
    for (const name of [
      "README.md",
      "CLAUDE.md",
      "route-defaults.example.json",
      "path-map.example.json",
      "path-map.example-flat.json",
    ]) {
      const dest = join(prototypeRoot, name);
      const src = join(scaffoldProto, name);
      if (await pathExists(src) && !(await pathExists(dest))) {
        await copyTree(src, dest);
      }
    }
  }

  const designPath = join(prototypeRoot, "DESIGN.md");
  if (opts.forceDesign || !(await pathExists(designPath))) {
    await installThemeDesign(theme, designPath);
  }

  await writeJson(join(prototypeRoot, "theme.json"), {
    schemaVersion: 1,
    themeName: theme,
    installedAt: new Date().toISOString(),
    designSource: `ai-spector:assets/themes/${theme}/DESIGN.md`,
  });

  if (opts.theme?.trim()) {
    await persistPrototypeDefaultTheme(projectRoot, theme);
  }

  const gitkeep = join(srcDir, ".gitkeep");
  if (!(await pathExists(gitkeep))) {
    await writeFile(gitkeep, "");
  }

  const manifestPath = join(prototypeRoot, "manifest.json");
  let manifestDetail = "skipped (no list-screens yet)";
  if (opts.emitManifest !== false && (await pathExists(join(projectRoot, config.listScreenDoc)))) {
    const built = await buildPrototypeManifest({
      projectRoot,
      config,
      themeName: theme,
    });
    const paths = await writePrototypeManifestFiles(projectRoot, config, built);
    manifestDetail = `${built.screenCount} screen(s) → ${paths.manifestPath}`;
  } else if (!(await pathExists(manifestPath))) {
    const generatedAt = new Date().toISOString();
    await writeJson(manifestPath, {
      schemaVersion: 1,
      themeName: theme,
      generatedAt,
      screens: [],
    });
    await writeJson(join(prototypeRoot, "screen-map.json"), {
      schemaVersion: 1,
      themeName: theme,
      generatedAt,
      screens: [],
    });
    manifestDetail = "empty manifest (add list-screens.md, then: npx ai-spector prototype manifest)";
  }

  console.log(`Prototype workspace ready at ${prototypeRoot}`);
  console.log(`  theme: ${theme}`);
  console.log(`  DESIGN.md ← assets/themes/${theme}/DESIGN.md`);
  console.log(`  HTML output: ${config.srcDir}/<stem>.html`);
  console.log(`  manifest: ${manifestDetail}`);
  console.log("");
  console.log("Next: run /generate-prototype in Cursor, then:");
  console.log("  npx ai-spector prototype manifest");
  console.log("  npx ai-spector prototype validate --strict");
}

export interface PrototypeManifestOptions {
  root?: string;
  theme?: string;
  defaultScreen?: string;
  reviewHost?: string;
  projectId?: string;
  version?: string;
  directReviewUrl?: boolean;
  dryRun?: boolean;
  json?: boolean;
  /** Treat validation warnings as errors (same as validate --strict). */
  strict?: boolean;
}

export async function runPrototypeManifest(
  opts: PrototypeManifestOptions = {},
): Promise<void> {
  const { projectRoot, config } = await loadPrototypeConfig(opts.root);
  const theme =
    opts.theme?.trim() ||
    (await readPrototypeThemeName(projectRoot, config)) ||
    config.defaultTheme;
  await assertThemeExists(theme);

  const defaultScreen = opts.defaultScreen?.trim();
  if (defaultScreen) {
    await persistPrototypeDefaultScreen(projectRoot, defaultScreen);
  }
  const { config: configAfterDefault } = await loadPrototypeConfig(projectRoot);

  const built = await buildPrototypeManifest({
    projectRoot,
    config: configAfterDefault,
    themeName: theme,
    defaultScreenId: defaultScreen,
    reviewUrl: reviewUrlOpts(opts),
  });

  if (opts.dryRun) {
    const payload = { manifest: built.manifest, screenMap: built.screenMap };
    if (opts.json) {
      console.log(JSON.stringify(payload, null, 2));
    } else {
      console.log(`Dry run: ${built.screenCount} screen(s), ${built.htmlCount} HTML file(s) present`);
      console.log(JSON.stringify(built.manifest.screens, null, 2));
    }
    return;
  }

  const paths = await writePrototypeManifestFiles(projectRoot, config, built);
  if (opts.json) {
    console.log(
      JSON.stringify(
        {
          manifestPath: paths.manifestPath,
          screenMapPath: paths.screenMapPath,
          screenCount: built.screenCount,
          htmlCount: built.htmlCount,
        },
        null,
        2,
      ),
    );
    return;
  }

  const buildMode = built.screenMap.buildMode;
  const htmlLabel =
    buildMode === "spa"
      ? `${built.htmlCount > 0 ? "build present" : "build missing"}`
      : `${built.htmlCount}/${built.screenCount} HTML present`;
  console.log(`Wrote ${paths.manifestPath} (${built.screenCount} screens)`);
  console.log(`Wrote ${paths.screenMapPath} (${htmlLabel})`);
  for (const warning of built.warnings) {
    console.warn(`Warning: ${warning}`);
  }
  if (built.screenMap.buildMode === "spa" && built.screenMap.buildDest) {
    console.log(`  buildDest: ${built.screenMap.buildDest}`);
  }
  if (built.screenMap.defaultScreen) {
    const entry = built.screenMap.defaultScreen;
    console.log(`  default screen: ${entry.displayName} (${entry.prototypePath})`);
  } else if (built.screenMap.defaultScreenId) {
    console.log(`  default screen: ${built.screenMap.defaultScreenId}`);
  }
  if (built.screenMap.screens.some((s) => s.reviewUrl)) {
    console.log("");
    logScreenMapEntries(built.screenMap);
  }

  if (opts.strict) {
    const issues = await validatePrototype({
      projectRoot,
      config: configAfterDefault,
      strict: true,
    });
    const errors = issues.filter((i) => i.severity === "error");
    if (issues.length > 0) {
      console.log("");
      console.log(formatPrototypeIssues(issues));
    }
    if (errors.length > 0) {
      throw new Error(`Prototype manifest validation failed (${errors.length} error(s))`);
    }
  }
}

export interface PrototypeMapOptions {
  root?: string;
  /** Input file (default: prototype/path-map.json). */
  from?: string;
  theme?: string;
  reviewHost?: string;
  projectId?: string;
  version?: string;
  directReviewUrl?: boolean;
  dryRun?: boolean;
  strict?: boolean;
  json?: boolean;
}

export async function runPrototypeMap(opts: PrototypeMapOptions = {}): Promise<void> {
  const { projectRoot, config } = await loadPrototypeConfig(opts.root);
  const fromRel =
    opts.from?.trim() || join(config.prototypeDir, PATH_MAP_FILE).replace(/\\/g, "/");
  const fromAbs = join(projectRoot, fromRel);
  if (!(await pathExists(fromAbs))) {
    throw new Error(
      `Missing ${fromRel}. Copy prototype/path-map.example.json → prototype/path-map.json and fill deploy paths.`,
    );
  }

  const pathMap = await loadPathMapFile(projectRoot, fromRel);
  if (!pathMap) {
    throw new Error(`Could not read ${fromRel}`);
  }

  const theme =
    opts.theme?.trim() ||
    (await readPrototypeThemeName(projectRoot, config)) ||
    config.defaultTheme;

  const built = await buildScreenMapFromPathMap({
    projectRoot,
    config,
    pathMap,
    themeName: theme,
    strict: opts.strict,
    reviewUrl: reviewUrlOpts(opts),
  });

  const screenMapPath = join(projectRoot, config.prototypeDir, "screen-map.json");

  if (opts.dryRun || opts.json) {
    const payload = {
      screenMapPath,
      source: fromRel,
      hosted: pathMap.hosted ?? false,
      screenCount: built.screenMap.screens.length,
      missingScreenIds: built.missingScreenIds,
      warnings: built.warnings,
      screenMap: built.screenMap,
    };
    console.log(JSON.stringify(payload, null, 2));
    if (opts.dryRun) {
      return;
    }
  }

  await writeJson(screenMapPath, built.screenMap);

  console.log(`Wrote ${screenMapPath} from ${fromRel} (${built.screenMap.screens.length} screen(s))`);
  if (pathMap.hosted) {
    console.log("  hosted: true — route_exists defaults to true (prototype on server, not in repo)");
  }
  console.log(`  buildMode: ${built.screenMap.buildMode}`);
  if (built.screenMap.defaultScreen) {
    const entry = built.screenMap.defaultScreen;
    console.log(`  default screen: ${entry.displayName} (${entry.prototypePath})`);
  } else if (built.screenMap.defaultScreenId) {
    console.log(`  default screen: ${built.screenMap.defaultScreenId}`);
  }
  console.log("");
  logScreenMapEntries(built.screenMap);
  for (const warning of built.warnings) {
    console.warn(`Warning: ${warning}`);
  }
  if (built.missingScreenIds.length > 0 && !opts.strict) {
    console.warn(
      `Skipped ${built.missingScreenIds.length} screen(s) without prototypePath in ${PATH_MAP_FILE}`,
    );
  }
}

export interface PrototypeValidateOptions {
  root?: string;
  strict?: boolean;
  json?: boolean;
  skipExternalCheck?: boolean;
}

export async function runPrototypeValidate(
  opts: PrototypeValidateOptions = {},
): Promise<void> {
  const { projectRoot, config } = await loadPrototypeConfig(opts.root);
  const issues = await validatePrototype({
    projectRoot,
    config,
    strict: opts.strict,
    checkExternalAssets: !opts.skipExternalCheck,
  });
  const errors = issues.filter((i) => i.severity === "error");

  if (opts.json) {
    console.log(JSON.stringify({ ok: errors.length === 0, issues }, null, 2));
  } else {
    console.log(formatPrototypeIssues(issues));
  }

  if (errors.length > 0) {
    throw new Error(`Prototype validation failed (${errors.length} error(s))`);
  }
}

export interface PrototypePreviewOptions {
  theme: string;
  open?: boolean;
  json?: boolean;
}

export async function runPrototypePreview(opts: PrototypePreviewOptions): Promise<string> {
  const theme = opts.theme.trim();
  await assertThemeExists(theme);

  const previewPath = resolveThemePreviewPath(theme);
  if (!(await pathExists(previewPath))) {
    throw new Error(
      `No preview for theme "${theme}". Expected ${previewPath}`,
    );
  }

  const fileUrl = `file://${previewPath}`;
  if (opts.json) {
    console.log(JSON.stringify({ theme, previewPath, fileUrl }, null, 2));
    return previewPath;
  }

  console.log(`Theme preview: ${theme}`);
  console.log(`  ${previewPath}`);
  console.log("");
  console.log("Open in browser:");
  console.log(`  ${fileUrl}`);

  if (opts.open) {
    await openInBrowser(previewPath);
  }

  return previewPath;
}

export interface PrototypeSyncOptions {
  root?: string;
  /** Override config.buildSrc */
  from?: string;
  /** Override config.buildDest */
  to?: string;
  /** Do not copy files — only regenerate screen-map.json */
  skipCopy?: boolean;
  /** Remove buildDest before copying (clean sync) */
  clean?: boolean;
  json?: boolean;
}

export async function runPrototypeSync(opts: PrototypeSyncOptions = {}): Promise<void> {
  const { projectRoot, config } = await loadPrototypeConfig(opts.root);

  const buildSrc = opts.from?.trim() || config.buildSrc?.trim();
  const buildDest =
    opts.to?.trim() || config.buildDest?.trim() || `${config.prototypeDir}/dist`;

  if (!opts.skipCopy) {
    if (!buildSrc) {
      throw new Error(
        "No build source configured. Pass --from <path> or set buildSrc in prototype/config.json.",
      );
    }
    const srcAbs = join(projectRoot, buildSrc);
    if (!(await pathExists(srcAbs))) {
      throw new Error(
        `Build source not found: ${buildSrc}\nRun your framework build first (e.g. npm run build), then retry.`,
      );
    }
    const destAbs = join(projectRoot, buildDest);
    if (opts.clean && (await pathExists(destAbs))) {
      await rm(destAbs, { recursive: true, force: true });
    }
    await mkdir(destAbs, { recursive: true });
    await copyTree(srcAbs, destAbs);
    const rewriteResult = await rewriteBuildAssetRefs(destAbs);
    if (!opts.json) {
      console.log(`Copied ${buildSrc} → ${buildDest}`);
      if (rewriteResult.filesRewritten > 0) {
        console.log(
          `Rewrote root-absolute asset paths in ${rewriteResult.filesRewritten} HTML file(s) (./ relative)`,
        );
      }
    }
  }

  // Regenerate manifest + screen-map with updated route_exists / prototypePath
  const theme =
    (await readPrototypeThemeName(projectRoot, config)) || config.defaultTheme;
  const built = await buildPrototypeManifest({ projectRoot, config, themeName: theme });
  const paths = await writePrototypeManifestFiles(projectRoot, config, built);

  if (opts.json) {
    console.log(
      JSON.stringify(
        {
          buildSrc: buildSrc ?? null,
          buildDest,
          skipCopy: opts.skipCopy ?? false,
          screenMapPath: paths.screenMapPath,
          screenCount: built.screenCount,
          prototypeBypassAuth: built.screenMap.prototypeBypassAuth,
          screens: built.screenMap.screens.map((s) => ({
            screenId: s.screenId,
            displayName: s.displayName,
            screenDocPath: s.screenDocPath,
            prototypePath: s.prototypePath,
            route_exists: s.route_exists,
            buildDest,
          })),
        },
        null,
        2,
      ),
    );
    return;
  }

  console.log(`Updated ${paths.screenMapPath}`);
  console.log(`  buildMode: ${config.buildMode ?? "static"}`);
  console.log(`  buildDest: ${buildDest}`);
  console.log("");
  console.log("Screen mapping:");
  for (const s of built.screenMap.screens) {
    const status = s.route_exists ? "ready" : "pending";
    console.log(`  ${s.screenDocPath.padEnd(40)} → ${s.prototypePath} (${status})`);
  }
  if (built.screenMap.prototypeBypassAuth) {
    console.log("");
    console.log("  prototypeBypassAuth: true — SPA should allow direct prototypePath access without login");
  }
}

export interface PrototypeInstallPreviewsOptions {
  from?: string;
  dryRun?: boolean;
  json?: boolean;
}

export async function runPrototypeInstallPreviews(
  opts: PrototypeInstallPreviewsOptions = {},
): Promise<void> {
  const result = await installThemePreviews({
    from: opts.from,
    dryRun: opts.dryRun,
  });

  if (opts.json) {
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  const label = opts.dryRun ? "Would install" : "Installed";
  console.log(`${label} theme previews from ${result.stagingRoot}`);
  console.log(`  moved: ${result.moved.length}`);
  if (result.moved.length > 0) {
    console.log(`    ${result.moved.join(", ")}`);
  }
  if (result.skipped.length > 0) {
    console.log(`  skipped (preview.html exists): ${result.skipped.join(", ")}`);
  }
  if (result.missingTheme.length > 0) {
    console.log(`  no theme folder: ${result.missingTheme.join(", ")}`);
  }
}
