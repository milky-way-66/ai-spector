import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { DocflowConfig, DocumentsManifest } from "./types.js";
import { readJson } from "../util/fs.js";

const CONFIG_NAME = "docflow.config.json";

/** Installed package root (schemas, templates, documents.json). */
export function packageBundleRoot(): string {
  return resolve(dirname(fileURLToPath(import.meta.url)), "../..");
}

/** Bundled project scaffold for `ai-spector init`. */
export function scaffoldBundleRoot(): string {
  return join(packageBundleRoot(), "scaffold");
}

/** Cursor commands/skills/MCP bundled under scaffold (not `.cursor/` — root gitignore). */
export function scaffoldCursorBundleRoot(): string {
  return join(scaffoldBundleRoot(), "cursor");
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

export async function loadDocflowConfig(
  root = findProjectRoot(),
): Promise<{ root: string; config: DocflowConfig; configFile: string }> {
  const configFile = configPath(root);
  const raw = await readJson<Partial<DocflowConfig>>(configFile);
  const config: DocflowConfig = {
    version: raw.version ?? 1,
    paths: {
      graph: raw.paths?.graph ?? DEFAULT_PATHS.graph,
      registry: raw.paths?.registry ?? DEFAULT_PATHS.registry,
      templates: raw.paths?.templates ?? DEFAULT_PATHS.templates,
    },
  };
  return { root, config, configFile };
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
