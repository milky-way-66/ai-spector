import { join } from "node:path";
import { pathExists } from "../util/fs.js";
import { assessEntityRegistry } from "./entity-keying.js";
import { readDocopsConfig } from "./config.js";
import { missingOptionalDocTypeKeys } from "./layer-defaults.js";
import {
  DOCOPS_CONFIG_REL,
  isNonCanonicalDocTypePath,
  LEGACY_DOCFLOW_CONFIG_REL,
  LEGACY_DOCOPS_PATHS,
  normalizeDocTypePath,
} from "./paths.js";
import { countMarkdownInDir } from "./templates.js";
import type { DocopsConfig } from "./types.js";

export type DocopsLayout = "none" | "legacy" | "docops" | "mixed";
export type DocopsRecommendedAction = "init" | "migrate" | "repair" | "ok";

export interface DocopsGap {
  id: string;
  severity: "blocking" | "warning";
  message: string;
  fix?: string;
}

export interface DocopsEntityRegistryAssessment {
  keying: "entityId" | "logicalPath";
  documentCount: number;
  expectedCount: number;
  synced: boolean;
}

export interface DocopsAssessment {
  layout: DocopsLayout;
  writerReady: boolean;
  gaps: DocopsGap[];
  recommendedAction: DocopsRecommendedAction;
  legacyPathsFound: string[];
  docopsPathsFound: string[];
  entityRegistry?: DocopsEntityRegistryAssessment;
}

async function fileExists(projectRoot: string, rel: string): Promise<boolean> {
  return pathExists(join(projectRoot, rel));
}

function enabledDocTypes(
  config: DocopsConfig,
): Array<[string, NonNullable<DocopsConfig["docTypes"]>[string]]> {
  if (!config.docTypes) return [];
  return Object.entries(config.docTypes).filter(([, v]) => v?.enabled !== false);
}

export async function assessDocopsProject(projectRoot: string): Promise<DocopsAssessment> {
  const gaps: DocopsGap[] = [];
  const legacyPathsFound: string[] = [];
  const docopsPathsFound: string[] = [];

  const hasDocopsConfig = await fileExists(projectRoot, DOCOPS_CONFIG_REL);
  const hasLegacyDocflow = await fileExists(projectRoot, LEGACY_DOCFLOW_CONFIG_REL);

  for (const rel of Object.values(LEGACY_DOCOPS_PATHS)) {
    if (await fileExists(projectRoot, rel)) legacyPathsFound.push(rel);
  }
  if (hasLegacyDocflow) legacyPathsFound.push(LEGACY_DOCFLOW_CONFIG_REL);

  if (hasDocopsConfig) docopsPathsFound.push(DOCOPS_CONFIG_REL);

  let layout: DocopsLayout;
  if (!hasDocopsConfig && !hasLegacyDocflow) {
    layout = "none";
  } else if (!hasDocopsConfig && hasLegacyDocflow) {
    layout = "legacy";
  } else if (hasDocopsConfig && !hasLegacyDocflow && legacyPathsFound.length === 0) {
    layout = "docops";
  } else {
    layout = "mixed";
  }

  let config: DocopsConfig | null = null;
  if (hasDocopsConfig) {
    config = await readDocopsConfig(projectRoot);
    if (!config) {
      gaps.push({
        id: "DOCOPS-001",
        severity: "blocking",
        message: `${DOCOPS_CONFIG_REL} exists but is invalid JSON`,
        fix: "Fix JSON or run docops init --force",
      });
    } else {
      const caps = config.capabilities ?? {};
      if (caps.review) {
        const reviewCfg = config.paths.reviewConfig;
        const registry = join(config.paths.reviewQueue, "registry.json").replace(/\\/g, "/");
        if (!(await fileExists(projectRoot, reviewCfg))) {
          gaps.push({
            id: "DOCOPS-REV-001",
            severity: "blocking",
            message: `Missing ${reviewCfg}`,
            fix: "Run docops migrate --repair or docops init --force",
          });
        } else {
          docopsPathsFound.push(reviewCfg);
        }
        if (!(await fileExists(projectRoot, registry))) {
          gaps.push({
            id: "DOCOPS-REV-002",
            severity: "blocking",
            message: `Missing ${registry}`,
            fix: "Run docops migrate --repair or docops init --force",
          });
        } else {
          docopsPathsFound.push(registry);
        }
      }

      const docsRoot = config.docsRoot?.trim() || "docs";
      const missingOptional = missingOptionalDocTypeKeys(config.docTypes);
      if (missingOptional.length > 0) {
        gaps.push({
          id: "DOCOPS-CFG-OPTIONAL",
          severity: "warning",
          message: `docops.config.json missing docTypes: ${missingOptional.join(", ")}`,
          fix: "Run docops migrate --repair",
        });
      }

      for (const [key, dt] of enabledDocTypes(config)) {
        const layerPath = dt.path?.trim();
        if (layerPath && isNonCanonicalDocTypePath(key, layerPath, docsRoot)) {
          const canonical = normalizeDocTypePath(key, layerPath, docsRoot);
          gaps.push({
            id: `DOCOPS-PATH-${key}`,
            severity: "blocking",
            message: `docTypes.${key}.path is "${layerPath}" — expected "${canonical}"`,
            fix: "Run docops migrate --repair (do not hand-edit paths to bare segment names)",
          });
        }

        const tpl = dt.templatesPath?.trim();
        if (!tpl) continue;
        const mdCount = await countMarkdownInDir(join(projectRoot, tpl));
        if (mdCount === 0) {
          gaps.push({
            id: `DOCOPS-TPL-${key}`,
            severity: "blocking",
            message: `No templates in ${tpl}`,
            fix: "Run docops migrate --templates-only or docops migrate --repair",
          });
        } else {
          docopsPathsFound.push(tpl);
        }
      }

      const detailDesignTpl = config.docTypes?.detailDesign?.templatesPath?.trim()
        ?? ".docops/templates/detail-design";
      const ddTplCount = await countMarkdownInDir(join(projectRoot, detailDesignTpl));
      if (ddTplCount === 0) {
        gaps.push({
          id: "DOCOPS-TPL-detailDesign",
          severity: "warning",
          message: `No templates in ${detailDesignTpl}`,
          fix: "Run docops migrate --repair",
        });
      } else {
        docopsPathsFound.push(detailDesignTpl);
      }

      const readmeRel = ".docops/guide/README.md";
      if (!(await fileExists(projectRoot, readmeRel))) {
        gaps.push({
          id: "DOCOPS-DOC-001",
          severity: "warning",
          message: `Missing ${readmeRel}`,
          fix: "Run docops migrate --repair or docops init --force",
        });
      } else {
        docopsPathsFound.push(readmeRel);
      }

      const entityStatus = await assessEntityRegistry(projectRoot);
      if (entityStatus) {
        const registryRoot = config.paths.registry.replace(/\\/g, "/");
        if (entityStatus.keying === "logicalPath") {
          gaps.push({
            id: "DOCOPS-REG-LEGACY",
            severity: "warning",
            message:
              "Legacy path-keyed comments/review — entity IDs not active (will be removed in a future release)",
            fix: "Run docops registry sync, comments migrate, review-registry migrate (see ENTITY_REGISTRY_MIGRATION.md)",
          });
        } else if (!entityStatus.synced && entityStatus.expectedCount > 0) {
          gaps.push({
            id: "DOCOPS-REG-001",
            severity: "warning",
            message: `Entity registry out of date — ${entityStatus.documentCount}/${entityStatus.expectedCount} document entity file(s) under ${registryRoot}/documents/`,
            fix: "Run npx ai-spector docops registry sync (or npx ai-spector index)",
          });
        } else if (entityStatus.expectedCount === 0 && entityStatus.documentCount === 0) {
          docopsPathsFound.push(`${registryRoot}/`);
        } else if (entityStatus.synced) {
          docopsPathsFound.push(`${registryRoot}/documents/`);
        }
      }
    }
  } else {
    gaps.push({
      id: "DOCOPS-001",
      severity: "blocking",
      message: `Missing ${DOCOPS_CONFIG_REL}`,
      fix: hasLegacyDocflow ? "Run docops migrate" : "Run docops init",
    });
  }

  const blocking = gaps.filter((g) => g.severity === "blocking");
  const writerReady = hasDocopsConfig && blocking.length === 0;

  let recommendedAction: DocopsRecommendedAction;
  if (writerReady && gaps.some((g) => g.id.startsWith("DOCOPS-CFG-OPTIONAL") || g.id === "DOCOPS-TPL-detailDesign")) {
    recommendedAction = "repair";
  } else if (writerReady) {
    recommendedAction = "ok";
  } else if (layout === "none") {
    recommendedAction = "init";
  } else if (layout === "legacy") {
    recommendedAction = "migrate";
  } else {
    recommendedAction = "repair";
  }

  const entityRegistry = hasDocopsConfig ? (await assessEntityRegistry(projectRoot)) ?? undefined : undefined;

  return {
    layout,
    writerReady,
    gaps,
    recommendedAction,
    legacyPathsFound,
    docopsPathsFound,
    ...(entityRegistry ? { entityRegistry } : {}),
  };
}
