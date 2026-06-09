export interface DocflowProjectPaths {
  graph: string;
  registry: string;
  /** Project-local template copy (set by `ai-spector init`). */
  templates?: string;
}

/** Supported language codes. */
export const SUPPORTED_LANGUAGE_CODES = ["en", "jp", "vi"] as const;
export type SupportedLanguageCode = (typeof SUPPORTED_LANGUAGE_CODES)[number];

/**
 * Asserts that `code` is a supported language code and narrows its type.
 * Throws a user-readable error if unsupported.
 */
export function assertSupportedLanguageCode(code: string): SupportedLanguageCode {
  if (!(SUPPORTED_LANGUAGE_CODES as readonly string[]).includes(code)) {
    throw new Error(
      `Unsupported language code "${code}" — supported: ${SUPPORTED_LANGUAGE_CODES.join(", ")}`,
    );
  }
  return code as SupportedLanguageCode;
}

export interface LanguageConfig {
  /** Supported language code: "en" | "jp" | "vi" */
  code: SupportedLanguageCode;
  /** Human-readable display name, e.g. "English" */
  label: string;
}

export interface DocflowConfig {
  version: number;
  /** Configured languages. First entry is the primary language. */
  languages: LanguageConfig[];
  paths: DocflowProjectPaths;
  /** Active template packs per document group. "builtin" means the built-in templates. */
  packs: {
    /** SRS pack name: "builtin" (default) or a custom pack name, e.g. "kaopiz-srs". */
    srs: string;
    /** Basic-design pack name: "builtin" (default) or a custom pack name. */
    basicDesign: string;
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
