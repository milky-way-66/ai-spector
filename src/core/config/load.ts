import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { DocflowConfig, DocumentsManifest, LanguageConfig, PackManifest } from "./types.js";
import { assertSupportedLanguageCode } from "./types.js";
import { readJson } from "../util/fs.js";
import { DOCOPS_CONFIG_REL } from "../docops/paths.js";
import { ENGINE_CONFIG_REL } from "../engine/paths.js";
import { loadEngineConfig } from "../engine/load.js";
import type { DocopsConfig } from "../docops/types.js";
import {
  applyDocopsLanguageOverlay,
  languagesFromDocopsPartial,
  orderLanguagesPrimaryFirst,
  primaryLanguageCodeFromDocops,
} from "./language-from-docops.js";

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

/** Step-by-step user course (`website/docs/`, legacy path `docs/course/`). */
export function courseBundleRoot(): string {
  const root = packageBundleRoot();
  const primary = join(root, "website", "docs");
  if (existsSync(primary)) {
    return primary;
  }
  return join(root, "docs", "course");
}


/** Cursor skills/rules/MCP bundled under scaffold (not `.cursor/` — root gitignore). */
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
    if (existsSync(join(dir, ".ai-spector", CONFIG_NAME))) return dir;
    if (existsSync(join(dir, CONFIG_NAME))) return dir;
    if (existsSync(join(dir, DOCOPS_CONFIG_REL))) return dir;
    if (existsSync(join(dir, ENGINE_CONFIG_REL))) return dir;
    const parent = dirname(dir);
    if (parent === dir) {
      break;
    }
    dir = parent;
  }
  throw new Error(
    `Could not find project root (expected .ai-spector/${CONFIG_NAME}, ${CONFIG_NAME}, ${DOCOPS_CONFIG_REL}, or ${ENGINE_CONFIG_REL})`,
  );
}

const DEFAULT_PATHS = {
  graph: ".ai-spector/graph/traceability.graph.json",
  registry: ".ai-spector/registry/section-registry.json",
  templates: ".ai-spector/templates",
} as const;

const DEFAULT_LANGUAGE: LanguageConfig = { code: "en", label: "English" };

function buildDocflowFromRaw(
  raw: Partial<DocflowConfig>,
  configFile: string,
  root: string,
): { root: string; config: DocflowConfig; configFile: string } {
  const languages =
    Array.isArray(raw.languages) && raw.languages.length > 0
      ? raw.languages.map((l: { code: string; label: string }) => ({
          code: assertSupportedLanguageCode(l.code),
          label: l.label,
        }))
      : [DEFAULT_LANGUAGE];

  const languageCodes = new Set(languages.map((l) => l.code));
  let internalLanguage: DocflowConfig["internalLanguage"];
  if (raw.internalLanguage) {
    const code = assertSupportedLanguageCode(raw.internalLanguage);
    internalLanguage = languageCodes.has(code) ? code : undefined;
  }
  let clientLanguage: DocflowConfig["clientLanguage"];
  if (raw.clientLanguage) {
    const code = assertSupportedLanguageCode(raw.clientLanguage);
    clientLanguage = languageCodes.has(code) ? code : undefined;
  }

  const readinessRaw = raw.readiness as DocflowConfig["readiness"];

  const config: DocflowConfig = {
    version: raw.version ?? 1,
    ...(raw.scaffoldVersion ? { scaffoldVersion: raw.scaffoldVersion } : {}),
    languages,
    ...(internalLanguage ? { internalLanguage } : {}),
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

async function synthesizeDocflowFromDocopsAndEngine(
  root: string,
): Promise<{ root: string; config: DocflowConfig; configFile: string }> {
  // Read docops config inline to avoid circular dependency with docops/config.js
  const docopsPath = join(root, DOCOPS_CONFIG_REL);
  const docopsRaw: Partial<DocopsConfig> | null = existsSync(docopsPath)
    ? await readJson<Partial<DocopsConfig>>(docopsPath)
    : null;

  const engine = await loadEngineConfig(root);

  const languages: LanguageConfig[] =
    languagesFromDocopsPartial(docopsRaw ?? {}) ?? [{ code: "en", label: "English" }];
  const primaryCode = primaryLanguageCodeFromDocops(docopsRaw ?? {});
  const orderedLanguages = orderLanguagesPrimaryFirst(languages, primaryCode);

  const languageCodes = new Set(orderedLanguages.map((l) => l.code));

  let internalLanguage: DocflowConfig["internalLanguage"];
  if (docopsRaw?.internalLanguage) {
    try {
      const code = assertSupportedLanguageCode(docopsRaw.internalLanguage);
      if (languageCodes.has(code)) internalLanguage = code;
    } catch {
      // unsupported code — skip
    }
  }

  let clientLanguage: DocflowConfig["clientLanguage"];
  if (docopsRaw?.clientLanguage) {
    try {
      const code = assertSupportedLanguageCode(docopsRaw.clientLanguage);
      if (languageCodes.has(code)) clientLanguage = code;
    } catch {
      // unsupported code — skip
    }
  }

  // Resolve templates path: first enabled docType's templatesPath, then fallback
  let templates = ".docops/templates/srs";
  const docTypes = docopsRaw?.docTypes;
  if (docTypes) {
    for (const dt of Object.values(docTypes)) {
      if (dt.enabled && dt.templatesPath) {
        templates = dt.templatesPath;
        break;
      }
    }
  }

  const engineReadiness = engine.readiness;
  const readiness: DocflowConfig["readiness"] = {
    ...(engineReadiness.profile ? { profile: engineReadiness.profile } : {}),
    ...(engineReadiness.standards?.length ? { standards: engineReadiness.standards } : {}),
    ...(engineReadiness.docTypes && Object.keys(engineReadiness.docTypes).length
      ? { docTypes: engineReadiness.docTypes }
      : {}),
    ...(engineReadiness.lastScan ? { lastScan: engineReadiness.lastScan } : {}),
  };

  const config: DocflowConfig = {
    version: 1,
    ...(engine.scaffoldVersion ? { scaffoldVersion: engine.scaffoldVersion } : {}),
    languages: orderedLanguages,
    ...(internalLanguage ? { internalLanguage } : {}),
    ...(clientLanguage ? { clientLanguage } : {}),
    ...(Object.keys(readiness).length > 0 ? { readiness } : {}),
    paths: {
      graph: engine.artifacts.graph,
      registry: engine.artifacts.registry,
      templates,
    },
    packs: {
      srs: "builtin",
      basicDesign: "builtin",
    },
  };

  const configFile = join(root, ENGINE_CONFIG_REL);
  return { root, config, configFile };
}

async function readDocopsRawIfPresent(root: string): Promise<Partial<DocopsConfig> | null> {
  const docopsPath = join(root, DOCOPS_CONFIG_REL);
  if (!existsSync(docopsPath)) {
    return null;
  }
  return readJson<Partial<DocopsConfig>>(docopsPath);
}

function finalizeDocflowConfig(
  result: { root: string; config: DocflowConfig; configFile: string },
  docopsRaw: Partial<DocopsConfig> | null,
): { root: string; config: DocflowConfig; configFile: string } {
  if (!docopsRaw) {
    return result;
  }
  return {
    ...result,
    config: applyDocopsLanguageOverlay(result.config, docopsRaw),
  };
}

export async function loadDocflowConfig(
  root = findProjectRoot(),
): Promise<{ root: string; config: DocflowConfig; configFile: string }> {
  const docopsRaw = await readDocopsRawIfPresent(root);

  // Legacy path: .ai-spector/docflow.config.json
  const legacyNested = join(root, ".ai-spector", CONFIG_NAME);
  if (existsSync(legacyNested)) {
    const raw = await readJson<Partial<DocflowConfig>>(legacyNested);
    return finalizeDocflowConfig(buildDocflowFromRaw(raw, legacyNested, root), docopsRaw);
  }

  // Legacy path: root docflow.config.json
  const legacyRoot = join(root, CONFIG_NAME);
  if (existsSync(legacyRoot)) {
    const raw = await readJson<Partial<DocflowConfig>>(legacyRoot);
    return finalizeDocflowConfig(buildDocflowFromRaw(raw, legacyRoot, root), docopsRaw);
  }

  // New 2-file model: synthesize DocflowConfig from docops + engine
  return synthesizeDocflowFromDocopsAndEngine(root);
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

  const [srsEntry, bdEntry, ddEntry] = await Promise.all([
    resolvePackManifest(root, srsPack, loadDocumentsManifest),
    resolvePackManifest(root, bdPack, async () => {
      const bundleRoot = packageBundleRoot();
      const manifest = await loadBasicDesignListManifest();
      return { bundleRoot, manifest };
    }),
    resolvePackManifest(root, "builtin", async () => {
      const bundleRoot = packageBundleRoot();
      const manifest = await loadDetailDesignListManifest();
      return { bundleRoot, manifest };
    }),
  ]);

  return [srsEntry, bdEntry, ddEntry];
}

/** Returns the primary (first) language from config. */
export function primaryLanguage(config: DocflowConfig): LanguageConfig {
  return config.languages[0] ?? DEFAULT_LANGUAGE;
}

/** Returns the internal team language, falling back to primary. */
export function internalLanguage(config: DocflowConfig): LanguageConfig {
  if (config.internalLanguage) {
    const match = config.languages.find((l) => l.code === config.internalLanguage);
    if (match) return match;
  }
  return primaryLanguage(config);
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
  return track === "client" ? clientLanguage(config).code : internalLanguage(config).code;
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

export async function loadDetailDesignListManifest(): Promise<DocumentsManifest> {
  const bundleRoot = packageBundleRoot();
  const manifest = await readJson<DocumentsManifest>(
    join(bundleRoot, "documents-detail-design.json"),
  );
  if (!manifest.templatesDir || !Array.isArray(manifest.documents)) {
    throw new Error(`Invalid documents-detail-design.json in ${bundleRoot}`);
  }
  return manifest;
}
