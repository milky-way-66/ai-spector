import { join } from "node:path";

/** Writer-owned contract root (see kari-writer/contracts/CONTRACT.md). */
export const DOCOPS_ROOT = ".docops";

export const DOCOPS_CONFIG_REL = `${DOCOPS_ROOT}/docops.config.json`;
export const LEGACY_DOCFLOW_CONFIG_REL = ".ai-spector/docflow.config.json";

export const DEFAULT_DOCOPS_PATHS = {
  comments: ".docops/comments",
  reviewConfig: ".docops/review.config.json",
  reviewQueue: ".docops/review-queue",
  prototypeConfig: ".docops/prototype/config.json",
  prototypeScreenMap: ".docops/prototype/screen-map.json",
} as const;

/** Legacy layout before `.docops/` contract (ai-spector + Writer dual-read). */
export const LEGACY_DOCOPS_PATHS = {
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
    path: "srs",
    label: "SRS",
    templatesPath: ".docops/templates/srs",
  },
  {
    docsPrefix: "docs/basic-design",
    key: "basicDesign",
    path: "basic-design",
    label: "Basic Design",
    templatesPath: ".docops/templates/basic-design",
  },
  {
    docsPrefix: "docs/detail-design",
    key: "detailDesign",
    path: "detail-design",
    label: "Detail Design",
    templatesPath: ".docops/templates/detail-design",
  },
];

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
