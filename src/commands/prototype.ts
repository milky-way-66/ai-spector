import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { copyTree, pathExists, writeJson } from "../util/fs.js";
import { scaffoldBundleRoot } from "../config/load.js";
import { loadPrototypeConfig, readPrototypeThemeName } from "../prototype/config.js";
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
  formatPrototypeIssues,
  validatePrototype,
} from "../prototype/validate.js";

export interface PrototypeThemesOptions {
  json?: boolean;
}

export async function runPrototypeThemes(opts: PrototypeThemesOptions = {}): Promise<void> {
  const themes = await listBundledThemes();
  if (opts.json) {
    console.log(JSON.stringify({ themes }, null, 2));
    return;
  }
  console.log(`Bundled prototype themes (${themes.length}):`);
  for (const name of themes) {
    const summary = await readThemeSummary(name);
    console.log(summary ? `  ${name} — ${summary}` : `  ${name}`);
  }
  console.log("");
  console.log("Use: ai-spector prototype setup --theme <name>");
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
    for (const name of ["README.md", "CLAUDE.md"]) {
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
    manifestDetail = "empty manifest (add list-screens.md, then: ai-spector prototype manifest)";
  }

  console.log(`Prototype workspace ready at ${prototypeRoot}`);
  console.log(`  theme: ${theme}`);
  console.log(`  DESIGN.md ← assets/themes/${theme}/DESIGN.md`);
  console.log(`  HTML output: ${config.srcDir}/<stem>.html`);
  console.log(`  manifest: ${manifestDetail}`);
  console.log("");
  console.log("Next: run /generate-prototype in Cursor, then:");
  console.log("  ai-spector prototype manifest");
  console.log("  ai-spector prototype validate --strict");
}

export interface PrototypeManifestOptions {
  root?: string;
  theme?: string;
  dryRun?: boolean;
  json?: boolean;
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

  const built = await buildPrototypeManifest({
    projectRoot,
    config,
    themeName: theme,
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

  console.log(`Wrote ${paths.manifestPath} (${built.screenCount} screens)`);
  console.log(`Wrote ${paths.screenMapPath} (${built.htmlCount}/${built.screenCount} HTML present)`);
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
