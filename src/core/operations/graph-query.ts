import { loadDocflowConfig, primaryLanguage } from "../config/load.js";
import { loadInMemoryGraph } from "../graph/loadGraph.js";
import { querySubgraph, type QueryOptions } from "../graph/query.js";
import type { GraphQueryResult } from "../graph/query.js";
import { localizeProjectionPaths } from "../paths/localized-output.js";
import type { EdgeType } from "@/types.js";

export interface GraphQueryCliOptions {
  graphPath: string;
  seedId: string;
  projectRoot?: string;
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

  const result = querySubgraph(g, opts.seedId, queryOpts);
  if (!opts.projectRoot) {
    return result;
  }
  try {
    const { config } = await loadDocflowConfig(opts.projectRoot);
    const primary = primaryLanguage(config);
    return {
      ...result,
      projectionPaths: localizeProjectionPaths(result.projectionPaths, primary.code),
    };
  } catch {
    return result;
  }
}
