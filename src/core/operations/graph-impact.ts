import { mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import { writeJson } from "../util/fs.js";
import { collectGitDiff } from "../util/git-diff.js";
import { loadInMemoryGraph } from "../graph/loadGraph.js";
import { computeImpact, loadImpactRules, mergeImpactResults } from "../graph/impact.js";
import {
  parseGitDiffRegions,
  pickPrimaryImpactOrigin,
  resolveFromGitDiff,
  resolveImpactOrigins,
  type ResolvedOrigin,
} from "../graph/resolve.js";
import type { ImpactResult } from "ai-spector-graph";
import { runCocoindexSearch, isCocoindexConfigured, type SearchResult } from "./cocoindex.js";

export interface SemanticSuggestion {
  docPath: string;
  heading: string;
  score: number;
  graphNodeId?: string;
  reason: string;
}

export type GraphImpactResult = ImpactResult & {
  semanticSuggestions?: SemanticSuggestion[];
};

export interface GraphImpactCliOptions {
  graphPath: string;
  rulesPath: string;
  projectRoot: string;
  originId?: string;
  file?: string;
  heading?: string;
  git?: boolean;
  change: string;
  output?: string;
}

const PER_DOMAIN_FILE_RE = /(?:\/|^)(uc|f|ent)-\d+[_-]/i;

function buildResolveFailureHint(
  opts: Pick<GraphImpactCliOptions, "file" | "heading" | "originId">,
): string {
  const file = opts.file?.trim();
  if (file && PER_DOMAIN_FILE_RE.test(file) && !opts.heading?.trim()) {
    const slug = file.split("/").pop() ?? file;
    const ucMatch = slug.match(/^(uc|f)-?(\d+)/i);
    const nodeHint = ucMatch ? ` or \`graph impact UC-${ucMatch[2]}\`` : "";
    return (
      `Could not resolve impact origin for per-domain projection file: ${file}\n` +
      `Per-UC/feature projection files require a heading or domain node id to scope the seed.\n` +
      `Use one of:\n` +
      `  npx ai-spector graph impact --git --json                               (recommended)\n` +
      `  npx ai-spector graph impact --file ${file} --heading "<heading text>" --json\n` +
      `  npx ai-spector graph impact <nodeId> --json${nodeHint}`
    );
  }
  return "Could not resolve impact origin. Provide <nodeId>, --file <path> [--heading <text>], or --git.";
}

export function resolveImpactOriginId(
  g: Awaited<ReturnType<typeof loadInMemoryGraph>>,
  opts: Pick<GraphImpactCliOptions, "originId" | "file" | "heading">,
): { originId: string; resolved?: ResolvedOrigin } {
  if (opts.originId?.trim()) {
    const id = opts.originId.trim();
    if (!g.nodesById.has(id)) {
      const docNodes = [...g.nodesById.values()]
        .filter((n) => n.type === "document")
        .map((n) => n.id)
        .slice(0, 6);
      const suggestion =
        docNodes.length > 0
          ? `\nDocument ids in current graph:\n${docNodes.map((d) => `  ${d}`).join("\n")}\n` +
            `Run \`npx ai-spector template inspect <pack> --json\` to list all active pack documents.`
          : "";
      throw new Error(`Unknown node id: ${id}${suggestion}`);
    }
    return { originId: id };
  }

  const origins = resolveImpactOrigins(g, {
    file: opts.file,
    heading: opts.heading,
    nodeId: opts.originId,
  });
  const primary = pickPrimaryImpactOrigin(origins);
  if (!primary) throw new Error(buildResolveFailureHint(opts));
  return { originId: primary.id, resolved: primary };
}

async function addSemanticSuggestions(
  result: ImpactResult,
  opts: Pick<GraphImpactCliOptions, "projectRoot" | "change">,
): Promise<GraphImpactResult> {
  const configured = await isCocoindexConfigured(opts.projectRoot);
  if (!configured) return result;

  const query = opts.change || result.origin.id;
  const threshold = Number(process.env["COCOINDEX_SIMILARITY_THRESHOLD"] ?? "0.75");

  try {
    const searchResult = await runCocoindexSearch({
      root: opts.projectRoot,
      query,
      limit: 5,
      threshold,
    });

    // exclude nodes already in formal impact results
    const formalIds = new Set([
      result.origin.id,
      ...result.regenerate.map((e) => e.id),
      ...result.review.map((e) => e.id),
    ]);

    const suggestions: SemanticSuggestion[] = searchResult.results
      .filter((r: SearchResult) => !r.graphNodeId || !formalIds.has(r.graphNodeId))
      .map((r: SearchResult) => ({
        docPath: r.docPath,
        heading: r.heading,
        score: r.score,
        graphNodeId: r.graphNodeId,
        reason: "semantically similar to changed section",
      }));

    if (suggestions.length === 0) return result;
    return { ...result, semanticSuggestions: suggestions };
  } catch {
    // CocoIndex failure is non-fatal
    return result;
  }
}

export async function runGraphImpactFromGit(
  g: Awaited<ReturnType<typeof loadInMemoryGraph>>,
  opts: GraphImpactCliOptions,
): Promise<GraphImpactResult> {
  const collected = await collectGitDiff(opts.projectRoot);
  if (collected.notRepo) {
    throw new Error(
      "Not a git repository. Describe the change (/impact <description>) or select text in the editor.",
    );
  }
  if (collected.empty) {
    throw new Error(
      "No unstaged or staged changes. Describe the change (/impact <description>) or select text in the editor.",
    );
  }

  const origins = resolveFromGitDiff(g, collected.diff);
  if (origins.length === 0) {
    const files = parseGitDiffRegions(collected.diff).map((r) => r.file);
    const noImpact = {
      origin: { id: "(git diff)", type: "none", change: opts.change },
      regenerate: [],
      review: [],
      affectedOutputPaths: [],
      noTraceabilityImpact: true,
      changedFiles: files,
    } as unknown as ImpactResult;
    if (opts.output) {
      await mkdir(dirname(opts.output), { recursive: true });
      await writeJson(opts.output, noImpact);
    }
    return addSemanticSuggestions(noImpact, opts);
  }

  const rules = await loadImpactRules(opts.rulesPath);
  const regions = parseGitDiffRegions(collected.diff);
  const seedsByRegion: ResolvedOrigin[] = [];
  for (const region of regions) {
    const regionOrigins = resolveImpactOrigins(g, {
      file: region.file,
      heading: region.heading,
      sectionAnchor: region.sectionAnchor,
    });
    const primary = pickPrimaryImpactOrigin(regionOrigins);
    if (primary) seedsByRegion.push(primary);
  }

  const uniqueSeeds = new Map<string, ResolvedOrigin>();
  for (const o of seedsByRegion.length > 0 ? seedsByRegion : origins) {
    if (!uniqueSeeds.has(o.id)) uniqueSeeds.set(o.id, o);
  }

  const results = [...uniqueSeeds.values()].map((seed) => {
    const r = computeImpact(g, seed.id, opts.change, rules);
    r.resolvedFrom = seed;
    return r;
  });

  const gitSeeds = [...uniqueSeeds.values()].map((s) => {
    const region = regions.find((r) =>
      resolveImpactOrigins(g, { file: r.file, heading: r.heading, sectionAnchor: r.sectionAnchor }).some((o) => o.id === s.id),
    );
    return { id: s.id, type: s.type, reason: s.reason, file: region?.file, heading: region?.heading };
  });

  const merged = results.length === 1 ? { ...results[0], gitSeeds } : mergeImpactResults(results, gitSeeds);
  const result = await addSemanticSuggestions(merged, opts);

  if (opts.output) {
    await mkdir(dirname(opts.output), { recursive: true });
    await writeJson(opts.output, result);
  }

  return result;
}

export async function computeImpactForRegen(
  root: string,
  graphPath: string,
  rulesPath: string,
  originId?: string,
): Promise<{
  affectedNodeIds: Set<string>;
  affectedOutputPaths: string[];
  noImpact: boolean;
  reason: string;
  graph: Awaited<ReturnType<typeof loadInMemoryGraph>>;
}> {
  const g = await loadInMemoryGraph(graphPath);
  let nodeIds: Set<string>;
  let outputPaths: string[] = [];
  let reason: string;

  if (originId) {
    const { originId: resolvedId } = resolveImpactOriginId(g, { originId });
    const rules = await loadImpactRules(rulesPath);
    const result = computeImpact(g, resolvedId, "changed", rules);
    nodeIds = new Set([resolvedId, ...result.regenerate.map((e) => e.id), ...result.review.map((e) => e.id)]);
    outputPaths = result.affectedOutputPaths ?? [];
    reason = `origin: ${resolvedId}`;
  } else {
    const collected = await collectGitDiff(root);
    if (collected.notRepo || collected.empty) {
      return { affectedNodeIds: new Set(), affectedOutputPaths: [], noImpact: true, reason: collected.notRepo ? "not a git repo" : "no changes", graph: g };
    }
    const origins = resolveFromGitDiff(g, collected.diff);
    if (origins.length === 0) {
      return { affectedNodeIds: new Set(), affectedOutputPaths: [], noImpact: true, reason: "changed files not in graph", graph: g };
    }
    const rules = await loadImpactRules(rulesPath);
    const regions = parseGitDiffRegions(collected.diff);
    const uniqueSeeds = new Map<string, ResolvedOrigin>();
    for (const region of regions) {
      const regionOrigins = resolveImpactOrigins(g, { file: region.file, heading: region.heading, sectionAnchor: region.sectionAnchor });
      const primary = pickPrimaryImpactOrigin(regionOrigins);
      if (primary && !uniqueSeeds.has(primary.id)) uniqueSeeds.set(primary.id, primary);
    }
    for (const o of origins) {
      if (!uniqueSeeds.has(o.id)) uniqueSeeds.set(o.id, o);
    }
    nodeIds = new Set<string>();
    for (const seed of uniqueSeeds.values()) {
      const result = computeImpact(g, seed.id, "changed", rules);
      nodeIds.add(seed.id);
      for (const e of result.regenerate) nodeIds.add(e.id);
      for (const e of result.review) nodeIds.add(e.id);
      outputPaths.push(...(result.affectedOutputPaths ?? []));
    }
    outputPaths = [...new Set(outputPaths)];
    reason = `git diff: ${uniqueSeeds.size} seed(s) — ${[...uniqueSeeds.keys()].join(", ")}`;
  }

  return { affectedNodeIds: nodeIds, affectedOutputPaths: outputPaths, noImpact: false, reason, graph: g };
}

export async function runGraphImpact(opts: GraphImpactCliOptions): Promise<GraphImpactResult> {
  const g = await loadInMemoryGraph(opts.graphPath);
  if (opts.git) return runGraphImpactFromGit(g, opts);
  const { originId, resolved } = resolveImpactOriginId(g, opts);
  const rules = await loadImpactRules(opts.rulesPath);
  const formal = computeImpact(g, originId, opts.change, rules);
  if (resolved) formal.resolvedFrom = resolved;
  const result = await addSemanticSuggestions(formal, opts);
  if (opts.output) {
    await mkdir(dirname(opts.output), { recursive: true });
    await writeJson(opts.output, result);
  }
  return result;
}
