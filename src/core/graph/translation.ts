import type { GraphNode } from "../../types.js";
import { InMemoryGraph } from "./InMemoryGraph.js";

export interface TranslationLang {
  code: string;
  label: string;
}

/** Map primary output path to secondary language folder. */
export function translationOutputForLang(
  primary: GraphNode,
  langCode: string,
): string | undefined {
  const map = (p: string) =>
    p
      .replace(/^docs\/srs\//, `docs/srs/${langCode}/`)
      .replace(/^docs\/basic-design\//, `docs/basic-design/${langCode}/`);
  const outputPattern =
    typeof primary.outputPattern === "string" ? primary.outputPattern : undefined;
  const output = typeof primary.output === "string" ? primary.output : undefined;
  if (outputPattern) return map(outputPattern);
  if (output) return map(output);
  return undefined;
}

export function buildTranslationDocNode(
  primary: GraphNode,
  lang: TranslationLang,
): GraphNode {
  const id = `doc:${lang.code}:${primary.id}`;
  const node: GraphNode = {
    id,
    type: "document",
    lang: lang.code,
    label: lang.label,
  };
  if (typeof primary.template === "string") node.template = primary.template;
  if (typeof primary.title === "string") node.title = primary.title;
  if (typeof primary.outputPattern === "string") {
    node.outputPattern = translationOutputForLang(primary, lang.code);
    if (typeof primary.perDomain === "string") node.perDomain = primary.perDomain;
  } else {
    const out = translationOutputForLang(primary, lang.code);
    if (out) node.output = out;
  }
  return node;
}

/** Create or refresh a translation document node and wire translationOf + contains edges. */
export function wireTranslationDocNode(
  graph: InMemoryGraph,
  primary: GraphNode,
  lang: TranslationLang,
): "created" | "updated" {
  const translatedId = `doc:${lang.code}:${primary.id}`;
  const built = buildTranslationDocNode(primary, lang);
  const outcome = graph.upsertNode(built);
  graph.addEdgeIfAbsent({
    type: "translationOf",
    from: translatedId,
    to: primary.id,
  });
  for (const outEdge of graph.outEdges.get(primary.id) ?? []) {
    if (outEdge.type === "contains") {
      graph.addEdgeIfAbsent({
        type: "contains",
        from: translatedId,
        to: outEdge.to,
      });
    }
  }
  return outcome;
}

export function isTranslationDocId(nodeId: string, langCodes: string[]): boolean {
  return langCodes.some((code) => nodeId.startsWith(`doc:${code}:`));
}

export function primaryDocumentNodes(
  graph: InMemoryGraph,
  langCodes: string[],
): GraphNode[] {
  return [...graph.nodesById.values()].filter(
    (n) => n.type === "document" && !isTranslationDocId(n.id, langCodes),
  );
}
