import { readdir } from "node:fs/promises";
import { join, relative } from "node:path";
import { findProjectRoot } from "../config/load.js";
import { pathExists } from "../util/fs.js";
import { readDocopsConfig } from "./config.js";
import {
  classifyDataSource,
  classifyLayer,
  classifyPrototype,
  detectLanguageLayout,
  type DocopsClassifyFile,
  type DocopsLangStrategy,
  type DocopsLayerClass,
} from "./layout-classify.js";

const LAYER_KEYS = ["srs", "basicDesign", "detailDesign"] as const;
type LayerKey = (typeof LAYER_KEYS)[number];

const DISCOVERY_ALIASES: Record<LayerKey, string[]> = {
  srs: ["docs/srs"],
  basicDesign: ["docs/basic-design", "docs/bd", "docs/basic_design"],
  detailDesign: ["docs/detail-design", "docs/dd", "docs/detail_design"],
};

export interface DocopsLayerOnDisk {
  configuredPath: string | null;
  roots: Array<{ path: string; fileCount: number }>;
  languageLayout: DocopsLangStrategy;
  detectedLanguages: string[];
  classification: DocopsLayerClass;
}

export interface DocopsLayoutProbeResult {
  probedAt: string;
  configuredPaths: Partial<Record<LayerKey, string>>;
  onDisk: Partial<Record<LayerKey, DocopsLayerOnDisk>>;
  dataSource: { path: string; fileCount: number } | null;
  suggestions: string[];
  agentPrompt: string;
}

async function collectMdFiles(absDir: string): Promise<string[]> {
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

function stripLayerPrefix(layerKey: LayerKey, projectRel: string): string {
  const prefixes: Record<LayerKey, RegExp> = {
    srs: /^docs\/srs\//,
    basicDesign: /^docs\/(?:basic-design|bd|basic_design)\//,
    detailDesign: /^docs\/(?:detail-design|dd|detail_design)\//,
  };
  return projectRel.replace(prefixes[layerKey], "");
}

function buildSuggestions(result: Omit<DocopsLayoutProbeResult, "suggestions" | "agentPrompt">): string[] {
  const lines: string[] = [];

  for (const key of LAYER_KEYS) {
    const layer = result.onDisk[key];
    const configured = result.configuredPaths[key];
    if (!layer) continue;

    const primaryRoot = layer.roots[0];
    if (!primaryRoot || primaryRoot.fileCount === 0) {
      if (configured) {
        lines.push(
          `No markdown under configured docTypes.${key}.path (${configured}) — add docs or point path at an existing folder.`,
        );
      }
      continue;
    }

    const topRoot = layer.roots.reduce((a, b) => (b.fileCount > a.fileCount ? b : a));
    if (configured && topRoot.path !== configured.replace(/\\/g, "/")) {
      lines.push(
        `Docs for ${key} found under ${topRoot.path} (${topRoot.fileCount} file(s)) but config says ${configured} — ` +
          `edit docTypes.${key}.path in .docops/docops.config.json OR move files (prefer editing config).`,
      );
    }

    if (layer.languageLayout === "flat") {
      lines.push(
        `${key}: files are flat (no per-language subfolders). Recommended: docs/<layer>/{lang}/… or set primaryLanguage in config.`,
      );
    }
    if (layer.languageLayout === "mixed") {
      lines.push(`${key}: mixed flat and per-language folders — normalize layout or document primaryLanguage.`);
    }
  }

  if (lines.length === 0) {
    lines.push(
      "On-disk layout matches configured paths. Run: npx ai-spector docops check — then docops migrate --repair if contract gaps remain.",
    );
  }

  lines.push("See .docops/guide/guides/PROJECT_LAYOUT.md and MIGRATION.md for path conventions.");
  return lines;
}

function buildAgentPrompt(result: Omit<DocopsLayoutProbeResult, "agentPrompt">): string {
  const lines: string[] = [
    "Probe doc layout for this repo (read-only — no file moves).",
    "",
    "Configured paths:",
  ];

  for (const key of LAYER_KEYS) {
    const path = result.configuredPaths[key] ?? "(not in config)";
    lines.push(`- ${key}: ${path}`);
  }

  lines.push("", "On disk:");
  for (const key of LAYER_KEYS) {
    const layer = result.onDisk[key];
    if (!layer) {
      lines.push(`- ${key}: (not scanned)`);
      continue;
    }
    const roots = layer.roots.map((r) => `${r.path} (${r.fileCount})`).join(", ") || "none";
    lines.push(
      `- ${key}: ${roots} | languages: ${layer.languageLayout} [${layer.detectedLanguages.join(", ")}] | class: ${layer.classification}`,
    );
  }

  if (result.dataSource) {
    lines.push(`- data-source: ${result.dataSource.path} (${result.dataSource.fileCount} file(s))`);
  }

  lines.push("", "Suggestions:");
  for (const [i, s] of result.suggestions.entries()) {
    lines.push(`${i + 1}. ${s}`);
  }

  lines.push(
    "",
    "Next: edit .docops/docops.config.json (docTypes.*.path, languages), customize .docops/templates/ if needed, then:",
    "  npx ai-spector docops migrate --repair",
    "  npx ai-spector index",
    "  npx ai-spector docops check --prompt",
  );

  return lines.join("\n");
}

export async function probeDocopsLayout(projectRoot?: string): Promise<DocopsLayoutProbeResult> {
  const root = projectRoot ?? findProjectRoot();
  const config = await readDocopsConfig(root);

  const configuredPaths: Partial<Record<LayerKey, string>> = {};
  if (config?.docTypes) {
    for (const key of LAYER_KEYS) {
      const path = config.docTypes[key]?.path?.trim();
      if (path) configuredPaths[key] = path.replace(/\\/g, "/");
    }
  }

  const onDisk: Partial<Record<LayerKey, DocopsLayerOnDisk>> = {};
  let srsMdCount = 0;

  for (const key of LAYER_KEYS) {
    const configuredPath = configuredPaths[key] ?? null;
    const candidates = new Set<string>();
    if (configuredPath) candidates.add(configuredPath);
    for (const alias of DISCOVERY_ALIASES[key]) {
      candidates.add(alias);
    }

    const roots: Array<{ path: string; fileCount: number }> = [];
    const allPaths: string[] = [];
    const classifyFiles: DocopsClassifyFile[] = [];

    for (const rel of candidates) {
      const abs = join(root, rel);
      const files = await collectMdFiles(abs);
      if (files.length > 0) {
        roots.push({ path: rel.replace(/\\/g, "/"), fileCount: files.length });
      }
      for (const absPath of files) {
        const projectRel = relative(root, absPath).replace(/\\/g, "/");
        allPaths.push(projectRel);
        classifyFiles.push({ relativePath: stripLayerPrefix(key, projectRel), headings: [] });
        if (key === "srs") srsMdCount += 1;
      }
    }

    roots.sort((a, b) => b.fileCount - a.fileCount);
    const lang = detectLanguageLayout(allPaths);
    const layerFolder =
      key === "srs" ? "srs" : key === "basicDesign" ? "basic-design" : "detail-design";

    onDisk[key] = {
      configuredPath,
      roots,
      languageLayout: lang.strategy,
      detectedLanguages: lang.detected,
      classification: classifyLayer(classifyFiles, layerFolder),
    };
  }

  const dsFiles = await collectMdFiles(join(root, "docs/data-source"));
  const dataSource =
    dsFiles.length > 0
      ? { path: "docs/data-source", fileCount: dsFiles.length }
      : null;

  classifyDataSource(srsMdCount, dataSource?.fileCount ?? 0);
  await classifyPrototype(root);

  const partial = {
    probedAt: new Date().toISOString(),
    configuredPaths,
    onDisk,
    dataSource,
  };
  const suggestions = buildSuggestions(partial);

  return {
    ...partial,
    suggestions,
    agentPrompt: buildAgentPrompt({ ...partial, suggestions }),
  };
}
