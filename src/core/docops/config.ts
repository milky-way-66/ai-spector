import { mkdir, readdir } from "node:fs/promises";
import { join } from "node:path";
import { loadDocflowConfig } from "../config/load.js";
import type { DocflowConfig } from "../config/types.js";
import { pathExists, readJson, writeJson } from "../util/fs.js";
import {
  DEFAULT_CAPABILITIES,
  DEFAULT_DOCOPS_PATHS,
  DOCOPS_CONFIG_REL,
  DOCOPS_ROOT,
  DOC_TYPE_INFERENCE,
  LEGACY_DOCFLOW_CONFIG_REL,
  type DocopsPathKey,
  docopsConfigAbs,
  mergeDocopsPaths,
} from "./paths.js";
import { initDocopsContract } from "./init.js";

import type { DocopsConfig, DocopsDocTypeConfig } from "./types.js";

const DEFAULT_CONFIG: DocopsConfig = {
  schemaVersion: "1.0",
  docsRoot: "docs",
  languages: [{ code: "en", label: "English" }],
  paths: { ...DEFAULT_DOCOPS_PATHS },
  capabilities: { ...DEFAULT_CAPABILITIES },
};

function primaryLanguageCode(config: Partial<DocopsConfig>): string {
  const explicit = config.primaryLanguage?.trim().toLowerCase();
  const languages = config.languages ?? [];
  const known = new Set(languages.map((l) => l.code.trim().toLowerCase()).filter(Boolean));
  if (explicit && (!known.size || known.has(explicit))) {
    return explicit;
  }
  return languages[0]?.code?.trim().toLowerCase() || explicit || "en";
}

function resolveTrackCode(
  config: Partial<DocopsConfig>,
  field: "internalLanguage" | "clientLanguage",
): string | undefined {
  const raw = config[field]?.trim().toLowerCase();
  if (!raw) {
    return undefined;
  }
  const known = new Set((config.languages ?? []).map((l) => l.code.trim().toLowerCase()));
  return !known.size || known.has(raw) ? raw : undefined;
}

export function mergeDocopsDefaults(raw: Partial<DocopsConfig> | null | undefined): DocopsConfig {
  const source = raw ?? {};
  const languages =
    Array.isArray(source.languages) && source.languages.length > 0
      ? source.languages.map((entry) => ({
          code: String(entry.code ?? "").trim().toLowerCase(),
          label: String(entry.label ?? entry.code ?? "").trim(),
          ...(entry.path?.trim() ? { path: entry.path.trim() } : {}),
        }))
      : DEFAULT_CONFIG.languages;

  const merged: DocopsConfig = {
    schemaVersion: source.schemaVersion?.trim() || DEFAULT_CONFIG.schemaVersion,
    docsRoot: source.docsRoot?.trim() || DEFAULT_CONFIG.docsRoot,
    languages,
    paths: mergeDocopsPaths(source.paths),
    capabilities: {
      ...DEFAULT_CAPABILITIES,
      ...(source.capabilities ?? {}),
    },
    ...(source.docTypes ? { docTypes: { ...source.docTypes } } : {}),
  };

  const primary = primaryLanguageCode({ ...merged, primaryLanguage: source.primaryLanguage });
  merged.primaryLanguage = primary;

  const internal = resolveTrackCode(
    { ...merged, internalLanguage: source.internalLanguage },
    "internalLanguage",
  );
  if (internal) {
    merged.internalLanguage = internal;
  }

  const client = resolveTrackCode(
    { ...merged, clientLanguage: source.clientLanguage },
    "clientLanguage",
  );
  if (client) {
    merged.clientLanguage = client;
  }

  return merged;
}

export async function inferDocTypesFromTree(
  projectRoot: string,
): Promise<Record<string, DocopsDocTypeConfig>> {
  const docsRoot = join(projectRoot, "docs");
  if (!(await pathExists(docsRoot))) {
    return {};
  }

  let entries: string[] = [];
  try {
    const dirents = await readdir(docsRoot, { withFileTypes: true });
    entries = dirents.filter((d) => d.isDirectory()).map((d) => `docs/${d.name}`);
  } catch {
    return {};
  }

  const normalized = new Set(entries);
  const out: Record<string, DocopsDocTypeConfig> = {};
  for (const row of DOC_TYPE_INFERENCE) {
    if (
      normalized.has(row.docsPrefix) ||
      [...normalized].some(
        (entry) => entry === row.docsPrefix || entry.startsWith(`${row.docsPrefix}/`),
      )
    ) {
      out[row.key] = {
        enabled: true,
        path: row.path,
        label: row.label,
        templatesPath: row.templatesPath,
      };
    }
  }
  return out;
}

export function docopsConfigFromDocflow(
  docflow: DocflowConfig,
  docTypes?: Record<string, DocopsDocTypeConfig>,
): DocopsConfig {
  const languages = docflow.languages.map((lang) => ({
    code: lang.code,
    label: lang.label,
    path: lang.code,
  }));

  return mergeDocopsDefaults({
    schemaVersion: "1.0",
    docsRoot: "docs",
    languages,
    ...(docflow.internalLanguage ? { internalLanguage: docflow.internalLanguage } : {}),
    ...(docflow.clientLanguage ? { clientLanguage: docflow.clientLanguage } : {}),
    ...(docTypes ? { docTypes } : {}),
    paths: { ...DEFAULT_DOCOPS_PATHS },
    capabilities: { ...DEFAULT_CAPABILITIES },
  });
}

export async function readDocopsConfig(projectRoot: string): Promise<DocopsConfig | null> {
  const configPath = docopsConfigAbs(projectRoot);
  if (!(await pathExists(configPath))) {
    return null;
  }
  const raw = await readJson<Partial<DocopsConfig>>(configPath);
  return mergeDocopsDefaults(raw);
}

export async function writeDocopsConfig(
  projectRoot: string,
  config: Partial<DocopsConfig>,
): Promise<string> {
  const merged = mergeDocopsDefaults(config);
  const path = docopsConfigAbs(projectRoot);
  await writeJson(path, merged);
  return path;
}

/** Load docops config or derive a minimal one from legacy docflow.config.json. */
export async function loadOrDeriveDocopsConfig(projectRoot: string): Promise<DocopsConfig> {
  const existing = await readDocopsConfig(projectRoot);
  if (existing) {
    return existing;
  }

  const docflowPath = join(projectRoot, LEGACY_DOCFLOW_CONFIG_REL);
  if (await pathExists(docflowPath)) {
    const { config } = await loadDocflowConfig(projectRoot);
    const docTypes = await inferDocTypesFromTree(projectRoot);
    return docopsConfigFromDocflow(config, Object.keys(docTypes).length ? docTypes : undefined);
  }

  return mergeDocopsDefaults(null);
}

export interface DocopsWriteRoots {
  primary: string;
  legacy?: string;
}

export async function resolveCommentsWriteRoots(projectRoot: string): Promise<DocopsWriteRoots> {
  const config = await loadOrDeriveDocopsConfig(projectRoot);
  return { primary: config.paths.comments };
}

export async function resolveReviewQueueWriteRoots(projectRoot: string): Promise<DocopsWriteRoots> {
  const config = await loadOrDeriveDocopsConfig(projectRoot);
  return { primary: config.paths.reviewQueue };
}

export async function resolvePrototypeScreenMapRel(projectRoot: string): Promise<{
  primary: string;
}> {
  const config = await loadOrDeriveDocopsConfig(projectRoot);
  return { primary: config.paths.prototypeScreenMap };
}

export async function writePrototypeScreenMap(
  projectRoot: string,
  screenMap: unknown,
): Promise<{ primary: string }> {
  const { primary } = await resolvePrototypeScreenMapRel(projectRoot);
  await mkdir(join(projectRoot, primary.replace(/\/[^/]+$/, "")), { recursive: true });
  await writeJson(join(projectRoot, primary), screenMap);
  return { primary };
}

export async function scaffoldDocopsTree(projectRoot: string): Promise<string> {
  const { configPath } = await initDocopsContract({
    projectRoot,
    force: true,
  });
  return configPath;
}
