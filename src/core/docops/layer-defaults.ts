import type { DocopsDocTypeConfig } from "./types.js";

export const LAYER_DEFAULTS: Record<string, Omit<DocopsDocTypeConfig, "enabled">> = {
  srs: { path: "docs/srs", label: "SRS", templatesPath: ".docops/templates/srs" },
  basicDesign: {
    path: "docs/basic-design",
    label: "Basic Design",
    templatesPath: ".docops/templates/basic-design",
  },
  detailDesign: {
    path: "docs/detail-design",
    label: "Detail Design",
    templatesPath: ".docops/templates/detail-design",
  },
  otherDocument: {
    path: "docs/other",
    label: "Other Document",
  },
};

/** Always present in docops.config.json but disabled unless explicitly enabled. */
export const OPTIONAL_DISABLED_LAYERS = new Set(["detailDesign", "otherDocument"]);

/** Template packs copied on init/migrate even when the layer is disabled in config. */
export const ALWAYS_BOOTSTRAP_TEMPLATE_LAYERS = new Set(["detailDesign"]);

export const LAYER_TEMPLATE_SUBDIR: Record<string, string> = {
  srs: "srs",
  basicDesign: "basic-design",
  detailDesign: "detail-design",
};

export const LAYER_TEMPLATES_PATH: Record<string, string> = {
  srs: ".docops/templates/srs",
  basicDesign: ".docops/templates/basic-design",
  detailDesign: ".docops/templates/detail-design",
};

export function buildDocTypesFromLayers(
  layers: string[] | undefined,
  inferred: Record<string, DocopsDocTypeConfig>,
): Record<string, DocopsDocTypeConfig> {
  const layerKeys = layers?.length
    ? layers
    : Object.keys(inferred).length
      ? Object.keys(inferred)
      : ["srs", "basicDesign"];

  const selected = new Set(layerKeys);
  const out: Record<string, DocopsDocTypeConfig> = {};

  for (const key of layerKeys) {
    const base = LAYER_DEFAULTS[key];
    if (!base) continue;
    const inferredLayer = inferred[key];
    out[key] = {
      ...base,
      ...inferredLayer,
      path: inferredLayer?.path?.trim() || base.path,
      enabled: inferredLayer?.enabled ?? true,
    };
  }

  for (const key of OPTIONAL_DISABLED_LAYERS) {
    if (selected.has(key) || out[key]) continue;
    const base = LAYER_DEFAULTS[key];
    if (!base) continue;
    out[key] = { ...base, enabled: false };
  }

  return out;
}

/** Add missing optional doc types (disabled) and persist-friendly patches for repair/migrate. */
export function ensureOptionalDocTypes(
  docTypes: Record<string, DocopsDocTypeConfig>,
): Record<string, DocopsDocTypeConfig> {
  const next = { ...docTypes };
  let changed = false;

  for (const key of OPTIONAL_DISABLED_LAYERS) {
    if (next[key]) continue;
    const base = LAYER_DEFAULTS[key];
    if (!base) continue;
    next[key] = { ...base, enabled: false };
    changed = true;
  }

  return changed ? next : docTypes;
}

/** Keys missing from docTypes that should be present (disabled by default). */
export function missingOptionalDocTypeKeys(
  docTypes: Record<string, DocopsDocTypeConfig> | undefined,
): string[] {
  if (!docTypes) {
    return [...OPTIONAL_DISABLED_LAYERS];
  }
  return [...OPTIONAL_DISABLED_LAYERS].filter((key) => !docTypes[key]);
}

export function templateLayerKeys(config: {
  docTypes?: Record<string, DocopsDocTypeConfig>;
}): string[] {
  const keys = new Set<string>();
  for (const [key, dt] of Object.entries(config.docTypes ?? {})) {
    if (dt?.enabled === false && !ALWAYS_BOOTSTRAP_TEMPLATE_LAYERS.has(key)) {
      continue;
    }
    if (dt?.templatesPath?.trim()) {
      keys.add(key);
    }
  }
  for (const key of ALWAYS_BOOTSTRAP_TEMPLATE_LAYERS) {
    keys.add(key);
  }
  return [...keys];
}
