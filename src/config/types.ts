export interface DocflowProjectPaths {
  graph: string;
  registry: string;
}

export interface DocflowConfig {
  version: number;
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
