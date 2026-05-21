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

export async function loadImpactRules(path: string): Promise<ImpactRulesFile> {
  return readJson<ImpactRulesFile>(path);
}
