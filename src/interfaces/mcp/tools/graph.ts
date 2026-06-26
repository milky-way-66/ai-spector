import { loadDocflowConfig, primaryLanguage } from "@/core/config/load.js";
import { resolveProjectPaths } from "@/core/util/paths.js";
import { loadInMemoryGraph } from "@/core/graph/loadGraph.js";
import { querySubgraph } from "@/core/graph/query.js";
import { localizeProjectionPaths } from "@/core/paths/localized-output.js";
import {
  computeImpact,
  mergeImpactResults,
} from "@/core/graph/impact.js";
import { loadImpactRules } from "@/core/graph/impact-loader.js";
import {
  resolveImpactOrigins,
  pickPrimaryImpactOrigin,
  resolveFromGitDiff,
  parseGitDiffRegions,
} from "@/core/graph/resolve.js";
import { collectGitDiff } from "@/core/util/git-diff.js";
import { validateGraph } from "@/core/operations/validate.js";
import { runGraphMerge } from "@/core/operations/graph-merge.js";
import { runGraphReport } from "@/core/operations/graph-report.js";
import type { EdgeType } from "@/types.js";
import type {
  GraphQuerySchema,
  GraphImpactSchema,
  GraphValidateSchema,
  GraphMergeSchema,
  GraphReportSchema,
} from "../schemas.js";
import type { z } from "zod";
import { assertToolAllowed } from "../assert-tool-allowed.js";

export async function toolGraphQuery(input: z.infer<typeof GraphQuerySchema>) {
  await assertToolAllowed("graph_query", input.root);
  const paths = await resolveProjectPaths(input.root);
  const g = await loadInMemoryGraph(paths.graph);

  if (!g.nodesById.has(input.seedId)) {
    const docIds = [...g.nodesById.values()]
      .filter((n) => n.type === "document")
      .map((n) => n.id)
      .slice(0, 10);
    throw new Error(
      `Unknown node id: ${input.seedId}\nDocument ids in current graph:\n${docIds.map((d) => `  ${d}`).join("\n")}`,
    );
  }

  const edgeTypes = input.edges
    ? (input.edges.split(",").map((s) => s.trim()) as EdgeType[])
    : undefined;

  const result = querySubgraph(g, input.seedId, {
    direction: input.direction,
    depth: input.depth,
    edgeTypes,
  });

  try {
    const { config } = await loadDocflowConfig(paths.root);
    const primary = primaryLanguage(config);
    return {
      ...result,
      projectionPaths: localizeProjectionPaths(result.projectionPaths, primary.code),
    };
  } catch {
    return result;
  }
}

export async function toolGraphImpact(input: z.infer<typeof GraphImpactSchema>) {
  await assertToolAllowed("graph_impact", input.root);
  const paths = await resolveProjectPaths(input.root);
  const g = await loadInMemoryGraph(paths.graph);
  const rules = await loadImpactRules(paths.rulesImpact);

  if (input.git) {
    const collected = await collectGitDiff(paths.root);
    if (collected.notRepo) throw new Error("Not a git repository.");
    if (collected.empty) throw new Error("No staged/unstaged changes found.");

    const origins = resolveFromGitDiff(g, collected.diff);
    if (origins.length === 0) {
      const files = parseGitDiffRegions(collected.diff).map((r) => r.file);
      return {
        origin: { id: "(git diff)", type: "none", change: input.change },
        regenerate: [],
        review: [],
        affectedOutputPaths: [],
        noTraceabilityImpact: true,
        changedFiles: files,
      };
    }

    const direction = input.direction ?? "downstream";
    const results = origins.map((o) =>
      computeImpact(g, o.id, input.change, rules, direction),
    );
    return mergeImpactResults(results, origins);
  }

  const resolvedOrigins = resolveImpactOrigins(g, {
    file: input.file,
    heading: input.heading,
    nodeId: input.originId,
  });
  const primary = pickPrimaryImpactOrigin(resolvedOrigins);
  if (!primary) {
    throw new Error(
      "Could not resolve impact origin. Provide originId, file, or set git:true.",
    );
  }

  return computeImpact(g, primary.id, input.change, rules, input.direction ?? "downstream");
}

export async function toolGraphValidate(input: z.infer<typeof GraphValidateSchema>) {
  await assertToolAllowed("graph_validate", input.root);
  const paths = await resolveProjectPaths(input.root);
  const issues = await validateGraph({
    graphPath: paths.graph,
    schemaPath: paths.schema,
    registryPath: paths.registry,
    rulesPath: paths.rulesTraceability,
  });
  const errors = issues.filter((i) => i.severity === "error");
  const warnings = issues.filter((i) => i.severity === "warn");
  return { valid: errors.length === 0, errors, warnings };
}

export async function toolGraphMerge(input: z.infer<typeof GraphMergeSchema>) {
  await assertToolAllowed("graph_merge", input.root);
  const paths = await resolveProjectPaths(input.root);
  await runGraphMerge({
    root: input.root,
    fromKnowledge: input.fromKnowledge,
    graphPath: paths.graph,
    validate: false,
  });
  return { merged: true };
}

export async function toolGraphReport(input: z.infer<typeof GraphReportSchema>) {
  await assertToolAllowed("graph_report", input.root);
  return runGraphReport({ root: input.root });
}
