import type { DocopsCapabilities } from "./paths.js";
import { DEFAULT_CAPABILITIES } from "./paths.js";
import type { DocopsConfig } from "./types.js";

/** Maps ai-spector plugin ids to Writer `capabilities` keys (see plugin-features design). */
export const PLUGIN_CAPABILITY_MAP: Record<string, keyof DocopsCapabilities> = {
  comments: "comments",
  review: "review",
  prototype: "prototype",
  graph: "graph",
  translate: "translate",
  "generate-srs": "generate",
  "generate-basic-design": "generate",
  "generate-detail-design": "generate",
};

/** Default resolved plugin set when docflow.config.json has no plugins block. */
export const DEFAULT_RESOLVED_PLUGINS = [
  "docs",
  "comments",
  "review",
  "translate",
  "prototype",
  "index",
  "graph",
  "analyze",
  "generate-srs",
  "generate-basic-design",
  "generate-detail-design",
  "resolve-task",
  "sync-audit",
  "template-import",
  "adopt",
  "search",
] as const;

/**
 * Sync Writer-facing `capabilities` from resolved plugin ids.
 * Writer contract is authoritative for web; plugins gate CLI/MCP only.
 */
export function syncCapabilitiesFromPlugins(
  config: DocopsConfig,
  resolvedPlugins: readonly string[] = DEFAULT_RESOLVED_PLUGINS,
): DocopsConfig {
  const capabilities: DocopsCapabilities = { ...DEFAULT_CAPABILITIES };

  for (const pluginId of resolvedPlugins) {
    const key = PLUGIN_CAPABILITY_MAP[pluginId];
    if (key) {
      capabilities[key] = true;
    }
  }

  return {
    ...config,
    capabilities,
  };
}

export function resolvedPluginsFromDocflow(docflow: {
  plugins?: { resolved?: string[]; enabled?: string[] };
}): string[] {
  const resolved = docflow.plugins?.resolved;
  if (Array.isArray(resolved) && resolved.length > 0) {
    return resolved;
  }
  const enabled = docflow.plugins?.enabled;
  if (Array.isArray(enabled) && enabled.length > 0) {
    return ["docs", ...enabled.filter((id) => id !== "docs")];
  }
  return [...DEFAULT_RESOLVED_PLUGINS];
}
