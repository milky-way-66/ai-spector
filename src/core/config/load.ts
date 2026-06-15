import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { DocflowConfig, DocumentsManifest, LanguageConfig, PackManifest } from "./types.js";
import { assertSupportedLanguageCode } from "./types.js";
import { readJson } from "../util/fs.js";

export { bundledPrototypeConfigPath } from "./docflow-paths.js";

const CONFIG_NAME = "docflow.config.json";

/** Installed package root (schemas, templates, documents.json). */
export function packageBundleRoot(): string {
  return resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
}

/** Bundled project scaffold for `ai-spector init`. */
export function scaffoldBundleRoot(): string {
  return join(packageBundleRoot(), "scaffold");
}

/** Bundled UI themes for HTML prototypes (`assets/themes/<name>/DESIGN.md`). */
export function themesBundleRoot(): string {
  return join(packageBundleRoot(), "assets", "themes");
}

/** Step-by-step user course (`website/docs/`, exposed as `docs/course/` in the package). */
export function courseBundleRoot(): string {
  return join(packageBundleRoot(), "docs", "course");
}


/** Cursor commands/skills/MCP bundled under scaffold (not `.cursor/` — root gitignore). */
export function scaffoldCursorBundleRoot(): string {
  return join(scaffoldBundleRoot(), "cursor");
}

/** Claude Code CLAUDE.md + .claude/ skills bundled under scaffold. */
export function scaffoldClaudeBundleRoot(): string {
  return join(scaffoldBundleRoot(), "claude");
}

export function findProjectRoot(start = process.cwd()): string {
  let dir = resolve(start);
  for (;;) {
    if (existsSync(join(dir, ".ai-spector", CONFIG_NAME))) {
      return dir;
    }
    if (existsSync(join(dir, CONFIG_NAME))) {
      return dir;
    }
    const parent = dirname(dir);
    if (parent === dir) {
      break;
    }
    dir = parent;
  }
  throw new Error(
    `Could not find project root (expected .ai-spector/${CONFIG_NAME} or ${CONFIG_NAME})`,
  );
}

function configPath(root: string): string {
  const nested = join(root, ".ai-spector", CONFIG_NAME);
  if (existsSync(nested)) {
    return nested;
  }
  return join(root, CONFIG_NAME);
}

const DEFAULT_PATHS = {
  graph: ".ai-spector/graph/traceability.graph.json",
  registry: ".ai-spector/registry/section-registry.json",
  templates: ".ai-spector/templates",
} as const;

const DEFAULT_LANGUAGE: LanguageConfig = { code: "en", label: "English" };

export async function loadDocflowConfig(
  root = findProjectRoot(),
): Promise<{ root: string; config: DocflowConfig; configFile: string }> {
  const configFile = configPath(root);
  const raw = await readJson<Partial<DocflowConfig>>(configFile);
  const languages =
    Array.isArray(raw.languages) && raw.languages.length > 0
      ? raw.languages.map((l: { code: string; label: string }) => ({
          code: assertSupportedLanguageCode(l.code),
          label: l.label,
        }))
      : [DEFAULT_LANGUAGE];

  const languageCodes = new Set(languages.map((l) => l.code));
  let clientLanguage: DocflowConfig["clientLanguage"];
  if (raw.clientLanguage) {
    const code = assertSupportedLanguageCode(raw.clientLanguage);
    clientLanguage = languageCodes.has(code) ? code : undefined;
  }

  const readinessRaw = raw.readiness as DocflowConfig["readiness"];

  const config: DocflowConfig = {
    version: raw.version ?? 1,
    languages,
    ...(clientLanguage ? { clientLanguage } : {}),
    ...(readinessRaw && Object.keys(readinessRaw).length > 0 ? { readiness: readinessRaw } : {}),
    paths: {
      graph: raw.paths?.graph ?? DEFAULT_PATHS.graph,
      registry: raw.paths?.registry ?? DEFAULT_PATHS.registry,
      templates: raw.paths?.templates ?? DEFAULT_PATHS.templates,
    },
    packs: {
      srs: (raw.packs as Record<string, string> | undefined)?.srs
        ?? (raw.packs as Record<string, string> | undefined)?.active
        ?? "builtin",
      basicDesign: (raw.packs as Record<string, string> | undefined)?.basicDesign ?? "builtin",
    },
  };
  return { root, config, configFile };
}

/**
 * Load the active pack's PackManifest, or null if using builtin.
 * Returns null when packs.srs is "builtin" (i.e. no custom SRS pack is active).
 */
export async function resolveActivePackManifest(
  root: string,
  config: DocflowConfig,
): Promise<PackManifest | null> {
  const active = config.packs.srs;
  if (!active || active === "builtin") return null;
  const packDir = join(root, ".ai-spector/packs", active);
  const manifest = await readJson<PackManifest>(join(packDir, "manifest.json"));
  return manifest;
}

/**
 * Returns the list of manifests + template dirs to use.
 * Legacy / builtin path: both builtin manifests.
 * Custom pack path: single pack manifest from .ai-spector/packs/<active>/.
 */
async function resolvePackManifest(
  root: string,
  packName: string,
  loadBuiltin: () => Promise<{ bundleRoot: string; manifest: DocumentsManifest }>,
): Promise<{ manifest: DocumentsManifest; templatesDir: string }> {
  if (!packName || packName === "builtin") {
    const { bundleRoot, manifest } = await loadBuiltin();
    return { manifest, templatesDir: join(bundleRoot, manifest.templatesDir) };
  }
  const packDir = join(root, ".ai-spector/packs", packName);
  const manifest = await readJson<PackManifest>(join(packDir, "manifest.json"));
  return { manifest, templatesDir: join(packDir, manifest.templatesDir ?? "templates") };
}

export async function resolveActiveManifests(
  root: string,
  config: DocflowConfig,
): Promise<Array<{ manifest: DocumentsManifest; templatesDir: string }>> {
  const srsPack = config.packs.srs;
  const bdPack = config.packs.basicDesign;

  const [srsEntry, bdEntry] = await Promise.all([
    resolvePackManifest(root, srsPack, loadDocumentsManifest),
    resolvePackManifest(root, bdPack, async () => {
      const bundleRoot = packageBundleRoot();
      const manifest = await loadBasicDesignListManifest();
      return { bundleRoot, manifest };
    }),
  ]);

  return [srsEntry, bdEntry];
}

/** Returns the primary (first) language from config. */
export function primaryLanguage(config: DocflowConfig): LanguageConfig {
  return config.languages[0] ?? DEFAULT_LANGUAGE;
}

/** Returns the client-preferred language, falling back to primary. */
export function clientLanguage(config: DocflowConfig): LanguageConfig {
  if (config.clientLanguage) {
    const match = config.languages.find((l) => l.code === config.clientLanguage);
    if (match) return match;
  }
  return primaryLanguage(config);
}

/** Language code to prefer when resolving document paths for a review track. */
export function preferredLanguageCode(
  config: DocflowConfig,
  track: "internal" | "client" = "internal",
): string {
  return track === "client" ? clientLanguage(config).code : primaryLanguage(config).code;
}

/** Resolved absolute path to project-local templates (`.ai-spector/templates`). */
export function resolveProjectTemplatesDir(
  root: string,
  config: DocflowConfig,
): string {
  return resolve(root, config.paths.templates ?? DEFAULT_PATHS.templates);
}

export function resolveFromRoot(root: string, relativePath: string): string {
  return resolve(root, relativePath);
}

export function bundledSchemaPath(): string {
  return join(packageBundleRoot(), "schemas/schema.graph.json");
}

export function bundledRulesTraceabilityPath(): string {
  return join(packageBundleRoot(), "schemas/rules.traceability.json");
}

export function bundledRulesImpactPath(): string {
  return join(packageBundleRoot(), "schemas/rules.impact.json");
}

export function bundledTemplatesDir(subdir: string): string {
  return join(packageBundleRoot(), "templates", subdir);
}

export async function loadDocumentsManifest(): Promise<{
  bundleRoot: string;
  manifest: DocumentsManifest;
}> {
  const bundleRoot = packageBundleRoot();
  const manifest = await readJson<DocumentsManifest>(
    join(bundleRoot, "documents.json"),
  );
  if (!manifest.templatesDir || !Array.isArray(manifest.documents)) {
    throw new Error(`Invalid documents.json in ${bundleRoot}`);
  }
  return { bundleRoot, manifest };
}

export async function loadBasicDesignListManifest(): Promise<DocumentsManifest> {
  const bundleRoot = packageBundleRoot();
  const manifest = await readJson<DocumentsManifest>(
    join(bundleRoot, "documents-basic-design.json"),
  );
  if (!manifest.templatesDir || !Array.isArray(manifest.documents)) {
    throw new Error(`Invalid documents-basic-design.json in ${bundleRoot}`);
  }
  return manifest;
}
