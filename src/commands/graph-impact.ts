import { mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import { writeJson } from "../util/fs.js";
import { loadInMemoryGraph } from "../graph/loadGraph.js";
import { computeImpact, loadImpactRules } from "../graph/impact.js";

export interface GraphImpactCliOptions {
  graphPath: string;
  rulesPath: string;
  originId: string;
  change: string;
  output?: string;
  json?: boolean;
}

export async function runGraphImpact(opts: GraphImpactCliOptions): Promise<void> {
  const g = await loadInMemoryGraph(opts.graphPath);
  const rules = await loadImpactRules(opts.rulesPath);
  const result = computeImpact(g, opts.originId, opts.change, rules);

  if (opts.output) {
    await mkdir(dirname(opts.output), { recursive: true });
    await writeJson(opts.output, result);
  }

  if (opts.json || opts.output) {
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  console.log(`Impact from ${result.origin.id} (${result.origin.change})`);
  for (const [bucket, entries] of Object.entries(result.affected)) {
    console.log(`\n${bucket}:`);
    if (entries.length === 0) {
      console.log("  (none)");
      continue;
    }
    for (const e of entries) {
      const path = e.projectionPath ? ` → ${e.projectionPath}` : "";
      console.log(`  - ${e.id} (${e.type})${path}`);
    }
  }
}
