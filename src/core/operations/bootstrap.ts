import type { GraphEdge, GraphNode } from "@/types.js";
import type { SectionRegistry } from "@/types.js";
import { InMemoryGraph } from "../graph/InMemoryGraph.js";
import { emptyGraph } from "../graph/load.js";

function documentNode(doc: SectionRegistry["documents"][0]): GraphNode {
  return {
    id: doc.documentId,
    type: "document",
    template: doc.template,
    ...(doc.output ? { output: doc.output } : {}),
    ...(doc.outputPattern ? { outputPattern: doc.outputPattern } : {}),
    ...(doc.perDomain ? { perDomain: doc.perDomain } : {}),
  };
}

function sectionNode(
  sec: SectionRegistry["documents"][0]["sections"][0],
  documentId: string,
): GraphNode {
  return {
    id: sec.id,
    type: "section",
    documentId,
    heading: sec.heading,
    level: sec.level,
    order: sec.order,
  };
}

function resolveParentId(
  sections: SectionRegistry["documents"][0]["sections"],
  index: number,
): string | null {
  const current = sections[index];
  if (current.level <= 2) {
    return null;
  }
  for (let i = index - 1; i >= 0; i--) {
    if (sections[i].level === current.level - 1) {
      return sections[i].id;
    }
  }
  return null;
}

export function bootstrapFromRegistry(registry: SectionRegistry): InMemoryGraph {
  const graph = InMemoryGraph.from(emptyGraph());

  for (const doc of registry.documents) {
    graph.addNode(documentNode(doc));

    for (let i = 0; i < doc.sections.length; i++) {
      const sec = doc.sections[i];
      graph.addNode(sectionNode(sec, doc.documentId));

      const parentSectionId = resolveParentId(doc.sections, i);
      const parentId = parentSectionId ?? doc.documentId;

      const partOf: GraphEdge = { type: "partOf", from: sec.id, to: parentId };
      const contains: GraphEdge = { type: "contains", from: parentId, to: sec.id };
      graph.addEdge(partOf);
      graph.addEdge(contains);

      if (i > 0) {
        const prev = doc.sections[i - 1];
        if (prev.level === sec.level) {
          graph.addEdge({ type: "follows", from: prev.id, to: sec.id });
        }
      }
    }
  }

  return graph;
}
