import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { mergePatch } from "../graph/merge.js";
import { loadInMemoryGraph } from "../graph/loadGraph.js";
import {
  basicDesignAnchorStructurePatch,
  basicDesignListChaptersNeedSections,
  buildDocExtractPatch,
  classifyBasicDesignDetailFile,
  classifyDetailDesignDetailFile,
  detailDesignAnchorStructurePatch,
  detailDesignListChaptersNeedSections,
} from "../graph/doc-extract.js";
import { mergeStructurePatches } from "../registry/structure-patch.js";
import {
  computeIndexSourceHash,
  discoverDocSourceFiles,
} from "./docs-build.js";
import { indexDocsConfigPath, type IndexDocsConfig } from "./docs-config.js";
import { pathExists, readJson, writeJson } from "../util/fs.js";

export interface DocSemanticMergeOptions {
  projectRoot: string;
  graphPath: string;
  config?: IndexDocsConfig;
}

export interface DocSemanticMergeResult {
  merged: boolean;
  detail: string;
  sourceHashes: Record<string, string>;
}

export async function runDocSemanticMerge(
  opts: DocSemanticMergeOptions,
): Promise<DocSemanticMergeResult> {
  const configPath = indexDocsConfigPath(opts.projectRoot);
  if (!(await pathExists(configPath))) {
    return {
      merged: false,
      detail: `Missing ${configPath}`,
      sourceHashes: {},
    };
  }

  const config =
    opts.config ?? (await readJson<IndexDocsConfig>(configPath));
  const entries: Array<{ relativePath: string; content: string }> = [];
  const sourceHashes: Record<string, string> = {};

  for (const key of ["srs", "basicDesign", "detailDesign"] as const) {
    const source = config.sources[key];
    if (!source?.root) {
      continue;
    }
    const files = await discoverDocSourceFiles(opts.projectRoot, source);
    sourceHashes[key] = computeIndexSourceHash(files);
    for (const f of files) {
      const content = await readFile(
        join(opts.projectRoot, f.relativePath),
        "utf8",
      );
      entries.push({ relativePath: f.relativePath, content });
    }
  }

  if (entries.length === 0) {
    return {
      merged: false,
      detail: "No markdown under docs/srs, docs/basic-design, or docs/detail-design",
      sourceHashes,
    };
  }

  const graphBefore = await loadInMemoryGraph(opts.graphPath);
  const listChaptersNeedSections =
    basicDesignListChaptersNeedSections(graphBefore) ||
    detailDesignListChaptersNeedSections(graphBefore);
  let { patch, stats } = await buildDocExtractPatch(entries, opts.projectRoot, {
    includeListChapterMarkdown: listChaptersNeedSections,
  });

  if (listChaptersNeedSections) {
    const structure = mergeStructurePatches([
      await basicDesignAnchorStructurePatch(opts.projectRoot),
      await detailDesignAnchorStructurePatch(opts.projectRoot),
    ]);
    patch = mergeStructurePatches([patch, structure]);
  }

  if (patch.nodes.length === 0 && patch.edges.length === 0) {
    return {
      merged: false,
      detail: `Scanned ${stats.filesScanned} files — no UC/F/actor ids found in body text`,
      sourceHashes,
    };
  }

  const { stats: mergeStats } = mergePatch(graphBefore, patch);
  await writeJson(opts.graphPath, graphBefore.toTraceabilityGraph());

  const statePath = join(opts.projectRoot, ".ai-spector/.docflow/state.json");
  const state = await readJson<Record<string, unknown>>(statePath).catch(() => ({
    version: 1,
    docsSemantic: {},
  }));
  const docsSemantic = (state.docsSemantic as Record<string, unknown>) ?? {};
  docsSemantic.lastRunAt = new Date().toISOString();
  docsSemantic.sourceHashes = sourceHashes;
  docsSemantic.lastStats = stats;
  state.docsSemantic = docsSemantic;
  await writeJson(statePath, state);

  // Detail files on disk that never became graph nodes indicate a discovery
  // or classification gap — surface it instead of letting the graph go stale.
  const bdDetailOnDisk = entries.filter((e) =>
    classifyBasicDesignDetailFile(e.relativePath),
  ).length;
  const ddDetailOnDisk = entries.filter((e) =>
    classifyDetailDesignDetailFile(e.relativePath),
  ).length;
  const detailGapWarning =
    bdDetailOnDisk > 0 && stats.bdDetailDocuments === 0
      ? `\n      ⚠ ${bdDetailOnDisk} basic-design detail file(s) on disk produced 0 graph detail nodes — check sources in ${configPath}`
      : ddDetailOnDisk > 0 && stats.ddDetailDocuments === 0
        ? `\n      ⚠ ${ddDetailOnDisk} detail-design feature file(s) on disk produced 0 graph detail nodes — check sources in ${configPath}`
        : "";

  return {
    merged: true,
    detail:
      `${stats.filesScanned} files → ${stats.useCases} use cases, ${stats.features} features, ${stats.actors} actors` +
      (stats.detailDocuments > 0
        ? `, ${stats.detailDocuments} detail documents` +
          (stats.bdDetailDocuments > 0 || stats.ddDetailDocuments > 0
            ? ` (${stats.srsDetailDocuments} SRS, ${stats.bdDetailDocuments} basic-design, ${stats.ddDetailDocuments} detail-design)`
            : "")
        : "") +
      (stats.detailSections > 0 ? `, ${stats.detailSections} detail sections` : "") +
      ` (+${mergeStats.nodesCreated} nodes, ~${mergeStats.nodesUpdated} updated, +${mergeStats.edgesAdded} edges)` +
      detailGapWarning,
    sourceHashes,
  };
}

export async function knowledgeStaleWarning(
  projectRoot: string,
  docHashes: Record<string, string>,
): Promise<string | undefined> {
  const knowledgePath = join(
    projectRoot,
    ".ai-spector/.docflow/analysis/knowledge.json",
  );
  if (!(await pathExists(knowledgePath))) {
    return undefined;
  }

  const statePath = join(projectRoot, ".ai-spector/.docflow/state.json");
  const state = await readJson<Record<string, unknown>>(statePath).catch(() => null);
  const indexHashes = (state?.index as Record<string, unknown> | undefined)
    ?.sourceHashes as Record<string, string> | undefined;

  if (!indexHashes?.srs || !docHashes.srs) {
    return undefined;
  }
  if (indexHashes.srs === docHashes.srs) {
    return undefined;
  }

  return (
    "docs/srs changed since last index — knowledge.json may be stale; run /analyze to re-extract from data source, or rely on doc semantic merge from file bodies"
  );
}
