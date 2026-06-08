import { readdir } from "node:fs/promises";
import { join } from "node:path";
import { auditGraphLayers } from "../graph/layer-audit.js";
import { loadInMemoryGraph } from "../graph/loadGraph.js";
import type { LayerAuditReport } from "../graph/layer-audit.js";
import { resolveProjectPaths } from "../util/paths.js";

export type GraphLayerReport = LayerAuditReport;

export interface GraphReportOptions {
  root?: string;
  graphPath?: string;
}

async function listUseCaseDetailPathsOnDisk(projectRoot: string): Promise<string[]> {
  const base = join(projectRoot, "docs/srs/03-use-cases");
  const paths: string[] = [];
  try {
    const entries = await readdir(base, { withFileTypes: true });
    for (const ent of entries) {
      if (ent.isFile() && /^uc-\d+.*\.md$/i.test(ent.name)) {
        paths.push(`docs/srs/03-use-cases/${ent.name}`);
      }
    }
  } catch {
    return [];
  }
  return paths.sort();
}

export async function runGraphReport(opts: GraphReportOptions): Promise<LayerAuditReport> {
  const paths = await resolveProjectPaths(opts.root);
  const graphPath = opts.graphPath ?? paths.graph;
  const graph = await loadInMemoryGraph(graphPath);
  const existingPaths = await listUseCaseDetailPathsOnDisk(paths.root);
  return auditGraphLayers(graph, {
    existingPaths: existingPaths.length > 0 ? existingPaths : undefined,
  });
}
