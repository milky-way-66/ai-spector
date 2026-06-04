import { readJson } from "../util/fs.js";
import type { NodeType } from "../types.js";
import { InMemoryGraph } from "./InMemoryGraph.js";
import { projectionPathForNode } from "./query.js";

export interface ImpactRulesFile {
  version: number;
  edgePropagation: Record<
    string,
    { direction: "in" | "out" | "both"; depth: number | "unbounded" }
  >;
  buckets: Record<string, NodeType[]>;
}

export interface ImpactEntry {
  id: string;
  type: string;
  reason: string;
  projectionPath?: string;
}

export interface ImpactResult {
  origin: { id: string; type: string; change: string };
  affected: {
    regenerate: ImpactEntry[];
    review: ImpactEntry[];
  };
  /** Translation document nodes that may be stale after this change. */
  staleTranslations?: ImpactEntry[];
  /** Present when CLI resolved origin via --file / --heading */
  resolvedFrom?: { id: string; type: string; reason: string };
  /** Present when multiple seeds were analyzed (e.g. --git) */
  gitSeeds?: Array<{
    id: string;
    type: string;
    reason: string;
    file?: string;
    heading?: string;
  }>;
}

function maxDepth(d: number | "unbounded"): number {
  return d === "unbounded" ? 10_000 : d;
}

export interface ImpactProvenance {
  fromId: string;
  edgeType: string;
}

/** Returns the set of reached node IDs (excludes origin). Public API for callers that only need reachability. */
export function propagateImpact(
  g: InMemoryGraph,
  originId: string,
  rules: ImpactRulesFile,
): Set<string> {
  const map = propagateImpactWithProvenance(g, originId, rules);
  return new Set(map.keys());
}

/** Internal: returns provenance (immediate predecessor + edge type) for each reached node. */
function propagateImpactWithProvenance(
  g: InMemoryGraph,
  originId: string,
  rules: ImpactRulesFile,
): Map<string, ImpactProvenance> {
  const provenance = new Map<string, ImpactProvenance>();
  const seen = new Set<string>([originId]);
  const queue: { id: string; depth: number }[] = [{ id: originId, depth: 0 }];
  const cap = 500;

  while (queue.length > 0) {
    const { id: current, depth } = queue.shift()!;
    if (depth >= cap) {
      continue;
    }

    for (const [edgeType, rule] of Object.entries(rules.edgePropagation)) {
      const limit = maxDepth(rule.depth);
      if (depth >= limit) {
        continue;
      }

      if (rule.direction === "out" || rule.direction === "both") {
        for (const e of g.outEdges.get(current) ?? []) {
          if (e.type !== edgeType) {
            continue;
          }
          if (!seen.has(e.to)) {
            seen.add(e.to);
            provenance.set(e.to, { fromId: current, edgeType });
            queue.push({ id: e.to, depth: depth + 1 });
          }
        }
      }
      if (rule.direction === "in" || rule.direction === "both") {
        for (const e of g.inEdges.get(current) ?? []) {
          if (e.type !== edgeType) {
            continue;
          }
          if (!seen.has(e.from)) {
            seen.add(e.from);
            provenance.set(e.from, { fromId: current, edgeType });
            queue.push({ id: e.from, depth: depth + 1 });
          }
        }
      }
    }
  }

  return provenance;
}

function bucketForType(
  type: string,
  buckets: ImpactRulesFile["buckets"],
): keyof ImpactResult["affected"] | null {
  for (const [name, types] of Object.entries(buckets)) {
    if (types.includes(type as NodeType)) {
      return name as keyof ImpactResult["affected"];
    }
  }
  return null;
}

export function computeImpact(
  g: InMemoryGraph,
  originId: string,
  change: string,
  rules: ImpactRulesFile,
): ImpactResult {
  const origin = g.nodesById.get(originId);
  if (!origin) {
    throw new Error(`Unknown node: ${originId}`);
  }

  const provenance = propagateImpactWithProvenance(g, originId, rules);

  const result: ImpactResult = {
    origin: { id: originId, type: origin.type, change },
    affected: { regenerate: [], review: [] },
  };

  for (const [id, prov] of provenance) {
    const node = g.nodesById.get(id);
    if (!node) {
      continue;
    }
    const bucket = bucketForType(node.type, rules.buckets);
    if (!bucket || !(bucket in result.affected)) {
      continue;
    }
    const entry: ImpactEntry = {
      id,
      type: node.type,
      reason: `${prov.edgeType} from ${prov.fromId}`,
      projectionPath: projectionPathForNode(g, id),
    };
    result.affected[bucket as keyof ImpactResult["affected"]].push(entry);
  }

  for (const key of Object.keys(result.affected) as (keyof ImpactResult["affected"])[]) {
    result.affected[key].sort((a, b) => a.id.localeCompare(b.id));
  }

  // Collect translation nodes that are stale (reverse translationOf from affected documents)
  const staleTranslations: ImpactEntry[] = [];
  const affectedDocIds = new Set(
    [...result.affected.regenerate, ...result.affected.review]
      .filter((e) => g.nodesById.get(e.id)?.type === "document")
      .map((e) => e.id),
  );
  // Also include origin if it's a document
  if (origin.type === "document") {
    affectedDocIds.add(originId);
  }
  for (const docId of affectedDocIds) {
    for (const e of g.inEdges.get(docId) ?? []) {
      if (e.type !== "translationOf") continue;
      const translationNode = g.nodesById.get(e.from);
      if (!translationNode) continue;
      staleTranslations.push({
        id: e.from,
        type: translationNode.type,
        reason: `translationOf ${docId}`,
        projectionPath: projectionPathForNode(g, e.from),
      });
    }
  }
  if (staleTranslations.length > 0) {
    staleTranslations.sort((a, b) => a.id.localeCompare(b.id));
    result.staleTranslations = staleTranslations;
  }

  return result;
}

export function mergeImpactResults(
  results: ImpactResult[],
  gitSeeds?: ImpactResult["gitSeeds"],
): ImpactResult {
  if (results.length === 0) {
    throw new Error("mergeImpactResults requires at least one result");
  }
  if (results.length === 1) {
    const single = { ...results[0] };
    if (gitSeeds?.length) {
      single.gitSeeds = gitSeeds;
    }
    return single;
  }

  const merged: ImpactResult = {
    origin: {
      id: results.map((r) => r.origin.id).join(","),
      type: "multi",
      change: results[0].origin.change,
    },
    affected: { regenerate: [], review: [] },
    gitSeeds:
      gitSeeds ??
      results.map((r) => ({
        id: r.origin.id,
        type: r.origin.type,
        reason: r.resolvedFrom?.reason ?? "git diff seed",
      })),
  };

  const seen = new Set<string>();
  for (const key of Object.keys(merged.affected) as (keyof ImpactResult["affected"])[]) {
    for (const r of results) {
      for (const e of r.affected[key]) {
        const dedupeKey = `${key}:${e.id}`;
        if (seen.has(dedupeKey)) {
          continue;
        }
        seen.add(dedupeKey);
        merged.affected[key].push(e);
      }
    }
    merged.affected[key].sort((a, b) => a.id.localeCompare(b.id));
  }

  return merged;
}

export async function loadImpactRules(path: string): Promise<ImpactRulesFile> {
  return readJson<ImpactRulesFile>(path);
}
