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
  /** Template pack configuration. When absent, the builtin manifests are used. */
  packs?: {
    /** Active custom pack name, e.g. "kaopiz-srs". "builtin" or absent → use builtin manifests. */
    active: string;
  };
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
  perDomain?: string;
}

export interface PackManifest extends DocumentsManifest {
  packName: string;
  description?: string;
  /** Prefix for generated per-domain node IDs, e.g. "doc.kaopiz". */
  nodePrefix?: string;
  /** Maps perDomain key → template documentId (replaces hardcoded PER_DOMAIN_TEMPLATE_DOC). */
  perDomainTemplates?: {
    useCase?: string;
    feature?: string;
    [key: string]: string | undefined;
  };
  /** Maps perDomain key → list anchor section/document ID (replaces hardcoded DEFAULT_LISTED_IN). */
  defaultListedIn?: {
    useCase?: string;
    feature?: string;
    actor?: string;
    [key: string]: string | undefined;
  };
}
