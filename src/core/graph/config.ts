export interface DocflowProjectPaths {
  graph: string;
  registry: string;
  templates?: string;
}

export interface LanguageConfig {
  code: string;
  label: string;
}

export interface DocflowConfig {
  version: number;
  languages: LanguageConfig[];
  clientLanguage?: string;
  paths: DocflowProjectPaths;
}

const DEFAULT_PATHS: DocflowProjectPaths = {
  graph: ".ai-spector/graph/traceability.graph.json",
  registry: ".ai-spector/registry/section-registry.json",
  templates: ".ai-spector/templates",
};

const DEFAULT_LANGUAGE: LanguageConfig = { code: "en", label: "English" };

export function parseDocflowConfig(json: unknown): DocflowConfig {
  if (!json || typeof json !== "object") {
    throw new Error("docflow.config.json must be an object");
  }
  const raw = json as Partial<DocflowConfig>;
  const languages =
    Array.isArray(raw.languages) && raw.languages.length > 0
      ? raw.languages
      : [DEFAULT_LANGUAGE];
  const languageCodes = new Set(languages.map((l) => l.code));
  const clientLanguage =
    raw.clientLanguage && languageCodes.has(raw.clientLanguage)
      ? raw.clientLanguage
      : undefined;

  return {
    version: raw.version ?? 1,
    languages,
    ...(clientLanguage ? { clientLanguage } : {}),
    paths: {
      graph: raw.paths?.graph ?? DEFAULT_PATHS.graph,
      registry: raw.paths?.registry ?? DEFAULT_PATHS.registry,
      templates: raw.paths?.templates ?? DEFAULT_PATHS.templates,
    },
  };
}

export function primaryLanguage(config: DocflowConfig): LanguageConfig {
  return config.languages[0] ?? DEFAULT_LANGUAGE;
}

export function clientLanguage(config: DocflowConfig): LanguageConfig {
  if (config.clientLanguage) {
    const match = config.languages.find((l) => l.code === config.clientLanguage);
    if (match) return match;
  }
  return primaryLanguage(config);
}

export function languageCodes(config: DocflowConfig): string[] {
  return config.languages.map((l) => l.code);
}
