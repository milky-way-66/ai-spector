import { join } from "node:path";
import { DOCOPS_ROOT } from "../docops/paths.js";
import { scaffoldBundleRoot } from "./load.js";

export const DOCFLOW_CONFIG_REL = ".ai-spector/.docflow/config";
export const DOCOPS_PROTOTYPE_CONFIG_REL = `${DOCOPS_ROOT}/prototype/config.json`;

export function docflowConfigDir(root: string): string {
  return join(root, DOCFLOW_CONFIG_REL);
}

export function workspaceConfigDir(root: string): string {
  return join(docflowConfigDir(root), "workspace");
}

export function workspaceLanguagePath(root: string): string {
  return join(workspaceConfigDir(root), "language.json");
}

export function workspaceRulesPath(root: string): string {
  return join(workspaceConfigDir(root), "rules.json");
}

export function workspaceWorkflowDependenciesPath(root: string): string {
  return join(workspaceConfigDir(root), "workflow.dependencies.json");
}

export function workspaceIndexDocsPath(root: string): string {
  return join(workspaceConfigDir(root), "index.docs.json");
}

export function workspaceDataSourcePath(root: string): string {
  return join(workspaceConfigDir(root), "data-source.json");
}

export function prototypeConfigDir(root: string): string {
  return join(root, DOCOPS_ROOT, "prototype");
}

export function prototypeConfigPath(root: string): string {
  return join(prototypeConfigDir(root), "config.json");
}

export function bundledPrototypeConfigPath(): string {
  return join(scaffoldBundleRoot(), DOCOPS_PROTOTYPE_CONFIG_REL);
}

export function docTypeConfigDir(root: string, docTypeOrPack: string): string {
  return join(docflowConfigDir(root), "doc-types", docTypeOrPack);
}

export function docTypeDagPath(root: string, docType: string): string {
  return join(docTypeConfigDir(root, docType), "dag.json");
}

export function docTypeDagGraphSeedsPath(root: string, docType: string): string {
  return join(docTypeConfigDir(root, docType), "dag.graph-seeds.json");
}

export function docTypeCompletenessRulesPath(root: string, docTypeOrPack: string): string {
  return join(docTypeConfigDir(root, docTypeOrPack), "completeness-rules.json");
}

export function docTypeReadinessCriteriaPath(root: string, docTypeOrPack: string): string {
  return join(docTypeConfigDir(root, docTypeOrPack), "readiness-criteria.json");
}

/** User-extensible review checklists — drop `.json` files per doc type. */
export function reviewChecklistsDir(root: string): string {
  return join(docflowConfigDir(root), "review-checklists");
}

export function reviewChecklistsDocTypeDir(root: string, docType: string): string {
  return join(reviewChecklistsDir(root), docType);
}

export function readinessProfilesDir(): string {
  return join(scaffoldBundleRoot(), DOCFLOW_CONFIG_REL, "readiness/profiles");
}

/** Workspace-relative path for display (e.g. MCP output, skills). */
export function relFromRoot(root: string, absolutePath: string): string {
  const prefix = root.endsWith("/") ? root : root + "/";
  return absolutePath.startsWith(prefix) ? absolutePath.slice(prefix.length) : absolutePath;
}
