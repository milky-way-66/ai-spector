import { mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { bundledPrototypeConfigPath, findProjectRoot } from "../config/load.js";
import { prototypeConfigPath } from "../config/docflow-paths.js";
import { LEGACY_DOCOPS_PATHS } from "../docops/paths.js";
import { pathExists, readJson, writeJson } from "../util/fs.js";
import type { PrototypeBasicAuth, PrototypeConfig, PrototypeTechStack } from "./types.js";

const DEFAULT_CONFIG: PrototypeConfig = {
  version: 1,
  listScreenDoc: "docs/basic-design/list-screens.md",
  screenIndexSection: "## 4. Screen Index",
  screenDetailDir: "docs/basic-design/screens/",
  prototypeDir: "prototype",
  srcDir: "prototype/src",
  slugFrom: "screenName",
  defaultTheme: "vercel",
  htpasswdFile: "prototype/.htpasswd",
};

export function isPrototypeBasicAuthConfigured(
  config: PrototypeConfig,
): config is PrototypeConfig & { basicAuth: PrototypeBasicAuth } {
  const auth = config.basicAuth;
  return Boolean(auth?.username?.trim() && auth.password);
}

const LEGACY_PROTOTYPE_CONFIG_RELS = [
  LEGACY_DOCOPS_PATHS.prototypeConfig,
  "prototype/config.json",
] as const;

async function readPrototypeConfigRaw(
  projectRoot: string,
): Promise<Partial<PrototypeConfig>> {
  const candidates = [
    prototypeConfigPath(projectRoot),
    ...LEGACY_PROTOTYPE_CONFIG_RELS.map((rel) => join(projectRoot, rel)),
    bundledPrototypeConfigPath(),
  ];
  for (const path of candidates) {
    if (await pathExists(path)) {
      return readJson<Partial<PrototypeConfig>>(path);
    }
  }
  return {};
}

async function writePrototypeConfigRaw(
  projectRoot: string,
  config: PrototypeConfig,
): Promise<void> {
  const path = prototypeConfigPath(projectRoot);
  await mkdir(dirname(path), { recursive: true });
  await writeJson(path, config);
}

export async function loadPrototypeConfig(
  root?: string,
): Promise<{ projectRoot: string; config: PrototypeConfig }> {
  const projectRoot = root ?? findProjectRoot();
  const raw = await readPrototypeConfigRaw(projectRoot);
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

/** Persist default entry screen for prototype hosting / screen-map. */
export async function persistPrototypeDefaultScreen(
  projectRoot: string,
  screenId: string,
): Promise<void> {
  const id = screenId.trim();
  if (!id) {
    return;
  }
  const raw = await readPrototypeConfigRaw(projectRoot);
  const next: PrototypeConfig = { ...DEFAULT_CONFIG, ...raw, defaultScreenId: id };
  await writePrototypeConfigRaw(projectRoot, next);
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
  const raw = await readPrototypeConfigRaw(projectRoot);
  const next: PrototypeConfig = { ...DEFAULT_CONFIG, ...raw, defaultTheme: name };
  await writePrototypeConfigRaw(projectRoot, next);
}

/** Persist the chosen tech stack and derive buildMode when not explicitly set. */
export async function persistPrototypeTechStack(
  projectRoot: string,
  techStack: PrototypeTechStack,
): Promise<PrototypeConfig> {
  const raw = await readPrototypeConfigRaw(projectRoot);
  // html is static; all framework stacks are spa — only override if not explicitly set
  const derivedBuildMode = techStack === "html" ? "static" : "spa";
  const next: PrototypeConfig = {
    ...DEFAULT_CONFIG,
    ...raw,
    techStack,
    buildMode: raw.buildMode ?? derivedBuildMode,
  };
  await writePrototypeConfigRaw(projectRoot, next);
  return next;
}

/** Persist HTTP basic auth credentials for prototype hosting. */
export async function persistPrototypeBasicAuth(
  projectRoot: string,
  creds: { username: string; password: string },
): Promise<PrototypeConfig> {
  const username = creds.username.trim();
  const password = creds.password;
  if (!username || !password) {
    throw new Error("username and password are required");
  }
  const raw = await readPrototypeConfigRaw(projectRoot);
  const basicAuth: PrototypeBasicAuth = {
    username,
    password,
    setAt: new Date().toISOString(),
  };
  const next: PrototypeConfig = { ...DEFAULT_CONFIG, ...raw, basicAuth };
  await writePrototypeConfigRaw(projectRoot, next);
  return next;
}
