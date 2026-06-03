export interface PrototypeBasicAuth {
  username: string;
  password: string;
  setAt: string;
}

export interface PrototypeConfig {
  version: number;
  listScreenDoc: string;
  screenIndexSection: string;
  screenDetailDir: string;
  prototypeDir: string;
  srcDir: string;
  slugFrom: "screenName";
  defaultTheme: string;
  /** Screen Index id used as prototype entry / nginx default route. */
  defaultScreenId?: string;
  /** Repo-relative path to Apache htpasswd file (nginx basic auth). */
  htpasswdFile: string;
  basicAuth?: PrototypeBasicAuth;
}

export interface ScreenIndexRow {
  screenId: string;
  displayName: string;
  purpose?: string;
  userRole?: string;
  slug: string;
  screenDoc: string;
  prototypeStem: string;
  prototypePath: string;
}

export interface PrototypeManifestScreen {
  screenId: string;
  displayName: string;
  prototypeStem: string;
  screenDoc: string;
  purpose?: string;
  userRole?: string;
}

export interface PrototypeManifest {
  schemaVersion: 1;
  themeName: string;
  generatedAt: string;
  screens: PrototypeManifestScreen[];
}

export interface PrototypeScreenMapEntry {
  screenId: string;
  displayName: string;
  screenDoc: string;
  prototypeStem: string;
  prototypePath: string;
  htmlExists: boolean;
}

export interface PrototypeScreenMap {
  schemaVersion: 1;
  themeName: string;
  generatedAt: string;
  /** Entry screen at generation time (from screens with HTML when any exist). */
  defaultScreenId?: string;
  screens: PrototypeScreenMapEntry[];
}
