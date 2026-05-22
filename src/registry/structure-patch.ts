import type { GraphNode } from "../types.js";
import type { RegistryDocument } from "../types.js";
import { detailSectionsToPatch } from "../graph/detail-sections.js";
import type { ExtractPatch } from "../graph/knowledge.js";

/** Turn a registry document (with parsed template sections) into graph nodes + contains/partOf edges. */
export function registryDocumentToStructurePatch(doc: RegistryDocument): ExtractPatch {
  const nodes: GraphNode[] = [
    {
      id: doc.documentId,
      type: "document",
      ...(doc.output ? { output: doc.output } : {}),
      ...(doc.outputPattern ? { outputPattern: doc.outputPattern } : {}),
      ...(doc.perDomain ? { perDomain: doc.perDomain } : {}),
      ...(doc.template ? { template: doc.template } : {}),
    },
  ];
  const edges: ExtractPatch["edges"] = [];

  if (doc.sections.length === 0) {
    return { version: 1, nodes, edges };
  }

  const sections = doc.sections.map((s) => ({
    id: s.id,
    heading: s.heading,
    level: s.level,
    order: s.order ?? 0,
  }));
  const sectionPatch = detailSectionsToPatch(doc.documentId, sections);
  nodes.push(...sectionPatch.nodes);
  edges.push(...sectionPatch.edges);

  return { version: 1, nodes, edges };
}

export function mergeStructurePatches(patches: ExtractPatch[]): ExtractPatch {
  const nodes: GraphNode[] = [];
  const edges: ExtractPatch["edges"] = [];
  const edgeKeys = new Set<string>();

  for (const patch of patches) {
    for (const n of patch.nodes) {
      if (!nodes.some((x) => x.id === n.id && x.type === n.type)) {
        nodes.push(n);
      }
    }
    for (const e of patch.edges) {
      const key = `${e.type}:${e.from}:${e.to}`;
      if (!edgeKeys.has(key)) {
        edgeKeys.add(key);
        edges.push(e);
      }
    }
  }

  return { version: 1, nodes, edges };
}
