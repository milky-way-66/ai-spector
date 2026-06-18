import { readFile, readdir, mkdir } from "node:fs/promises";
import { join, relative } from "node:path";
import { visit } from "unist-util-visit";
import { loadDocflowConfig } from "../config/load.js";
import { parseMarkdown, textContent, type Heading } from "../markdown/parse.js";
import { pathExists, writeJson } from "../util/fs.js";
import {
  classifyDataSource,
  classifyLayer,
  classifyPrototype,
  detectLanguageLayout,
  extractDomainIds,
  type AdoptClassifyFile,
} from "./classify.js";
import { adoptArtifactPaths } from "./paths.js";
import { loadAdoptContext } from "./setup.js";
import type {
  AdoptInventoryItem,
  AdoptQuestion,
  AdoptScanResult,
} from "./types.js";

const SCAN_LAYER_DIRS = [
  { relativeDir: "docs/srs", layer: "srs" as const },
  { relativeDir: "docs/basic-design", layer: "basic-design" as const },
  { relativeDir: "docs/detail-design", layer: "detail-design" as const },
  { relativeDir: "docs/data-source", layer: "data-source" as const },
];

const LEGACY_ALIAS_DIRS = [
  { relativeDir: "docs/dd", layer: "detail-design" as const },
  { relativeDir: "docs/detail_design", layer: "detail-design" as const },
];

async function collectMdFiles(root: string, relativeDir: string): Promise<string[]> {
  const absDir = join(root, relativeDir);
  if (!(await pathExists(absDir))) return [];

  const results: string[] = [];

  async function walk(current: string): Promise<void> {
    let entries;
    try {
      entries = await readdir(current, { withFileTypes: true });
    } catch {
      return;
    }

    for (const entry of entries) {
      if (entry.name.startsWith(".")) continue;
      const full = join(current, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === "node_modules") continue;
        await walk(full);
        continue;
      }
      if (entry.isFile() && entry.name.endsWith(".md")) {
        results.push(full);
      }
    }
  }

  await walk(absDir);
  return results.sort();
}

function toProjectRelativePath(root: string, absPath: string): string {
  return relative(root, absPath).replace(/\\/g, "/");
}

async function parseInventoryFile(
  root: string,
  absPath: string,
  layer: AdoptInventoryItem["layer"],
): Promise<AdoptInventoryItem> {
  const content = await readFile(absPath, "utf8");
  const ast = parseMarkdown(content);
  const headings: Array<{ depth: number; text: string }> = [];

  visit(ast, "heading", (node: Heading) => {
    headings.push({
      depth: node.depth,
      text: textContent(node),
    });
  });

  return {
    path: toProjectRelativePath(root, absPath),
    layer,
    signals: {
      headings,
      ids: extractDomainIds(content),
    },
  };
}

function buildLangPrimaryQuestion(primaryLang: string): AdoptQuestion {
  return {
    id: "lang-primary",
    prompt: `Docs are flat under docs/srs/ — treat as language '${primaryLang}'?`,
    blocking: true,
  };
}

export async function runAdoptScan(opts: { root?: string } = {}): Promise<AdoptScanResult> {
  let loaded;
  try {
    loaded = await loadDocflowConfig(opts.root);
  } catch {
    throw new Error("Project not initialized — run: npx ai-spector init");
  }

  const { root, config } = loaded;
  const paths = adoptArtifactPaths(root);
  await mkdir(paths.dir, { recursive: true });

  const inventory: AdoptInventoryItem[] = [];
  const layoutPaths: string[] = [];
  let srsMdCount = 0;
  let dataSourceMdCount = 0;

  for (const { relativeDir, layer } of SCAN_LAYER_DIRS) {
    if (layer === "data-source" && !(await pathExists(join(root, relativeDir)))) {
      continue;
    }

    const files = await collectMdFiles(root, relativeDir);
    for (const absPath of files) {
      const item = await parseInventoryFile(root, absPath, layer);
      inventory.push(item);
      const relPath = item.path;
      layoutPaths.push(relPath);
      if (layer === "srs") srsMdCount += 1;
      if (layer === "data-source") dataSourceMdCount += 1;
    }
  }

  for (const { relativeDir, layer } of LEGACY_ALIAS_DIRS) {
    const files = await collectMdFiles(root, relativeDir);
    for (const absPath of files) {
      const item = await parseInventoryFile(root, absPath, layer);
      if (!inventory.some((existing) => existing.path === item.path)) {
        inventory.push(item);
        layoutPaths.push(item.path);
      }
    }
  }

  const srsFiles: AdoptClassifyFile[] = inventory
    .filter((item) => item.layer === "srs")
    .map((item) => ({
      relativePath: item.path.replace(/^docs\/srs\//, ""),
      headings: item.signals.headings,
      ids: item.signals.ids,
    }));

  const basicDesignFiles: AdoptClassifyFile[] = inventory
    .filter((item) => item.layer === "basic-design")
    .map((item) => ({
      relativePath: item.path.replace(/^docs\/basic-design\//, ""),
      headings: item.signals.headings,
      ids: item.signals.ids,
    }));

  const detailDesignFiles: AdoptClassifyFile[] = inventory
    .filter((item) => item.layer === "detail-design")
    .map((item) => ({
      relativePath: item.path
        .replace(/^docs\/detail-design\//, "")
        .replace(/^docs\/dd\//, "")
        .replace(/^docs\/detail_design\//, ""),
      headings: item.signals.headings,
      ids: item.signals.ids,
    }));

  const languages = detectLanguageLayout(layoutPaths);
  const context = await loadAdoptContext(root);
  const questionsForUser: AdoptQuestion[] = [];

  if (languages.strategy === "flat" && !context["lang-primary"]) {
    const primaryLang = config.languages[0]?.code ?? "en";
    questionsForUser.push(buildLangPrimaryQuestion(primaryLang));
  }

  const result: AdoptScanResult = {
    scannedAt: new Date().toISOString(),
    classification: {
      srs: classifyLayer(srsFiles, "srs"),
      basicDesign: classifyLayer(basicDesignFiles, "basic-design"),
      detailDesign: classifyLayer(detailDesignFiles, "detail-design"),
      prototype: await classifyPrototype(root),
      languages,
      dataSource: classifyDataSource(srsMdCount, dataSourceMdCount),
      activePack: config.packs.srs ?? "builtin",
    },
    inventory,
    questionsForUser,
  };

  await writeJson(paths.scanResult, result);
  return result;
}
