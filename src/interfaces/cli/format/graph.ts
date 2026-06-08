import type { GraphQueryResult, ImpactResult, LayerAuditReport } from "ai-spector-graph";
import type { GraphMergeResult } from "../../../core/operations/graph-merge.js";
import type { GraphVisualizeResult } from "../../../core/operations/graph-visualize.js";
import type { GraphImpactResult } from "../../../core/operations/graph-impact.js";
import { formatIssues } from "../../../core/operations/validate.js";

export function formatGraphQuery(result: GraphQueryResult): string {
  const lines: string[] = [];
  lines.push(`Seed: ${result.seed}`);
  lines.push(`Nodes (${result.nodes.length}):`);
  for (const n of result.nodes) lines.push(`  - ${n.id} (${n.type})`);
  lines.push(`Edges (${result.edges.length}):`);
  for (const e of result.edges) lines.push(`  - ${e.from} --${e.type}--> ${e.to}`);
  lines.push(`Projection paths (${result.projectionPaths.length}):`);
  for (const p of result.projectionPaths) lines.push(`  - ${p}`);
  return lines.join("\n");
}

export function formatGraphReport(report: LayerAuditReport): string {
  const lines: string[] = [];
  const L = report.layers;
  lines.push("Graph layer report");
  lines.push("──────────────────");
  lines.push(`  Structure: ${L.structure.ok ? "ok" : "incomplete"} — ${L.structure.documents} documents, ${L.structure.sections} sections`);
  lines.push(`  Spec instances: ${L.specInstances.ok ? "ok" : "incomplete"} — ${L.specInstances.useCaseDocs} UC docs, ${L.specInstances.featureDocs} F docs, ${L.specInstances.sections} detail sections`);
  if (L.specInstances.missingOnDisk.length > 0) lines.push(`    Missing in graph: ${L.specInstances.missingOnDisk.join(", ")}`);
  lines.push(`  Domain: ${L.domain.ok ? "ok" : "incomplete"} — ${L.domain.useCases} UCs, ${L.domain.features} features, ${L.domain.actors} actors`);
  lines.push(`  Source hub: ${L.sourceHub.ok ? "ok" : "incomplete"} — bundle ${L.sourceHub.bundlePresent ? "yes" : "no"}, ${L.sourceHub.sourceFiles} source files`);
  lines.push(`  Business hub: ${L.businessHub.ok ? "ok" : "incomplete"} — bundle ${L.businessHub.bundlePresent ? "yes" : "no"}, ${L.businessHub.domainMembers} members`);
  lines.push(`  Provenance: ${L.provenance.ok ? "ok" : "incomplete"} — ${L.provenance.derivedFrom} derivedFrom`);
  if (L.provenance.domainsWithoutSource.length > 0) lines.push(`    No source: ${L.provenance.domainsWithoutSource.join(", ")}`);
  lines.push(`  Semantic links: ${L.semanticLinks.ok ? "ok" : "optional"} — ${L.semanticLinks.relatesTo} relatesTo`);
  if (L.semanticLinks.domainsWithoutSemanticLinks.length > 0) lines.push(`    Suggest agent: ${L.semanticLinks.domainsWithoutSemanticLinks.join(", ")}`);
  if (report.suggestedCommand) lines.push(`\nSuggested CLI: ${report.suggestedCommand}`);
  if (report.suggestedAgentCommand) lines.push(`Suggested agent: ${report.suggestedAgentCommand}`);
  return lines.join("\n");
}

export function formatGraphMerge(result: GraphMergeResult): string {
  const lines: string[] = [];
  if (result.patchWritten) lines.push(`Wrote patch → ${result.patchWritten}`);
  if (result.knowledgePreMerged) lines.push("Pre-merged knowledge.json (domain nodes ready)");
  if (result.knowledgeMissingWarning) lines.push(`--with-knowledge: no knowledge.json found, skipping`);
  lines.push(
    `Merge: +${result.stats.nodesCreated} nodes, ~${result.stats.nodesUpdated} updated, +${result.stats.edgesAdded} edges` +
      (result.stats.nodesSkipped ? `, ${result.stats.nodesSkipped} structure nodes skipped` : ""),
  );
  if (result.dryRun) {
    lines.push("(dry-run: graph not saved)");
  } else {
    if (result.validationIssues) {
      const text = formatIssues(result.validationIssues);
      if (text) lines.push(text);
    }
    if (result.validationOk) lines.push("Graph validate: OK");
    if (result.validationWarnCount && result.validationWarnCount > 0 && result.validationOk) {
      // warnings already included in formatIssues output above
    }
    lines.push(`Wrote ${result.graphPath}`);
  }
  return lines.join("\n");
}

export function formatGraphVisualize(result: GraphVisualizeResult): string {
  const lines: string[] = [];
  lines.push(`Wrote ${result.outputPath}`);
  lines.push(`  ${result.nodeCount} nodes, ${result.edgeCount} edges`);
  if (result.knowledgeStats) {
    const k = result.knowledgeStats;
    lines.push(`  knowledge: ${k.useCases} use cases, ${k.features} features, ${k.actors} actors`);
  } else {
    lines.push("  knowledge: (not loaded)");
  }
  lines.push("");
  lines.push("Open in a browser:");
  lines.push(`  file://${result.outputPath}`);
  return lines.join("\n");
}

export function formatGraphImpact(result: GraphImpactResult, fromGit = false): string {
  const lines: string[] = [];
  if (result.noTraceabilityImpact) {
    const files = (result as ImpactResult & { changedFiles?: string[] }).changedFiles ?? [];
    lines.push(`No traceability impact found.\nChanged files not in graph: ${files.join(", ")}`);
    return lines.join("\n");
  }

  const seedLabel = fromGit
    ? `git diff (${Array.isArray(result.gitSeeds) ? result.gitSeeds.length : 0} seed(s))`
    : `${result.origin.id} (${result.origin.change})`;
  lines.push(`Impact from ${seedLabel}`);

  for (const bucket of ["regenerate", "review"] as const) {
    const entries = result[bucket];
    lines.push(`\n${bucket}:`);
    if (!entries || entries.length === 0) {
      lines.push("  (none)");
    } else {
      for (const e of entries) {
        const path = e.projectionPath ? ` → ${e.projectionPath}` : "";
        lines.push(`  - ${e.id} (${e.type})${path}`);
      }
    }
  }

  if (result.affectedOutputPaths && result.affectedOutputPaths.length > 0) {
    lines.push("\naffected output paths:");
    for (const p of result.affectedOutputPaths) lines.push(`  - ${p}`);
  }

  const staleTranslations = (result as ImpactResult & { staleTranslations?: Array<{ id: string; reason: string }> }).staleTranslations;
  if (staleTranslations && staleTranslations.length > 0) {
    lines.push("\nstale translations (may need update):");
    for (const e of staleTranslations) lines.push(`  - ${e.id} (${e.reason})`);
  }

  if (result.semanticSuggestions && result.semanticSuggestions.length > 0) {
    lines.push("\nsemantic suggestions (review recommended):");
    for (const s of result.semanticSuggestions) {
      const nodeTag = s.graphNodeId ? `  [${s.graphNodeId}]` : "";
      lines.push(`  - ${s.docPath} § ${s.heading}${nodeTag}  (score: ${s.score})`);
    }
  }

  return lines.join("\n");
}
