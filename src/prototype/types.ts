export interface PrototypeBasicAuth {
  username: string;
  password: string;
  setAt: string;
}

/** "static" = one HTML file per screen; "spa" = single entrypoint, route per screen. */
export type PrototypeBuildMode = "static" | "spa";

/**
 * Tech stack used to author the prototype.
 * - "html"   plain HTML/CSS/JS, no framework
 * - "vue"    Vue 3 SPA (Vite + Vue Router)
 * - "react"  React SPA (Vite + React Router)
 * - "nuxt"   Nuxt 3 (file-system routing)
 * - "next"   Next.js (file-system routing)
 * - "svelte" SvelteKit
 * - "angular" Angular
 */
export type PrototypeTechStack =
  | "html"
  | "vue"
  | "react"
  | "nuxt"
  | "next"
  | "svelte"
  | "angular";

export interface PrototypeConfig {
  version: number;
  listScreenDoc: string;
  screenIndexSection: string;
  screenDetailDir: string;
  prototypeDir: string;
  srcDir: string;
  slugFrom: "screenName";
  defaultTheme: string;
  /**
   * Tech stack chosen for authoring the prototype.
   * Stored after the stack-picker runs; absent means "not yet chosen".
   */
  techStack?: PrototypeTechStack;
  /**
   * Build mode for the prototype.
   * - "static" (default): one HTML file per screen, URI maps to /src/<stem>.html
   * - "spa": single entrypoint app (React, Vue, etc.), URI maps to /<slug> route
   * Derived from techStack when not explicitly set.
   */
  buildMode?: PrototypeBuildMode;
  /**
   * Repo-relative path to the SPA/framework build output directory (e.g. "frontend/dist").
   * Used by `prototype sync` to know where to copy built files from.
   * Only relevant when buildMode is "spa" or when the user builds files outside prototype/.
   */
  buildSrc?: string;
  /**
   * Repo-relative destination path for synced build output (e.g. "prototype/dist").
   * Defaults to prototypeDir + "/dist".
   */
  buildDest?: string;
  /** Screen Index id used as prototype entry / nginx default route. */
  defaultScreenId?: string;
  /** Repo-relative path to Apache htpasswd file (nginx basic auth). */
  htpasswdFile: string;
  basicAuth?: PrototypeBasicAuth;
  /**
   * When true (default for SPA prototypes), router auth guards must allow direct navigation
   * to any screen without forcing login first. Set false to test real auth flows.
   */
  prototypeBypassAuth?: boolean;
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
  /**
   * Route path for this screen.
   * - static mode: "/src/<stem>.html"
   * - spa mode: "/<slug>" or a pattern with params (e.g. "/orders/:id")
   */
  uri: string;
  htmlExists: boolean;
  /**
   * SPA only: explicit router pattern when it differs from the slug-only path.
   * Usually the same as `uri`; set when the app uses param segments.
   */
  routePattern?: string;
  /** SPA only: default path-param values for prototype deep links (e.g. `{ "id": "demo-001" }`). */
  routeParams?: Record<string, string>;
  /** SPA only: default query params appended to `previewUri`. */
  queryParams?: Record<string, string>;
  /**
   * SPA only: concrete URL to open this screen in a browser (params substituted, query appended).
   * Hosting and reviewers use this instead of typing IDs manually.
   */
  previewUri?: string;
  /** SPA only: production would require login; prototype still allows direct `previewUri` access. */
  requiresAuth?: boolean;
}

export interface PrototypeScreenMap {
  schemaVersion: 1;
  themeName: string;
  buildMode: PrototypeBuildMode;
  generatedAt: string;
  /** Entry screen at generation time (from screens with HTML when any exist). */
  defaultScreenId?: string;
  /**
   * SPA only: when true, generated router must not redirect unauthenticated users to login
   * when opening a deep-linked route (prototype review mode).
   */
  prototypeBypassAuth?: boolean;
  screens: PrototypeScreenMapEntry[];
}
