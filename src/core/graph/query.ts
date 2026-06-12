import type { EdgeType, GraphEdge, GraphNode, NodeType } from "@/types.js";
import type { InMemoryGraph } from "./InMemoryGraph.js";

export interface QueryOptions {
  direction?: "out" | "in" | "both";
  depth?: number;
  edgeTypes?: EdgeType[];
  nodeTypes?: NodeType[];
}

export interface GraphQueryResult {
  seed: string;
  nodes: GraphNode[];
  edges: GraphEdge[];
  projectionPaths: string[];
}

const DEFAULT_GENERATE_EDGES: EdgeType[] = [
  "partOf",
  "contains",
  "follows",
  "listedIn",
  "definedIn",
  "describedIn",
  "satisfies",
  "dependsOn",
  "tracesTo",
  "relatesTo",
  "references",
  "rendersTo",
  "derivedFrom",
];

export function resolveDocumentForNode(
  g: InMemoryGraph,
  nodeId: string,
): GraphNode | undefined {
  const node = g.nodesById.get(nodeId);
  if (!node) {
    return undefined;
  }
  if (node.type === "document") {
    return node;
  }
  if (node.type === "section") {
    const partOf = (g.outEdges.get(nodeId) ?? []).find((e) => e.type === "partOf");
    if (!partOf) {
      return undefined;
    }
    return resolveDocumentForNode(g, partOf.to);
  }
  for (const e of g.outEdges.get(nodeId) ?? []) {
    if (["listedIn", "definedIn", "describedIn"].includes(e.type)) {
      const doc = resolveDocumentForNode(g, e.to);
      if (doc) {
        return doc;
      }
    }
  }
  for (const e of g.inEdges.get(nodeId) ?? []) {
    if (e.type === "definedIn" && e.from === nodeId) {
      const doc = resolveDocumentForNode(g, e.to);
      if (doc) {
        return doc;
      }
    }
  }
  return undefined;
}

export function projectionPathForNode(
  g: InMemoryGraph,
  nodeId: string,
): string | undefined {
  const node = g.nodesById.get(nodeId);
  if (!node) {
    return undefined;
  }
  if (node.type === "document") {
    const out = node.output as string | undefined;
    return out || undefined;
  }
  if (node.type === "section") {
    const doc = resolveDocumentForNode(g, nodeId);
    if (!doc) {
      return undefined;
    }
    const pattern = doc.outputPattern as string | undefined;
    if (pattern) {
      return pattern;
    }
    return doc.output as string | undefined;
  }
  const doc = resolveDocumentForNode(g, nodeId);
  if (doc?.output) {
    return doc.output as string;
  }
  if (doc?.outputPattern) {
    return doc.outputPattern as string;
  }
  for (const e of g.outEdges.get(nodeId) ?? []) {
    if (e.type === "rendersTo") {
      return e.to;
    }
  }
  return undefined;
}

export function dataSourcePathsForNode(
  g: InMemoryGraph,
  nodeId: string,
): string[] {
  const paths: string[] = [];
  for (const e of g.outEdges.get(nodeId) ?? []) {
    if (e.type === "derivedFrom") {
      paths.push(e.to);
    }
  }
  return paths;
}

export function querySubgraph(
  g: InMemoryGraph,
  seedId: string,
  opts: QueryOptions = {},
): GraphQueryResult {
  if (!g.nodesById.has(seedId)) {
    throw new Error(`Unknown node id: ${seedId}`);
  }

  const direction = opts.direction ?? "both";
  const depth = opts.depth ?? 2;
  const edgeTypeSet = new Set(opts.edgeTypes ?? DEFAULT_GENERATE_EDGES);
  const nodeTypeFilter = opts.nodeTypes ? new Set(opts.nodeTypes) : null;

  const visitedNodes = new Set<string>();
  const visitedEdges = new Map<string, GraphEdge>();
  const queue: { id: string; d: number }[] = [{ id: seedId, d: 0 }];

  while (queue.length > 0) {
    const { id: current, d } = queue.shift()!;
    if (d > 0) {
      visitedNodes.add(current);
    }
    if (d >= depth) {
      continue;
    }

    const visitEdge = (e: GraphEdge, next: string) => {
      if (!edgeTypeSet.has(e.type)) {
        return;
      }
      const key = `${e.type}\0${e.from}\0${e.to}`;
      visitedEdges.set(key, e);
      if (!visitedNodes.has(next) && next !== seedId) {
        queue.push({ id: next, d: d + 1 });
      }
    };

    if (direction === "out" || direction === "both") {
      for (const e of g.outEdges.get(current) ?? []) {
        visitEdge(e, e.to);
      }
    }
    if (direction === "in" || direction === "both") {
      for (const e of g.inEdges.get(current) ?? []) {
        visitEdge(e, e.from);
      }
    }
  }

  visitedNodes.add(seedId);

  const nodes = [...visitedNodes]
    .map((id) => g.nodesById.get(id))
    .filter((n): n is GraphNode => n !== undefined && (!nodeTypeFilter || nodeTypeFilter.has(n.type)));

  const includedIds = new Set(nodes.map((n) => n.id));
  const edges = [...visitedEdges.values()].filter(
    (e) => includedIds.has(e.from) && includedIds.has(e.to),
  );

  const projectionPaths = [
    ...new Set(
      [
        ...[...visitedNodes]
          .map((id) => projectionPathForNode(g, id))
          .filter((p): p is string => Boolean(p && !p.includes("{"))),
        ...[...visitedNodes].flatMap((id) => dataSourcePathsForNode(g, id)),
      ],
    ),
  ];

  return { seed: seedId, nodes, edges, projectionPaths };
}
