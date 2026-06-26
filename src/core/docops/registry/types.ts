export type DocumentEntityKind = "document" | "data_source";
export type ScreenEntityKind = "prototype_screen";

export interface DocumentEntity {
  schemaVersion: 1;
  entityId: string;
  kind: DocumentEntityKind;
  docType: string;
  logicalPath: string;
  repoDocs: Record<string, string>;
  displayName?: string;
  aliases?: string[];
  createdAt?: string;
  updatedAt?: string;
}

export interface ScreenEntity {
  schemaVersion: 1;
  screenId: string;
  kind: ScreenEntityKind;
  displayName?: string;
  documentEntityId?: string | null;
  prototypePath: string;
  route_exists: boolean;
  reviewUrl?: string | null;
  updatedAt?: string;
}

export interface RegistryManifest {
  schemaVersion: 1;
  buildMode: "static" | "spa";
  defaultScreenId?: string;
  reviewHost?: string;
  projectId?: string;
  deployVersion?: string;
  directReviewUrl?: boolean;
  themeName?: string;
}

export interface RegistrySyncResult {
  documentsCreated: number;
  documentsUpdated: number;
  screensCreated: number;
  screensUpdated: number;
  manifestWritten: boolean;
  screenMapRemoved: boolean;
  warnings: string[];
  actions: string[];
}
