import type { DocflowConfig } from "../config/types.js";
import {
  bundledRulesImpactPath,
  bundledRulesTraceabilityPath,
  bundledSchemaPath,
  findProjectRoot,
  loadDocflowConfig,
  loadDocumentsManifest,
  packageBundleRoot,
  resolveFromRoot,
} from "../config/load.js";

export { findProjectRoot, packageBundleRoot };

export const findRepoRoot = findProjectRoot;

export interface ResolvedPaths {
  root: string;
  config: DocflowConfig;
  graph: string;
  registry: string;
  schema: string;
  rulesTraceability: string;
  rulesImpact: string;
  bundleRoot: string;
}

export async function resolveProjectPaths(
  root?: string,
): Promise<ResolvedPaths> {
  const loaded = await loadDocflowConfig(root);
  const { bundleRoot } = await loadDocumentsManifest();
  const p = loaded.config.paths;
  return {
    root: loaded.root,
    config: loaded.config,
    graph: resolveFromRoot(loaded.root, p.graph),
    registry: resolveFromRoot(loaded.root, p.registry),
    schema: bundledSchemaPath(),
    rulesTraceability: bundledRulesTraceabilityPath(),
    rulesImpact: bundledRulesImpactPath(),
    bundleRoot,
  };
}
