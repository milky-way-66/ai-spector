import { readdir } from "node:fs/promises";
import { join } from "node:path";
import {
  auditGraphLayers as auditGraphLayersCore,
  type LayerAuditLayers,
  type LayerAuditReport,
} from "ai-spector-graph";
import type { InMemoryGraph } from "./InMemoryGraph.js";

export type { LayerAuditLayers, LayerAuditReport } from "ai-spector-graph";

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

export async function auditGraphLayers(
  graph: InMemoryGraph,
  projectRoot?: string,
): Promise<LayerAuditReport> {
  let existingPaths: string[] | undefined;
  if (projectRoot) {
    existingPaths = await listUseCaseDetailPathsOnDisk(projectRoot);
  }
  return auditGraphLayersCore(graph, {
    existingPaths: existingPaths ? new Set(existingPaths) : undefined,
  });
}
