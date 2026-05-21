import { auditGraphLayers } from "../graph/layer-audit.js";
import { loadInMemoryGraph } from "../graph/loadGraph.js";
import { resolveProjectPaths } from "../util/paths.js";

export interface GraphReportOptions {
  root?: string;
  graphPath?: string;
  json?: boolean;
}

export async function runGraphReport(opts: GraphReportOptions): Promise<void> {
  const paths = await resolveProjectPaths(opts.root);
  const graphPath = opts.graphPath ?? paths.graph;
  const graph = await loadInMemoryGraph(graphPath);
  const report = await auditGraphLayers(graph, paths.root);

  if (opts.json) {
    console.log(JSON.stringify(report, null, 2));
    return;
  }

  const L = report.layers;
  console.log("Graph layer report");
  console.log("──────────────────");
  console.log(
    `  Structure: ${L.structure.ok ? "ok" : "incomplete"} — ${L.structure.documents} documents, ${L.structure.sections} sections`,
  );
  console.log(
    `  Spec instances: ${L.specInstances.ok ? "ok" : "incomplete"} — ${L.specInstances.useCaseDocs} UC docs, ${L.specInstances.featureDocs} F docs, ${L.specInstances.sections} detail sections`,
  );
  if (L.specInstances.missingOnDisk.length > 0) {
    console.log(`    Missing in graph: ${L.specInstances.missingOnDisk.join(", ")}`);
  }
  console.log(
    `  Domain: ${L.domain.ok ? "ok" : "incomplete"} — ${L.domain.useCases} UCs, ${L.domain.features} features, ${L.domain.actors} actors`,
  );
  console.log(
    `  Source hub: ${L.sourceHub.ok ? "ok" : "incomplete"} — bundle ${L.sourceHub.bundlePresent ? "yes" : "no"}, ${L.sourceHub.sourceFiles} source files`,
  );
  console.log(
    `  Business hub: ${L.businessHub.ok ? "ok" : "incomplete"} — bundle ${L.businessHub.bundlePresent ? "yes" : "no"}, ${L.businessHub.domainMembers} members`,
  );
  console.log(
    `  Provenance: ${L.provenance.ok ? "ok" : "incomplete"} — ${L.provenance.derivedFrom} derivedFrom`,
  );
  if (L.provenance.domainsWithoutSource.length > 0) {
    console.log(`    No source: ${L.provenance.domainsWithoutSource.join(", ")}`);
  }
  console.log(
    `  Semantic links: ${L.semanticLinks.ok ? "ok" : "optional"} — ${L.semanticLinks.relatesTo} relatesTo`,
  );
  if (L.semanticLinks.domainsWithoutSemanticLinks.length > 0) {
    console.log(
      `    Suggest agent: ${L.semanticLinks.domainsWithoutSemanticLinks.join(", ")}`,
    );
  }
  if (report.suggestedCommand) {
    console.log(`\nSuggested CLI: ${report.suggestedCommand}`);
  }
  if (report.suggestedAgentCommand) {
    console.log(`Suggested agent: ${report.suggestedAgentCommand}`);
  }
}
