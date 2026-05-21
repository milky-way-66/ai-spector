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
    downstream: ImpactEntry[];
  };
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

export function propagateImpact(
  g: InMemoryGraph,
  originId: string,
  rules: ImpactRulesFile,
): Set<string> {
  const visited = new Set<string>([originId]);
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
          if (!visited.has(e.to)) {
            visited.add(e.to);
            queue.push({ id: e.to, depth: depth + 1 });
          }
        }
      }
      if (rule.direction === "in" || rule.direction === "both") {
        for (const e of g.inEdges.get(current) ?? []) {
          if (e.type !== edgeType) {
            continue;
          }
          if (!visited.has(e.from)) {
            visited.add(e.from);
            queue.push({ id: e.from, depth: depth + 1 });
          }
        }
      }
    }
  }

  visited.delete(originId);
  return visited;
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

  const affectedIds = propagateImpact(g, originId, rules);
  affectedIds.delete(originId);

  const result: ImpactResult = {
    origin: { id: originId, type: origin.type, change },
    affected: { regenerate: [], review: [], downstream: [] },
  };

  for (const id of affectedIds) {
    const node = g.nodesById.get(id)!;
    const bucket = bucketForType(node.type, rules.buckets);
    if (!bucket) {
      continue;
    }
    const entry: ImpactEntry = {
      id,
      type: node.type,
      reason: `reachable from ${originId} via impact propagation`,
      projectionPath: projectionPathForNode(g, id),
    };
    result.affected[bucket].push(entry);
  }

  for (const key of Object.keys(result.affected) as (keyof ImpactResult["affected"])[]) {
    result.affected[key].sort((a, b) => a.id.localeCompare(b.id));
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
    affected: { regenerate: [], review: [], downstream: [] },
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
