import { join } from "node:path";
import type { ExtractPatch } from "./knowledge.js";
import { mergePatch, type MergeResult } from "./merge.js";
import type { InMemoryGraph } from "./InMemoryGraph.js";
import type { GraphEdge, GraphNode, NodeType } from "../../types.js";
import { discoverMarkdownFiles } from "../index/docs-build.js";

export const BUNDLE_SOURCE_ID = "bundle.source";
export const BUNDLE_BUSINESS_ID = "bundle.business";

const DOMAIN_TYPES = new Set<NodeType>([
  "actor",
  "useCase",
  "feature",
  "requirement",
  "dataEntity",
]);

/** Stable id for a repo-relative path under docs/data-source. */
export function sourceFileNodeId(repoPath: string): string {
  return `source.file:${repoPath.replace(/\\/g, "/").replace(/\/+/g, "/")}`;
}

export function isSourceFileNodeId(id: string): boolean {
  return id.startsWith("source.file:");
}

export function pathFromSourceFileNodeId(id: string): string | undefined {
  if (!isSourceFileNodeId(id)) {
    return undefined;
  }
  return id.slice("source.file:".length);
}

/** Prefer `source.file:` node id when the path is a known data-source file. */
export function provenanceTargetId(
  repoPath: string,
  knownSourceFileIds: ReadonlySet<string>,
): string {
  const nodeId = sourceFileNodeId(repoPath);
  return knownSourceFileIds.has(nodeId) ? nodeId : repoPath;
}

export async function discoverDataSourceMarkdownPaths(
  projectRoot: string,
  dataSourceRoot = "docs/data-source",
): Promise<string[]> {
  const files = await discoverMarkdownFiles(projectRoot, dataSourceRoot, "**/*.md");
  return files.map((f) => f.relativePath.replace(/\\/g, "/")).sort();
}

export function buildSourceBundlePatch(repoPaths: string[]): ExtractPatch {
  const nodes: GraphNode[] = [
    {
      id: BUNDLE_SOURCE_ID,
      type: "bundle",
      role: "source",
      title: "Data source",
    },
  ];
  const edges: GraphEdge[] = [];

  for (const path of repoPaths) {
    const id = sourceFileNodeId(path);
    const base = path.split("/").pop() ?? path;
    nodes.push({
      id,
      type: "sourceFile",
      path,
      title: base.replace(/\.md$/i, ""),
    });
    edges.push({ type: "contains", from: BUNDLE_SOURCE_ID, to: id });
    edges.push({ type: "partOf", from: id, to: BUNDLE_SOURCE_ID });
  }

  return { version: 1, nodes, edges };
}

export function buildBusinessBundlePatch(graph: InMemoryGraph): ExtractPatch {
  const nodes: GraphNode[] = [
    {
      id: BUNDLE_BUSINESS_ID,
      type: "bundle",
      role: "business",
      title: "Business domain",
    },
  ];
  const edges: GraphEdge[] = [];

  for (const node of graph.nodesById.values()) {
    if (!DOMAIN_TYPES.has(node.type)) {
      continue;
    }
    edges.push({ type: "contains", from: BUNDLE_BUSINESS_ID, to: node.id });
    edges.push({ type: "partOf", from: node.id, to: BUNDLE_BUSINESS_ID });
  }

  return { version: 1, nodes, edges };
}

export interface EnsureHubBundlesResult {
  source: MergeResult;
  business: MergeResult;
  sourceFiles: number;
  domainMembers: number;
}

export async function ensureSourceBundle(
  graph: InMemoryGraph,
  projectRoot: string,
  dataSourceRoot = "docs/data-source",
): Promise<{ result: MergeResult; sourceFiles: number }> {
  const paths = await discoverDataSourceMarkdownPaths(projectRoot, dataSourceRoot);
  const patch = buildSourceBundlePatch(paths);
  const result = mergePatch(graph, patch);
  return { result, sourceFiles: paths.length };
}

export function ensureBusinessBundle(graph: InMemoryGraph): {
  result: MergeResult;
  domainMembers: number;
} {
  const patch = buildBusinessBundlePatch(graph);
  const result = mergePatch(graph, patch);
  const domainMembers = patch.edges.filter(
    (e) => e.type === "contains" && e.from === BUNDLE_BUSINESS_ID,
  ).length;
  return { result, domainMembers };
}

/** Idempotent source + business hub nodes (call after domain nodes exist). */
export async function ensureHubBundles(
  graph: InMemoryGraph,
  projectRoot: string,
  dataSourceRoot = "docs/data-source",
): Promise<EnsureHubBundlesResult> {
  const { result: source, sourceFiles } = await ensureSourceBundle(
    graph,
    projectRoot,
    dataSourceRoot,
  );
  const { result: business, domainMembers } = ensureBusinessBundle(graph);
  return {
    source,
    business,
    sourceFiles,
    domainMembers,
  };
}

export function knownSourceFileNodeIds(graph: InMemoryGraph): Set<string> {
  const out = new Set<string>();
  for (const node of graph.nodesById.values()) {
    if (node.type === "sourceFile") {
      out.add(node.id);
    }
  }
  return out;
}
