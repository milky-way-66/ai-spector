import type { InMemoryGraph } from "../graph/InMemoryGraph.js";
import type { GraphEdge } from "@/types.js";
import { DESIGN_LAYERS } from "./constants.js";
import type { BaselineFileEntry, DesignLayer, TraceabilityGaps } from "./types.js";

const DOMAIN_TYPES = new Set(["useCase", "feature", "requirement"]);
const LAYER_LINK_EDGE_TYPES = new Set<GraphEdge["type"]>([
  "listedIn",
  "definedIn",
  "describedIn",
]);
const DD_COVERAGE_EDGE_TYPES = new Set<GraphEdge["type"]>([
  "tracesTo",
  "describedIn",
  "listedIn",
  "definedIn",
]);

function normalizePath(path: string): string {
  return path.replace(/\\/g, "/");
}

function layerFromOutput(output: string): DesignLayer | null {
  const p = normalizePath(output);
  if (p.startsWith("docs/srs/")) return "srs";
  if (p.startsWith("docs/basic-design/")) return "basic-design";
  if (p.startsWith("docs/detail-design/")) return "detail-design";
  return null;
}

function resolveNodeLayer(graph: InMemoryGraph, nodeId: string): DesignLayer | null {
  const node = graph.nodesById.get(nodeId);
  if (!node) return null;
  if (node.type === "document" && typeof node.output === "string") {
    return layerFromOutput(node.output);
  }
  if (node.type === "section") {
    const docId = String(node.documentId ?? "");
    const doc = graph.nodesById.get(docId);
    if (doc?.type === "document" && typeof doc.output === "string") {
      return layerFromOutput(doc.output);
    }
  }
  return null;
}

function hasLayerLink(
  graph: InMemoryGraph,
  domainId: string,
  layer: DesignLayer,
): boolean {
  for (const edge of graph.outEdges.get(domainId) ?? []) {
    if (!LAYER_LINK_EDGE_TYPES.has(edge.type)) continue;
    if (resolveNodeLayer(graph, edge.to) === layer) return true;
  }
  for (const edge of graph.inEdges.get(domainId) ?? []) {
    if (edge.type === "tracesTo" && resolveNodeLayer(graph, edge.from) === layer) {
      return true;
    }
  }
  return false;
}

function hasBasicDesignLink(graph: InMemoryGraph, domainId: string): boolean {
  if (hasLayerLink(graph, domainId, "basic-design")) return true;
  return (graph.outEdges.get(domainId) ?? []).some((e) => e.type === "satisfies");
}

function hasDetailDesignCoverage(graph: InMemoryGraph, domainId: string): boolean {
  if (hasLayerLink(graph, domainId, "detail-design")) return true;

  const visited = new Set<string>();
  const queue = [domainId];
  while (queue.length > 0) {
    const id = queue.shift()!;
    if (visited.has(id)) continue;
    visited.add(id);

    for (const edge of graph.inEdges.get(id) ?? []) {
      if (edge.type !== "tracesTo") continue;
      if (resolveNodeLayer(graph, edge.from) === "detail-design") return true;
      queue.push(edge.from);
    }

    for (const edge of graph.outEdges.get(id) ?? []) {
      if (!DD_COVERAGE_EDGE_TYPES.has(edge.type)) continue;
      if (resolveNodeLayer(graph, edge.to) === "detail-design") return true;
    }
    for (const edge of graph.inEdges.get(id) ?? []) {
      if (!DD_COVERAGE_EDGE_TYPES.has(edge.type)) continue;
      if (resolveNodeLayer(graph, edge.from) === "detail-design") return true;
    }
  }

  return false;
}

function domainsLinkedToSection(graph: InMemoryGraph, sectionId: string): string[] {
  const domains: string[] = [];
  for (const edge of graph.inEdges.get(sectionId) ?? []) {
    if (!LAYER_LINK_EDGE_TYPES.has(edge.type)) continue;
    const from = graph.nodesById.get(edge.from);
    if (from && DOMAIN_TYPES.has(from.type)) {
      domains.push(edge.from);
    }
  }
  return domains;
}

function scanMissingDownstream(graph: InMemoryGraph): TraceabilityGaps["missingDownstream"] {
  const gaps: TraceabilityGaps["missingDownstream"] = [];

  for (const node of graph.nodesById.values()) {
    if (!DOMAIN_TYPES.has(node.type)) continue;

    const hasSrs = hasLayerLink(graph, node.id, "srs");
    const hasBd = hasBasicDesignLink(graph, node.id);
    const hasDd = hasDetailDesignCoverage(graph, node.id);

    if (hasSrs && hasBd && !hasDd) {
      gaps.push({
        domainId: node.id,
        layer: "detail-design",
        message: `${node.id} has SRS + basic-design coverage but no detail-design document`,
      });
    }
  }

  return gaps.sort((a, b) => a.domainId.localeCompare(b.domainId));
}

function scanMissingUpstream(graph: InMemoryGraph): TraceabilityGaps["missingUpstream"] {
  const gaps: TraceabilityGaps["missingUpstream"] = [];

  for (const node of graph.nodesById.values()) {
    if (node.type !== "section") continue;
    const layer = resolveNodeLayer(graph, node.id);
    if (layer !== "basic-design" && layer !== "detail-design") continue;

    const domains = domainsLinkedToSection(graph, node.id);
    const hasSatisfies = domains.some((id) => {
      const out = graph.outEdges.get(id) ?? [];
      const inn = graph.inEdges.get(id) ?? [];
      return out.some((e) => e.type === "satisfies") || inn.some((e) => e.type === "satisfies");
    });
    const hasFeature = domains.some((id) => graph.nodesById.get(id)?.type === "feature");

    if (hasSatisfies && !hasFeature) {
      gaps.push({
        domainId: node.id,
        layer: "srs",
        message: `${layer} section ${node.id} has satisfies-linked domain but no upstream feature`,
      });
    }
  }

  return gaps.sort((a, b) => a.domainId.localeCompare(b.domainId));
}

function collectGraphDocumentOutputs(graph: InMemoryGraph): Set<string> {
  const outputs = new Set<string>();
  for (const node of graph.nodesById.values()) {
    if (node.type === "document" && typeof node.output === "string") {
      outputs.add(normalizePath(node.output));
    }
  }
  return outputs;
}

function scanOrphanFiles(
  graph: InMemoryGraph,
  layerFiles: Record<DesignLayer, Record<string, BaselineFileEntry>>,
): string[] {
  const graphOutputs = collectGraphDocumentOutputs(graph);
  const orphans: string[] = [];

  for (const layer of DESIGN_LAYERS) {
    for (const path of Object.keys(layerFiles[layer])) {
      if (!graphOutputs.has(normalizePath(path))) {
        orphans.push(normalizePath(path));
      }
    }
  }

  return orphans.sort();
}

export function scanTraceabilityGaps(opts: {
  graph: InMemoryGraph;
  layerFiles: Record<DesignLayer, Record<string, BaselineFileEntry>>;
}): TraceabilityGaps {
  return {
    missingDownstream: scanMissingDownstream(opts.graph),
    missingUpstream: scanMissingUpstream(opts.graph),
    orphanFiles: scanOrphanFiles(opts.graph, opts.layerFiles),
  };
}
