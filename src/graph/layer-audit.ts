import { readdir } from "node:fs/promises";
import { join } from "node:path";
import type { InMemoryGraph } from "./InMemoryGraph.js";
import { isPerDomainInstanceDocument } from "./detail-sections.js";
import { BUNDLE_BUSINESS_ID, BUNDLE_SOURCE_ID } from "./bundles.js";
import type { GraphEdge, NodeType } from "../types.js";

const DOMAIN_TYPES = new Set<NodeType>([
  "actor",
  "useCase",
  "feature",
  "requirement",
  "nfr",
  "dataEntity",
]);

export interface LayerAuditLayers {
  structure: {
    documents: number;
    sections: number;
    ok: boolean;
  };
  specInstances: {
    useCaseDocs: number;
    featureDocs: number;
    sections: number;
    ok: boolean;
    missingOnDisk: string[];
  };
  domain: {
    useCases: number;
    features: number;
    actors: number;
    ok: boolean;
  };
  sourceHub: {
    bundlePresent: boolean;
    sourceFiles: number;
    ok: boolean;
  };
  businessHub: {
    bundlePresent: boolean;
    domainMembers: number;
    ok: boolean;
  };
  provenance: {
    derivedFrom: number;
    domainsWithoutSource: string[];
    ok: boolean;
  };
  semanticLinks: {
    relatesTo: number;
    domainsWithoutSemanticLinks: string[];
    ok: boolean;
  };
}

export interface LayerAuditReport {
  layers: LayerAuditLayers;
  suggestedCommand?: string;
  suggestedAgentCommand?: string;
}

function countType(graph: InMemoryGraph, type: NodeType): number {
  let n = 0;
  for (const node of graph.nodesById.values()) {
    if (node.type === type) {
      n++;
    }
  }
  return n;
}

function perDomainSpecDocs(graph: InMemoryGraph): {
  useCaseDocs: number;
  featureDocs: number;
} {
  let useCaseDocs = 0;
  let featureDocs = 0;
  for (const node of graph.nodesById.values()) {
    if (node.type !== "document" || !isPerDomainInstanceDocument(node)) {
      continue;
    }
    if (node.perDomain === "useCase") {
      useCaseDocs++;
    } else if (node.perDomain === "feature") {
      featureDocs++;
    }
  }
  return { useCaseDocs, featureDocs };
}

function detailSectionCount(graph: InMemoryGraph): number {
  let n = 0;
  for (const node of graph.nodesById.values()) {
    if (node.type !== "section") {
      continue;
    }
    const docId = String(node.documentId ?? "");
    if (!docId.startsWith("doc.srs.uc-") && !docId.startsWith("doc.srs.f-")) {
      continue;
    }
    n++;
  }
  return n;
}

function edgeCount(graph: InMemoryGraph, type: GraphEdge["type"]): number {
  return graph.toTraceabilityGraph().edges.filter((e) => e.type === type).length;
}

function domainsWithDerivedFrom(graph: InMemoryGraph): Set<string> {
  const out = new Set<string>();
  for (const e of graph.toTraceabilityGraph().edges) {
    if (e.type !== "derivedFrom") {
      continue;
    }
    const from = graph.nodesById.get(e.from);
    if (from && DOMAIN_TYPES.has(from.type)) {
      out.add(e.from);
    }
  }
  return out;
}

function domainsWithRelatesTo(graph: InMemoryGraph): Set<string> {
  const out = new Set<string>();
  for (const e of graph.toTraceabilityGraph().edges) {
    if (e.type !== "relatesTo") {
      continue;
    }
    const from = graph.nodesById.get(e.from);
    const to = graph.nodesById.get(e.to);
    if (from && DOMAIN_TYPES.has(from.type)) {
      out.add(e.from);
    }
    if (to && DOMAIN_TYPES.has(to.type)) {
      out.add(e.to);
    }
  }
  return out;
}

function listDomainsMissingProvenance(graph: InMemoryGraph): string[] {
  const withDerived = domainsWithDerivedFrom(graph);
  const missing: string[] = [];
  for (const node of graph.nodesById.values()) {
    if (DOMAIN_TYPES.has(node.type) && !withDerived.has(node.id)) {
      missing.push(node.id);
    }
  }
  return missing.sort();
}

function listDomainsNeedingSemanticLinks(graph: InMemoryGraph): string[] {
  const withDerived = domainsWithDerivedFrom(graph);
  const withRelates = domainsWithRelatesTo(graph);
  const out: string[] = [];
  for (const id of withDerived) {
    if (!withRelates.has(id)) {
      out.push(id);
    }
  }
  return out.sort();
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

function graphOutputPathsForUseCaseDocs(graph: InMemoryGraph): Set<string> {
  const out = new Set<string>();
  for (const node of graph.nodesById.values()) {
    if (
      node.type === "document" &&
      node.perDomain === "useCase" &&
      typeof node.output === "string"
    ) {
      out.add(node.output.replace(/\\/g, "/"));
    }
  }
  return out;
}

function suggestCommands(layers: LayerAuditLayers): {
  suggestedCommand?: string;
  suggestedAgentCommand?: string;
} {
  let suggestedCommand: string | undefined;
  let suggestedAgentCommand: string | undefined;

  if (layers.semanticLinks.domainsWithoutSemanticLinks.length > 0) {
    const seed = layers.semanticLinks.domainsWithoutSemanticLinks[0];
    suggestedAgentCommand = seed ? `/link-graph ${seed}` : "/link-graph";
  }
  if (!layers.specInstances.ok && layers.domain.useCases > 0) {
    suggestedCommand = "npx ai-spector index";
  } else if (!layers.sourceHub.ok && layers.domain.ok) {
    suggestedCommand = "npx ai-spector index";
  } else if (layers.provenance.domainsWithoutSource.length > 0) {
    suggestedAgentCommand = suggestedAgentCommand ?? "/analyze";
    suggestedCommand = "npx ai-spector index";
  }

  return { suggestedCommand, suggestedAgentCommand };
}

export async function auditGraphLayers(
  graph: InMemoryGraph,
  projectRoot?: string,
): Promise<LayerAuditReport> {
  const documents = countType(graph, "document");
  const sections = countType(graph, "section");
  const { useCaseDocs, featureDocs } = perDomainSpecDocs(graph);
  const detailSections = detailSectionCount(graph);

  const useCases = countType(graph, "useCase");
  const features = countType(graph, "feature");
  const actors = countType(graph, "actor");
  const requirements = countType(graph, "requirement");
  const nfrs = countType(graph, "nfr");
  const dataEntities = countType(graph, "dataEntity");

  const bundleSource = graph.nodesById.has(BUNDLE_SOURCE_ID);
  const sourceFiles = countType(graph, "sourceFile");
  const bundleBusiness = graph.nodesById.has(BUNDLE_BUSINESS_ID);
  let domainMembers = 0;
  if (bundleBusiness) {
    for (const e of graph.toTraceabilityGraph().edges) {
      if (e.type === "contains" && e.from === BUNDLE_BUSINESS_ID) {
        domainMembers++;
      }
    }
  }

  const derivedFrom = edgeCount(graph, "derivedFrom");
  const domainsWithoutSource = listDomainsMissingProvenance(graph);
  const relatesTo = edgeCount(graph, "relatesTo");
  const domainsWithoutSemanticLinks = listDomainsNeedingSemanticLinks(graph);

  let missingOnDisk: string[] = [];
  if (projectRoot) {
    const diskPaths = await listUseCaseDetailPathsOnDisk(projectRoot);
    const graphPaths = graphOutputPathsForUseCaseDocs(graph);
    missingOnDisk = diskPaths.filter((p) => !graphPaths.has(p));
  }

  const specInstancesOk =
    useCaseDocs > 0 &&
    detailSections > 0 &&
    missingOnDisk.length === 0;

  const layers: LayerAuditLayers = {
    structure: {
      documents,
      sections,
      ok: documents > 0 && sections > 0,
    },
    specInstances: {
      useCaseDocs,
      featureDocs,
      sections: detailSections,
      ok: specInstancesOk,
      missingOnDisk,
    },
    domain: {
      useCases,
      features,
      actors,
      ok: useCases > 0 || features > 0,
    },
    sourceHub: {
      bundlePresent: bundleSource,
      sourceFiles,
      ok: bundleSource,
    },
    businessHub: {
      bundlePresent: bundleBusiness,
      domainMembers,
      ok:
        bundleBusiness &&
        domainMembers >= useCases + features + actors + requirements + nfrs + dataEntities,
    },
    provenance: {
      derivedFrom,
      domainsWithoutSource,
      ok: domainsWithoutSource.length === 0,
    },
    semanticLinks: {
      relatesTo,
      domainsWithoutSemanticLinks,
      ok:
        domainsWithoutSemanticLinks.length === 0 ||
        derivedFrom === 0,
    },
  };

  const suggestions = suggestCommands(layers);
  return { layers, ...suggestions };
}
