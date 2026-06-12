import type { GraphNode } from "@/types.js";
import {
  localizedOutputForLang,
  localizedOutputForPrimary,
} from "../paths/localized-output.js";
import { InMemoryGraph } from "./InMemoryGraph.js";

export interface TranslationLang {
  code: string;
  label: string;
}

/** Map primary output path to secondary language folder. */
export function translationOutputForLang(
  primary: GraphNode,
  langCode: string,
  primaryLangCode?: string,
): string | undefined {
  const map = (p: string) => localizedOutputForLang(p, langCode, primaryLangCode);
  const outputPattern =
    typeof primary.outputPattern === "string" ? primary.outputPattern : undefined;
  const output = typeof primary.output === "string" ? primary.output : undefined;
  if (outputPattern) return map(outputPattern);
  if (output) return map(output);
  return undefined;
}

/** Localize builtin primary document output paths (docs/srs/{lang}/…). */
export function applyPrimaryLanguageOutputs(
  graph: InMemoryGraph,
  primaryLangCode: string,
  langCodes: string[],
): number {
  let updated = 0;
  for (const node of primaryDocumentNodes(graph, langCodes)) {
    let changed = false;
    const next: GraphNode = { ...node };
    if (typeof node.output === "string") {
      const localized = localizedOutputForPrimary(node.output, primaryLangCode);
      if (localized !== node.output) {
        next.output = localized;
        changed = true;
      }
    }
    if (typeof node.outputPattern === "string") {
      const localized = localizedOutputForPrimary(node.outputPattern, primaryLangCode);
      if (localized !== node.outputPattern) {
        next.outputPattern = localized;
        changed = true;
      }
    }
    if (changed) {
      graph.upsertNode(next);
      updated++;
    }
  }
  return updated;
}

export function buildTranslationDocNode(
  primary: GraphNode,
  lang: TranslationLang,
  primaryLangCode?: string,
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
    node.outputPattern = translationOutputForLang(primary, lang.code, primaryLangCode);
    if (typeof primary.perDomain === "string") node.perDomain = primary.perDomain;
  } else {
    const out = translationOutputForLang(primary, lang.code, primaryLangCode);
    if (out) node.output = out;
  }
  return node;
}

/** Create or refresh a translation document node and wire translationOf + contains edges. */
export function wireTranslationDocNode(
  graph: InMemoryGraph,
  primary: GraphNode,
  lang: TranslationLang,
  primaryLangCode?: string,
): "created" | "updated" {
  const translatedId = `doc:${lang.code}:${primary.id}`;
  const built = buildTranslationDocNode(primary, lang, primaryLangCode);
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
