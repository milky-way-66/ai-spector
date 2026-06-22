import type { DocopsCapabilities, DocopsPathKey } from "./paths.js";

export interface DocopsDocTypeConfig {
  enabled: boolean;
  path: string;
  label: string;
  templatesPath?: string;
}

export interface DocopsConfig {
  schemaVersion: string;
  docsRoot: string;
  languages: Array<{ code: string; label: string; path?: string }>;
  primaryLanguage?: string;
  internalLanguage?: string;
  clientLanguage?: string;
  docTypes?: Record<string, DocopsDocTypeConfig>;
  paths: Record<DocopsPathKey, string>;
  capabilities: DocopsCapabilities;
}
