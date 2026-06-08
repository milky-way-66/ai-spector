import { auditGraphLayers } from "../graph/layer-audit.js";
import { loadInMemoryGraph } from "../graph/loadGraph.js";
import { resolveProjectPaths } from "../util/paths.js";
import type { LayerAuditReport } from "ai-spector-graph";

export type GraphLayerReport = Awaited<ReturnType<typeof auditGraphLayers>>;

export interface GraphReportOptions {
  root?: string;
  graphPath?: string;
}

export async function runGraphReport(opts: GraphReportOptions): Promise<LayerAuditReport> {
  const paths = await resolveProjectPaths(opts.root);
  const graphPath = opts.graphPath ?? paths.graph;
  const graph = await loadInMemoryGraph(graphPath);
  return auditGraphLayers(graph, paths.root);
}
