import { join } from "node:path";
import { pathExists } from "../util/fs.js";
import { readDocopsConfig } from "./config.js";
import {
  DOCOPS_CONFIG_REL,
  LEGACY_DOCFLOW_CONFIG_REL,
  LEGACY_DOCOPS_PATHS,
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

export interface DocopsAssessment {
  layout: DocopsLayout;
  writerReady: boolean;
  gaps: DocopsGap[];
  recommendedAction: DocopsRecommendedAction;
  legacyPathsFound: string[];
  docopsPathsFound: string[];
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

      for (const [key, dt] of enabledDocTypes(config)) {
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
  if (writerReady) {
    recommendedAction = "ok";
  } else if (layout === "none") {
    recommendedAction = "init";
  } else if (layout === "legacy") {
    recommendedAction = "migrate";
  } else {
    recommendedAction = "repair";
  }

  return {
    layout,
    writerReady,
    gaps,
    recommendedAction,
    legacyPathsFound,
    docopsPathsFound,
  };
}
