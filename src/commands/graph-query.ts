import { loadInMemoryGraph } from "../graph/loadGraph.js";
import { querySubgraph, type QueryOptions } from "../graph/query.js";
import type { EdgeType } from "../types.js";

export interface GraphQueryCliOptions {
  graphPath: string;
  seedId: string;
  direction?: "out" | "in" | "both";
  depth?: number;
  edges?: string;
  json?: boolean;
}

export async function runGraphQuery(opts: GraphQueryCliOptions): Promise<void> {
  const g = await loadInMemoryGraph(opts.graphPath);
  const queryOpts: QueryOptions = {
    direction: opts.direction,
    depth: opts.depth,
  };
  if (opts.edges) {
    queryOpts.edgeTypes = opts.edges.split(",").map((s) => s.trim()) as EdgeType[];
  }

  const result = querySubgraph(g, opts.seedId, queryOpts);

  if (opts.json) {
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  console.log(`Seed: ${result.seed}`);
  console.log(`Nodes (${result.nodes.length}):`);
  for (const n of result.nodes) {
    console.log(`  - ${n.id} (${n.type})`);
  }
  console.log(`Edges (${result.edges.length}):`);
  for (const e of result.edges) {
    console.log(`  - ${e.from} --${e.type}--> ${e.to}`);
  }
  console.log(`Projection paths (${result.projectionPaths.length}):`);
  for (const p of result.projectionPaths) {
    console.log(`  - ${p}`);
  }
}
