import { cp, mkdir, readdir } from "node:fs/promises";
import { join } from "node:path";
import { packageBundleRoot } from "../config/load.js";
import type { DocflowConfig } from "../config/types.js";
import { pathExists } from "../util/fs.js";

const LAYER_PACK_FIELD: Record<string, keyof DocflowConfig["packs"]> = {
  srs: "srs",
  basicDesign: "basicDesign",
};

const LAYER_PROJECT_TEMPLATE_DIR: Record<string, string> = {
  srs: ".ai-spector/templates/srs",
  basicDesign: ".ai-spector/templates/basic_design",
  detailDesign: ".ai-spector/templates/detail_design",
};

export async function resolveTemplateSourcesForLayer(
  projectRoot: string,
  layerKey: string,
  docflow?: DocflowConfig | null,
): Promise<string[]> {
  const sources: string[] = [];
  const packField = LAYER_PACK_FIELD[layerKey];
  if (docflow && packField) {
    const packName = docflow.packs[packField];
    if (packName && packName !== "builtin") {
      sources.push(join(projectRoot, ".ai-spector/packs", packName, "templates"));
    }
  }
  const projectTpl = LAYER_PROJECT_TEMPLATE_DIR[layerKey];
  if (projectTpl) {
    sources.push(join(projectRoot, projectTpl));
  }
  const builtinMap: Record<string, string> = {
    srs: "templates/srs",
    basicDesign: "templates/basic_design",
    detailDesign: "templates/detail_design",
  };
  const builtin = builtinMap[layerKey];
  if (builtin) {
    sources.push(join(packageBundleRoot(), builtin));
  }
  return sources;
}

export async function countMarkdownInDir(absDir: string): Promise<number> {
  if (!(await pathExists(absDir))) return 0;
  let count = 0;
  const entries = await readdir(absDir, { withFileTypes: true });
  for (const ent of entries) {
    const child = join(absDir, ent.name);
    if (ent.isDirectory()) {
      count += await countMarkdownInDir(child);
    } else if (ent.isFile() && ent.name.endsWith(".md")) {
      count += 1;
    }
  }
  return count;
}

export interface CopyTemplatesOptions {
  projectRoot: string;
  layerKey: string;
  destRel: string;
  sources: string[]; // absolute dirs, priority order
  dryRun?: boolean;
}

export interface CopyTemplatesResult {
  copied: boolean;
  actions: string[];
}

export async function copyTemplates(opts: CopyTemplatesOptions): Promise<CopyTemplatesResult> {
  const { projectRoot, layerKey, destRel, sources, dryRun = false } = opts;
  const actions: string[] = [];
  const destAbs = join(projectRoot, destRel);
  const existing = await countMarkdownInDir(destAbs);
  if (existing > 0) {
    actions.push(`skip templates/${layerKey} (destination has ${existing} .md)`);
    return { copied: false, actions };
  }

  for (const srcAbs of sources) {
    if (!(await pathExists(srcAbs))) continue;
    const srcCount = await countMarkdownInDir(srcAbs);
    if (srcCount === 0) continue;

    actions.push(
      `${dryRun ? "would copy" : "copy"} ${srcAbs.replace(projectRoot, ".")} → ${destRel}/ (${srcCount} .md)`,
    );
    if (!dryRun) {
      await mkdir(destAbs, { recursive: true });
      await cp(srcAbs, destAbs, { recursive: true, force: false });
    }
    return { copied: true, actions };
  }

  actions.push(`warn templates/${layerKey}: no non-empty source found`);
  return { copied: false, actions };
}
