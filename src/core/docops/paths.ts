import { join } from "node:path";

/** Writer-owned contract root (see kari-writer/contracts/CONTRACT.md). */
export const DOCOPS_ROOT = ".docops";

export const DOCOPS_CONFIG_REL = `${DOCOPS_ROOT}/docops.config.json`;
export const LEGACY_DOCFLOW_CONFIG_REL = ".ai-spector/docflow.config.json";

export const DEFAULT_DOCOPS_PATHS = {
  registry: ".docops/registry",
  comments: ".docops/comments",
  reviewConfig: ".docops/review.config.json",
  reviewQueue: ".docops/review-queue",
  prototypeConfig: ".docops/prototype/config.json",
  prototypeScreenMap: ".docops/prototype/screen-map.json",
} as const;

/** Legacy layout before `.docops/` contract (ai-spector + Writer dual-read). */
export const LEGACY_DOCOPS_PATHS = {
  registry: ".docops/registry",
  comments: "comments",
  reviewConfig: ".ai-spector/review.config.json",
  reviewQueue: ".ai-spector/.docflow/review-queue",
  prototypeConfig: ".ai-spector/.docflow/config/prototype/config.json",
  prototypeScreenMap: "prototype/screen-map.json",
} as const;

export type DocopsPathKey = keyof typeof DEFAULT_DOCOPS_PATHS;

export const DOC_TYPE_INFERENCE: ReadonlyArray<{
  docsPrefix: string;
  key: string;
  path: string;
  label: string;
  templatesPath: string;
}> = [
  {
    docsPrefix: "docs/srs",
    key: "srs",
    path: "docs/srs",
    label: "SRS",
    templatesPath: ".docops/templates/srs",
  },
  {
    docsPrefix: "docs/basic-design",
    key: "basicDesign",
    path: "docs/basic-design",
    label: "Basic Design",
    templatesPath: ".docops/templates/basic-design",
  },
  {
    docsPrefix: "docs/detail-design",
    key: "detailDesign",
    path: "docs/detail-design",
    label: "Detail Design",
    templatesPath: ".docops/templates/detail-design",
  },
];

export const DOC_TYPE_KEY_TO_SEGMENT: Record<string, string> = {
  srs: "srs",
  basicDesign: "basic-design",
  detailDesign: "detail-design",
};

export const DEFAULT_DOC_TYPE_REPO_PATH: Record<string, string> = Object.fromEntries(
  DOC_TYPE_INFERENCE.map((row) => [row.key, row.path]),
);

/** Canonical repo folder for a doc layer (e.g. ``docs/basic-design``). */
export function expectedDocTypeRepoPath(layerKey: string): string | undefined {
  return DEFAULT_DOC_TYPE_REPO_PATH[layerKey];
}

/**
 * Expand legacy short ``docTypes.<layer>.path`` values (``srs``, ``basic-design``)
 * to repo-root-relative folders under ``docs/``. Custom paths are left unchanged.
 */
export function normalizeDocTypePath(
  layerKey: string,
  path: string,
  docsRoot = "docs",
): string {
  const trimmed = resolveDocTypeRepoPath(path);
  if (!trimmed) {
    return trimmed;
  }
  const canonical = DEFAULT_DOC_TYPE_REPO_PATH[layerKey];
  if (!canonical || trimmed === canonical) {
    return trimmed;
  }

  const segment = DOC_TYPE_KEY_TO_SEGMENT[layerKey];
  if (trimmed === segment || trimmed === layerKey) {
    return canonical;
  }

  const root = docsRoot.trim().replace(/\\/g, "/").replace(/\/+$/, "");
  if (root && !trimmed.includes("/") && !trimmed.startsWith(".")) {
    const candidate = `${root}/${trimmed}`;
    if (candidate === canonical) {
      return canonical;
    }
  }

  return trimmed;
}

/** True when ``path`` is a known short form that should be ``docs/<segment>``. */
export function isNonCanonicalDocTypePath(
  layerKey: string,
  path: string,
  docsRoot = "docs",
): boolean {
  const trimmed = resolveDocTypeRepoPath(path);
  if (!trimmed) {
    return false;
  }
  return normalizeDocTypePath(layerKey, trimmed, docsRoot) !== trimmed;
}

/**
 * Normalize ``docTypes.<layer>.path`` as a repo-root-relative directory.
 * Paths are used literally (e.g. ``docs/srs``) — short names like ``srs`` are not expanded.
 */
export function resolveDocTypeRepoPath(layerPath: string): string {
  const raw = (layerPath ?? "").trim().replace(/\\/g, "/");
  if (!raw) {
    return "";
  }
  if (raw.includes("/") || raw.startsWith(".")) {
    const parts: string[] = [];
    for (const part of raw.split("/")) {
      if (!part || part === ".") continue;
      if (part === "..") {
        if (parts.length) parts.pop();
        continue;
      }
      parts.push(part);
    }
    return parts.length ? parts.join("/") : raw.replace(/^\/+|\/+$/g, "");
  }
  return raw;
}

/** Map logical segment (``srs``, ``basic-design``) → repo folder prefix from docops config. */
export function segmentRepoPrefixMap(
  config: { docsRoot?: string; docTypes?: Record<string, { enabled?: boolean; path?: string }> },
): Record<string, string> {
  const prefixes: Record<string, string> = {};
  for (const [key, segment] of Object.entries(DOC_TYPE_KEY_TO_SEGMENT)) {
    const layer = config.docTypes?.[key];
    if (layer?.enabled === false) continue;
    const configured = layer?.path?.trim();
    prefixes[segment] = configured
      ? resolveDocTypeRepoPath(configured)
      : (DEFAULT_DOC_TYPE_REPO_PATH[key] ?? "");
  }
  return prefixes;
}

export const DEFAULT_CAPABILITIES = {
  review: true,
  comments: true,
  prototype: true,
  graph: false,
  generate: false,
  translate: false,
} as const;

export type DocopsCapabilities = {
  review: boolean;
  comments: boolean;
  prototype: boolean;
  graph: boolean;
  generate: boolean;
  translate: boolean;
};

export function docopsConfigAbs(projectRoot: string): string {
  return join(projectRoot, DOCOPS_CONFIG_REL).replace(/\\/g, "/");
}

export function mergeDocopsPaths(
  raw: Partial<Record<DocopsPathKey, string>> | undefined,
): Record<DocopsPathKey, string> {
  return { ...DEFAULT_DOCOPS_PATHS, ...(raw ?? {}) };
}

export function resolveDocopsPath(
  paths: Partial<Record<DocopsPathKey, string>> | undefined,
  key: DocopsPathKey,
  options?: { legacy?: boolean },
): string {
  const legacy = options?.legacy ?? false;
  const configured = paths?.[key]?.trim();
  if (configured) {
    return configured;
  }
  return legacy ? LEGACY_DOCOPS_PATHS[key] : DEFAULT_DOCOPS_PATHS[key];
}
