import { loadInMemoryGraph } from "../graph/loadGraph.js";
import { computeImpact, mergeImpactResults } from "../graph/impact.js";
import { loadImpactRules } from "../graph/impact-loader.js";
import { resolveImpactOrigins } from "../graph/resolve.js";
import type { ImpactDirection } from "../graph/impact.js";

export async function computeAuditImpact(opts: {
  graphPath: string;
  rulesPath: string;
  changedPaths: string[];
  direction: ImpactDirection;
}) {
  const g = await loadInMemoryGraph(opts.graphPath);
  const rules = await loadImpactRules(opts.rulesPath);
  const results = [];

  for (const file of opts.changedPaths) {
    const origins = resolveImpactOrigins(g, { file });
    for (const origin of origins) {
      results.push(computeImpact(g, origin.id, "content_change", rules, opts.direction));
    }
  }

  if (results.length === 0) {
    return {
      regenerate: [],
      syncUpstream: [],
      review: [],
      noTraceabilityImpact: true,
    };
  }

  return mergeImpactResults(results);
}
