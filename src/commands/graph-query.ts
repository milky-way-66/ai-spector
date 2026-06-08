import { loadInMemoryGraph } from "../graph/loadGraph.js";
import { querySubgraph, type QueryOptions } from "../graph/query.js";
import type { GraphQueryResult } from "ai-spector-graph";
import type { EdgeType } from "../types.js";

export interface GraphQueryCliOptions {
  graphPath: string;
  seedId: string;
  direction?: "out" | "in" | "both";
  depth?: number;
  edges?: string;
}

export async function runGraphQuery(opts: GraphQueryCliOptions): Promise<GraphQueryResult> {
  const g = await loadInMemoryGraph(opts.graphPath);

  if (!g.nodesById.has(opts.seedId)) {
    const docNodes = [...g.nodesById.values()]
      .filter((n) => n.type === "document")
      .map((n) => n.id);
    const suggestion =
      docNodes.length > 0
        ? `\nDocument ids in the current graph:\n${docNodes.map((d) => `  ${d}`).join("\n")}\n` +
          `\nTip: if you switched packs, run \`npx ai-spector template inspect <pack>\` to list valid seed ids.`
        : "\nThe graph appears empty — run \`npx ai-spector registry build\` then retry.";
    throw new Error(`Unknown node id: ${opts.seedId}${suggestion}`);
  }

  const queryOpts: QueryOptions = {
    direction: opts.direction,
    depth: opts.depth,
  };
  if (opts.edges) {
    queryOpts.edgeTypes = opts.edges.split(",").map((s) => s.trim()) as EdgeType[];
  }

  return querySubgraph(g, opts.seedId, queryOpts);
}
