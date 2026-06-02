import { join } from "node:path";
import { bundledPrototypeConfigPath, findProjectRoot } from "../config/load.js";
import { pathExists, readJson } from "../util/fs.js";
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
  const manifestPath = join(projectRoot, config.prototypeDir, "manifest.json");
  if (!(await pathExists(manifestPath))) {
    return undefined;
  }
  const manifest = await readJson<{ themeName?: string }>(manifestPath);
  return manifest.themeName?.trim() || undefined;
}
