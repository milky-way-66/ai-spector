import { join } from "node:path";
import { bundledPrototypeConfigPath, findProjectRoot } from "../config/load.js";
import { pathExists, readJson, writeJson } from "../util/fs.js";
import type { PrototypeConfig } from "./types.js";

const DEFAULT_CONFIG: PrototypeConfig = {
  version: 1,
  listScreenDoc: "docs/basic-design/list-screens.md",
  screenIndexSection: "## 4. Screen Index",
  screenDetailDir: "docs/basic-design/screens/",
  prototypeDir: "prototype",
  srcDir: "prototype/src",
  slugFrom: "screenName",
  defaultTheme: "vercel",
};

export async function loadPrototypeConfig(
  root?: string,
): Promise<{ projectRoot: string; config: PrototypeConfig }> {
  const projectRoot = root ?? findProjectRoot();
  const projectConfig = join(
    projectRoot,
    ".ai-spector/.docflow/config/prototype.config.json",
  );
  let raw: Partial<PrototypeConfig> = {};
  if (await pathExists(projectConfig)) {
    raw = await readJson<Partial<PrototypeConfig>>(projectConfig);
  } else if (await pathExists(bundledPrototypeConfigPath())) {
    raw = await readJson<Partial<PrototypeConfig>>(bundledPrototypeConfigPath());
  }
  const config: PrototypeConfig = { ...DEFAULT_CONFIG, ...raw };
  return { projectRoot, config };
}

export async function readPrototypeThemeName(
  projectRoot: string,
  config: PrototypeConfig,
): Promise<string | undefined> {
  const prototypeRoot = join(projectRoot, config.prototypeDir);

  const themeJsonPath = join(prototypeRoot, "theme.json");
  if (await pathExists(themeJsonPath)) {
    const themeJson = await readJson<{ themeName?: string }>(themeJsonPath);
    const fromThemeJson = themeJson.themeName?.trim();
    if (fromThemeJson) {
      return fromThemeJson;
    }
  }

  const manifestPath = join(prototypeRoot, "manifest.json");
  if (await pathExists(manifestPath)) {
    const manifest = await readJson<{ themeName?: string }>(manifestPath);
    const fromManifest = manifest.themeName?.trim();
    if (fromManifest) {
      return fromManifest;
    }
  }

  return undefined;
}

/** Persist explicit theme choice for future prototype runs (no re-prompt). */
export async function persistPrototypeDefaultTheme(
  projectRoot: string,
  theme: string,
): Promise<void> {
  const name = theme.trim();
  if (!name) {
    return;
  }
  const projectConfig = join(
    projectRoot,
    ".ai-spector/.docflow/config/prototype.config.json",
  );
  let raw: Partial<PrototypeConfig> = {};
  if (await pathExists(projectConfig)) {
    raw = await readJson<Partial<PrototypeConfig>>(projectConfig);
  } else if (await pathExists(bundledPrototypeConfigPath())) {
    raw = await readJson<Partial<PrototypeConfig>>(bundledPrototypeConfigPath());
  }
  const next: PrototypeConfig = { ...DEFAULT_CONFIG, ...raw, defaultTheme: name };
  await writeJson(projectConfig, next);
}
