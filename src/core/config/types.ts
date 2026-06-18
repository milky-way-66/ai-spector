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

/** Per doc-type readiness override (keys: srs, basic-design, arc42, custom pack docType). */
export interface ReadinessDocTypeSetting {
  /** Tailoring profile for this doc type */
  profile?: string;
  /** When false, readiness_scan skips this doc type */
  enabled?: boolean;
}

/** Readiness tailoring — set in docflow.config.json; query via readiness_config MCP. */
export interface ReadinessConfig {
  /** Default profile when docTypes.<type>.profile is unset — must match a file in readiness/profiles/ */
  profile?: string;
  /**
   * Declared standards intent for the project (ISO-29148, IEC-62304, …).
   * Does not drive readiness_assess directly — scoring uses `doc-types/<docType>/readiness-criteria.json`
   * `standards[]` and per-criterion `iso29148` refs. Query alignment via readiness_config /
   * readiness_assess `standardsAlignment`.
   */
  standards?: string[];
  /** Per doc-type profile and enablement */
  docTypes?: Record<string, ReadinessDocTypeSetting>;
  /** Updated by readiness_scan — detects profile drift vs existing documents */
  lastScan?: {
    profile: string;
    docType: string;
    scannedAt: string;
  };
}

export interface DocflowConfig {
  version: number;
  /** Last ai-spector package version that synced project scaffold */
  scaffoldVersion?: string;
  /** Configured languages. First entry is the primary language. */
  languages: LanguageConfig[];
  /** Readiness tailoring — see readiness/profiles/ in docflow config. */
  readiness?: ReadinessConfig;
  /**
   * Language code the client prefers for document review and delivery.
   * Must be one of `languages[].code`. Defaults to the primary language when unset.
   */
  clientLanguage?: SupportedLanguageCode;
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
  /** Stated during template import — e.g. "SRS", "arc42", "ADR". Drives readiness criteria. */
  purpose?: string;
  /** Standards alignment (ISO 29148, arc42, …) — written to readiness-criteria.json. */
  standards?: string[];
  /** Context store + readiness docType key; defaults to packName when omitted. */
  docType?: string;
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
