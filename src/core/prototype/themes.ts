import { readdir } from "node:fs/promises";
import { join } from "node:path";
import { copyFile, readFile } from "node:fs/promises";
import { themesBundleRoot } from "../config/load.js";
import { pathExists } from "../util/fs.js";

export async function listBundledThemes(): Promise<string[]> {
  const root = themesBundleRoot();
  if (!(await pathExists(root))) {
    return [];
  }
  const entries = await readdir(root, { withFileTypes: true });
  const themes: string[] = [];
  for (const ent of entries) {
    if (!ent.isDirectory()) {
      continue;
    }
    const designPath = join(root, ent.name, "DESIGN.md");
    if (await pathExists(designPath)) {
      themes.push(ent.name);
    }
  }
  return themes.sort((a, b) => a.localeCompare(b));
}

export function resolveThemeDesignPath(themeName: string): string {
  const safe = themeName.replace(/[^a-zA-Z0-9._-]/g, "");
  if (!safe || safe !== themeName) {
    throw new Error(`Invalid theme name: ${themeName}`);
  }
  return join(themesBundleRoot(), safe, "DESIGN.md");
}

export async function assertThemeExists(themeName: string): Promise<string> {
  const designPath = resolveThemeDesignPath(themeName);
  if (!(await pathExists(designPath))) {
    const available = await listBundledThemes();
    const hint =
      available.length > 0
        ? ` Available: ${available.slice(0, 12).join(", ")}${available.length > 12 ? ", …" : ""}`
        : "";
    throw new Error(`Theme not found: ${themeName}.${hint}`);
  }
  return designPath;
}

export async function installThemeDesign(
  themeName: string,
  prototypeDesignPath: string,
): Promise<void> {
  const src = await assertThemeExists(themeName);
  await copyFile(src, prototypeDesignPath);
}

export async function readThemeSummary(themeName: string): Promise<string | undefined> {
  const summaryPath = join(themesBundleRoot(), themeName.replace(/[^a-zA-Z0-9._-]/g, ""), "SUMMARY.md");
  if (!(await pathExists(summaryPath))) {
    return undefined;
  }
  const raw = await readFile(summaryPath, "utf8");
  const first = raw.split(/\r?\n/).find((l) => l.trim().length > 0);
  return first?.trim();
}
