import type { InMemoryGraph } from "./InMemoryGraph.js";
import type { GraphEdge, GraphNode, NodeType } from "./types.js";

export const BUNDLE_SOURCE_ID = "bundle.source";
export const BUNDLE_BUSINESS_ID = "bundle.business";

const DOMAIN_TYPES = new Set<NodeType>([
  "actor",
  "useCase",
  "feature",
  "requirement",
  "nfr",
  "dataEntity",
]);

const UC_DETAIL_PATH_RE_DEFAULT = /docs\/srs\/.*\/uc-\d+.*\.md$/i;

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

export interface LayerAuditOptions {
  /**
   * Repo-relative paths known to exist on disk (from your backend).
   * Used to populate specInstances.missingOnDisk — UC detail files on disk but not in graph.
   */
  existingPaths?: Iterable<string>;
  /**
   * Override the regex used to identify UC detail files on disk.
   * Defaults to /docs\/srs\/.*\/uc-\d+.*\.md$/i — projects with a different
   * folder structure should supply their own pattern here.
   */
  ucDetailPathPattern?: RegExp;
}

function isPerDomainInstanceDocument(node: GraphNode): boolean {
  if (node.type !== "document" || node.outputPattern) {
    return false;
  }
  const output = typeof node.output === "string" ? node.output : "";
  if (!output) {
    return false;
  }
  if (node.perDomain === "useCase" || node.perDomain === "feature") {
    return true;
  }
  if (
    node.perDomain === "apiDetail" ||
    node.perDomain === "screenDetail" ||
    /docs\/basic-design\/(?:api\/|screens\/)/i.test(output.replace(/\\/g, "/"))
  ) {
    return true;
  }
  return false;
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

function missingUseCasePathsOnDisk(
  graph: InMemoryGraph,
  existingPaths?: Iterable<string>,
  ucDetailPathPattern?: RegExp,
): string[] {
  if (!existingPaths) {
    return [];
  }
  const re = ucDetailPathPattern ?? UC_DETAIL_PATH_RE_DEFAULT;
  const graphPaths = graphOutputPathsForUseCaseDocs(graph);
  const missing: string[] = [];
  for (const raw of existingPaths) {
    const p = raw.replace(/\\/g, "/");
    if (!re.test(p)) {
      continue;
    }
    if (!graphPaths.has(p)) {
      missing.push(p);
    }
  }
  return missing.sort();
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

/** Tri-layer health report (parity with `ai-spector graph report`). Sync, browser-safe. */
export function auditGraphLayers(
  graph: InMemoryGraph,
  options: LayerAuditOptions = {},
): LayerAuditReport {
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

  const missingOnDisk = missingUseCasePathsOnDisk(graph, options.existingPaths, options.ucDetailPathPattern);
  const diskCheck = options.existingPaths !== undefined;

  const specInstancesOk =
    useCaseDocs > 0 &&
    detailSections > 0 &&
    (!diskCheck || missingOnDisk.length === 0);

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
      ok: domainsWithoutSemanticLinks.length === 0 || derivedFrom === 0,
    },
  };

  const suggestions = suggestCommands(layers);
  return { layers, ...suggestions };
}
