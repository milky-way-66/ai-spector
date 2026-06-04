export interface DocflowProjectPaths {
  graph: string;
  registry: string;
  /** Project-local template copy (set by `ai-spector init`). */
  templates?: string;
}

export interface LanguageConfig {
  /** BCP-47 language code, e.g. "en", "jp", "vi" */
  code: string;
  /** Human-readable display name, e.g. "English" */
  label: string;
}

export interface DocflowConfig {
  version: number;
  /** Configured languages. First entry is the primary language. */
  languages: LanguageConfig[];
  paths: DocflowProjectPaths;
}

export interface DocumentsManifest {
  version: number;
  name: string;
  templatesDir: string;
  documents: ManifestDocument[];
}

export interface ManifestDocument {
  documentId: string;
  template: string;
  output?: string;
  outputPattern?: string;
  perDomain?: "useCase" | "feature";
}
