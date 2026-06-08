import { readdir, rename } from "node:fs/promises";
import { basename, join } from "node:path";
import { packageBundleRoot, themesBundleRoot } from "../config/load.js";
import { pathExists } from "../util/fs.js";

const PREVIEW_FILENAME = "preview.html";

function sanitizeThemeName(themeName: string): string {
  const safe = themeName.replace(/[^a-zA-Z0-9._-]/g, "");
  if (!safe || safe !== themeName) {
    throw new Error(`Invalid theme name: ${themeName}`);
  }
  return safe;
}

export function resolveThemePreviewPath(themeName: string): string {
  return join(themesBundleRoot(), sanitizeThemeName(themeName), PREVIEW_FILENAME);
}

export async function themeHasPreview(themeName: string): Promise<boolean> {
  return pathExists(resolveThemePreviewPath(themeName));
}

/** Legacy staging dirs (`assets/preview/themes` or accidental `assets/preview /themes`). */
export async function resolveThemePreviewsStagingRoot(
  explicitFrom?: string,
): Promise<string | undefined> {
  if (explicitFrom?.trim()) {
    const from = explicitFrom.trim();
    return (await pathExists(from)) ? from : undefined;
  }
  const root = packageBundleRoot();
  const candidates = [
    join(root, "assets", "preview", "themes"),
    join(root, "assets", "preview ", "themes"),
  ];
  for (const candidate of candidates) {
    if (await pathExists(candidate)) {
      return candidate;
    }
  }
  return undefined;
}

export interface InstallThemePreviewsResult {
  stagingRoot: string;
  moved: string[];
  skipped: string[];
  missingTheme: string[];
}

export interface InstallThemePreviewsOptions {
  from?: string;
  themesRoot?: string;
  dryRun?: boolean;
}

export async function installThemePreviews(
  opts: InstallThemePreviewsOptions = {},
): Promise<InstallThemePreviewsResult> {
  const stagingRoot = await resolveThemePreviewsStagingRoot(opts.from);
  if (!stagingRoot) {
    const hint = opts.from?.trim()
      ? `Path not found: ${opts.from.trim()}`
      : "No staging folder (expected assets/preview/themes/)";
    throw new Error(hint);
  }

  const themesRoot = opts.themesRoot ?? themesBundleRoot();
  const entries = await readdir(stagingRoot, { withFileTypes: true });
  const moved: string[] = [];
  const skipped: string[] = [];
  const missingTheme: string[] = [];

  for (const ent of entries) {
    if (!ent.isFile() || !ent.name.endsWith(".html")) {
      continue;
    }
    const themeName = basename(ent.name, ".html");
    const themeDir = join(themesRoot, themeName);
    const dest = join(themeDir, PREVIEW_FILENAME);
    const src = join(stagingRoot, ent.name);

    if (!(await pathExists(themeDir))) {
      missingTheme.push(themeName);
      continue;
    }

    if (await pathExists(dest)) {
      skipped.push(themeName);
      continue;
    }

    if (!opts.dryRun) {
      await rename(src, dest);
    }
    moved.push(themeName);
  }

  return { stagingRoot, moved, skipped, missingTheme };
}
