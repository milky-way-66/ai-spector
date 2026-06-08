import { join, resolve, relative } from "node:path";
import { mkdir, cp } from "node:fs/promises";
import { pathExists, readJson } from "../util/fs.js";
import type { TraceabilityGraph } from "../../types.js";
import type { GraphQueryResult } from "ai-spector-graph";

// ── Config helpers ────────────────────────────────────────────────────────────

export function cocoindexDir(root: string): string {
  return join(root, ".ai-spector/.docflow/cocoindex");
}

export function cocoindexPipelinePath(root: string): string {
  return join(cocoindexDir(root), "pipeline.py");
}

export async function isCocoindexConfigured(root: string): Promise<boolean> {
  return pathExists(cocoindexPipelinePath(root));
}

// ── Setup ─────────────────────────────────────────────────────────────────────

export interface CocoindexSetupOptions {
  root?: string;
  force?: boolean;
}

export interface CocoindexSetupResult {
  pipelinePath: string;
  envPath: string;
  alreadyExists: boolean;
}

export async function runCocoindexSetup(
  opts: CocoindexSetupOptions = {},
): Promise<CocoindexSetupResult> {
  const root = resolve(opts.root ?? process.cwd());
  const destDir = cocoindexDir(root);
  const pipelinePath = join(destDir, "pipeline.py");
  const envPath = join(destDir, ".env.example");

  const alreadyExists = await pathExists(pipelinePath);
  if (alreadyExists && !opts.force) {
    return { pipelinePath, envPath, alreadyExists: true };
  }

  // locate scaffold relative to this package's bundle root
  const { scaffoldBundleRoot } = await import("../config/load.js");
  const scaffoldSrc = join(scaffoldBundleRoot(), "cocoindex");

  await mkdir(destDir, { recursive: true });
  await cp(scaffoldSrc, destDir, { recursive: true });

  return { pipelinePath, envPath, alreadyExists: false };
}

// ── Search ────────────────────────────────────────────────────────────────────

export interface SearchResult {
  docPath: string;
  heading: string;
  excerpt: string;
  score: number;
  graphNodeId?: string;
}

export interface CocoindexSearchOptions {
  root?: string;
  query: string;
  limit?: number;
  threshold?: number;
}

export interface CocoindexSearchResult {
  query: string;
  results: SearchResult[];
  cocoindexConfigured: boolean;
}

export async function runCocoindexSearch(
  opts: CocoindexSearchOptions,
): Promise<CocoindexSearchResult> {
  const root = resolve(opts.root ?? process.cwd());
  const configured = await isCocoindexConfigured(root);

  if (!configured) {
    return { query: opts.query, results: [], cocoindexConfigured: false };
  }

  const pipelinePath = cocoindexPipelinePath(root);
  const limit = opts.limit ?? 5;
  const threshold =
    opts.threshold ??
    Number(process.env["COCOINDEX_SIMILARITY_THRESHOLD"] ?? "0.75");

  const rawResults = await spawnPythonSearch(root, pipelinePath, opts.query, limit, threshold);
  const enriched = await enrichWithGraphNodeIds(root, rawResults);

  return { query: opts.query, results: enriched, cocoindexConfigured: true };
}

// ── Python bridge ─────────────────────────────────────────────────────────────

interface PythonSearchResult {
  docPath: string;
  heading: string;
  excerpt: string;
  score: number;
}

async function spawnPythonSearch(
  root: string,
  pipelinePath: string,
  query: string,
  limit: number,
  threshold: number,
): Promise<PythonSearchResult[]> {
  const { execFile } = await import("node:child_process");
  const { promisify } = await import("node:util");
  const exec = promisify(execFile);

  const args = [
    pipelinePath,
    "search",
    "--query", query,
    "--limit", String(limit),
    "--threshold", String(threshold),
  ];

  const { stdout } = await exec("python", args, {
    cwd: root,
    env: { ...process.env },
    maxBuffer: 1024 * 1024,
  });

  try {
    return JSON.parse(stdout) as PythonSearchResult[];
  } catch {
    return [];
  }
}

// ── Graph node enrichment ─────────────────────────────────────────────────────

async function enrichWithGraphNodeIds(
  root: string,
  results: PythonSearchResult[],
): Promise<SearchResult[]> {
  if (results.length === 0) return [];

  let nodeFileMap: Map<string, string> | null = null;
  try {
    const { loadDocflowConfig } = await import("../config/load.js");
    const { config } = await loadDocflowConfig(root);
    const graph = await readJson<TraceabilityGraph>(join(root, config.paths.graph));
    nodeFileMap = new Map<string, string>();
    for (const node of graph.nodes) {
      const file = (node as { file?: string }).file;
      if (file) {
        // normalise to relative path from root
        const rel = relative(root, resolve(root, file));
        nodeFileMap.set(rel, node.id);
      }
    }
  } catch {
    // graph unavailable — skip enrichment
  }

  return results.map((r) => {
    const graphNodeId = nodeFileMap
      ? (nodeFileMap.get(r.docPath) ?? nodeFileMap.get(relative(root, resolve(root, r.docPath))))
      : undefined;
    return { ...r, graphNodeId };
  });
}

// ── Fuzzy graph query ─────────────────────────────────────────────────────────

export interface FuzzyQueryOptions {
  root?: string;
  query: string;
  direction?: "out" | "in" | "both";
  depth?: number;
  threshold?: number;
}

export interface FuzzyQueryResult {
  resolvedNodeId: string;
  resolvedVia: string;
  confidence: number;
  subgraph: GraphQueryResult;
}

export async function runGraphQueryFuzzy(
  opts: FuzzyQueryOptions,
): Promise<FuzzyQueryResult> {
  const root = resolve(opts.root ?? process.cwd());

  // Step 1: semantic search to resolve natural language → graphNodeId
  const searchResult = await runCocoindexSearch({
    root,
    query: opts.query,
    limit: 5,
    threshold: opts.threshold,
  });

  if (!searchResult.cocoindexConfigured) {
    throw new Error(
      "CocoIndex is not configured. Run: npx ai-spector cocoindex setup",
    );
  }

  const topHit = searchResult.results.find((r) => r.graphNodeId);
  if (!topHit?.graphNodeId) {
    throw new Error(
      `No graph node found for query "${opts.query}". ` +
        "Try a more specific query or use graph_query with an exact node id.",
    );
  }

  // Step 2: graph traversal from resolved node
  const { loadDocflowConfig } = await import("../config/load.js");
  const { config } = await loadDocflowConfig(root);
  const { runGraphQuery } = await import("./graph-query.js");

  const subgraph = await runGraphQuery({
    graphPath: join(root, config.paths.graph),
    seedId: topHit.graphNodeId,
    direction: opts.direction,
    depth: opts.depth,
  });

  return {
    resolvedNodeId: topHit.graphNodeId,
    resolvedVia: `docs_search → ${topHit.docPath} § ${topHit.heading}`,
    confidence: topHit.score,
    subgraph,
  };
}
