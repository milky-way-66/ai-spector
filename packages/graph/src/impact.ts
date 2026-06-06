import type { NodeType } from "./types.js";
import { InMemoryGraph } from "./InMemoryGraph.js";
import { projectionPathForNode } from "./query.js";
import defaultImpactRules from "./rules/default-impact.json" with { type: "json" };

type EdgeRule = { direction: "in" | "out"; depth: number | "unbounded" };

export interface ImpactRulesFile {
  version: 2;
  pass1_expand: Record<string, EdgeRule>;
  pass2_downstream: Record<string, EdgeRule>;
  buckets: { regenerate: NodeType[]; review: NodeType[] };
  maxNodes?: number;
}

export interface ImpactEntry {
  id: string;
  type: string;
  reason: string;
  projectionPath?: string;
}

export interface ImpactResult {
  origin: { id: string; type: string; change: string };
  regenerate: ImpactEntry[];
  review: ImpactEntry[];
  affectedOutputPaths: string[];
  staleTranslations?: ImpactEntry[];
  resolvedFrom?: { id: string; type: string; reason: string };
  truncated?: boolean;
  noTraceabilityImpact?: boolean;
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

interface Provenance {
  fromId: string;
  edgeType: string;
}

function runBfs(
  g: InMemoryGraph,
  seeds: string[],
  rules: Record<string, EdgeRule>,
  globalSeen: Set<string>,
): { provenance: Map<string, Provenance>; capped: boolean } {
  const provenance = new Map<string, Provenance>();
  const queue: { id: string; depth: number }[] = seeds.map((id) => ({ id, depth: 0 }));
  const cap = rules.maxNodes ?? 500;
  let capped = false;

  while (queue.length > 0) {
    const { id: current, depth } = queue.shift()!;
    if (depth >= cap) {
      capped = true;
      continue;
    }

    for (const [edgeType, rule] of Object.entries(rules)) {
      const limit = maxDepth(rule.depth);
      if (depth >= limit) continue;

      if (rule.direction === "out") {
        for (const e of g.outEdges.get(current) ?? []) {
          if (e.type !== edgeType || globalSeen.has(e.to)) continue;
          globalSeen.add(e.to);
          provenance.set(e.to, { fromId: current, edgeType });
          queue.push({ id: e.to, depth: depth + 1 });
        }
      } else {
        for (const e of g.inEdges.get(current) ?? []) {
          if (e.type !== edgeType || globalSeen.has(e.from)) continue;
          globalSeen.add(e.from);
          provenance.set(e.from, { fromId: current, edgeType });
          queue.push({ id: e.from, depth: depth + 1 });
        }
      }
    }
  }

  return { provenance, capped };
}

function makeEntry(g: InMemoryGraph, id: string, prov: Provenance): ImpactEntry {
  const node = g.nodesById.get(id)!;
  return {
    id,
    type: node.type,
    reason: `${prov.edgeType} from ${prov.fromId}`,
    projectionPath: projectionPathForNode(g, id),
  };
}

export function parseImpactRules(json: unknown): ImpactRulesFile {
  const raw = json as { version?: number };
  if (raw.version !== 2) {
    throw new Error(
      `rules.impact.json version ${raw.version ?? "unknown"} is not supported. Expected version 2.`,
    );
  }
  return json as ImpactRulesFile;
}

export const DEFAULT_IMPACT_RULES: ImpactRulesFile = parseImpactRules(defaultImpactRules);

export function computeImpact(
  g: InMemoryGraph,
  originId: string,
  change: string,
  rules: ImpactRulesFile,
): ImpactResult {
  const origin = g.nodesById.get(originId);
  if (!origin) throw new Error(`Unknown node: ${originId}`);

  const result: ImpactResult = {
    origin: { id: originId, type: origin.type, change },
    regenerate: [],
    review: [],
    affectedOutputPaths: [],
  };

  const regenerateTypes = new Set<string>(rules.buckets.regenerate);
  const reviewTypes = new Set<string>(rules.buckets.review);

  const globalSeen = new Set<string>([originId]);
  let truncated = false;

  const { provenance: p1, capped: c1 } = runBfs(
    g,
    [originId],
    rules.pass1_expand,
    globalSeen,
  );
  if (c1) truncated = true;

  const domainSeeds: string[] = [];

  for (const [id, prov] of p1) {
    const node = g.nodesById.get(id);
    if (!node) continue;
    if (regenerateTypes.has(node.type)) {
      result.regenerate.push(makeEntry(g, id, prov));
    } else if (reviewTypes.has(node.type)) {
      result.review.push(makeEntry(g, id, prov));
      domainSeeds.push(id);
    }
  }

  if (reviewTypes.has(origin.type)) {
    domainSeeds.push(originId);
  }

  if (domainSeeds.length > 0) {
    const { provenance: p2, capped: c2 } = runBfs(
      g,
      domainSeeds,
      rules.pass2_downstream,
      globalSeen,
    );
    if (c2) truncated = true;

    for (const [id, prov] of p2) {
      const node = g.nodesById.get(id);
      if (!node) continue;
      if (regenerateTypes.has(node.type)) {
        result.regenerate.push(makeEntry(g, id, prov));
      } else if (reviewTypes.has(node.type)) {
        result.review.push(makeEntry(g, id, prov));
      }
    }
  }

  if (truncated) result.truncated = true;

  result.regenerate.sort((a, b) => a.id.localeCompare(b.id));
  result.review.sort((a, b) => a.id.localeCompare(b.id));

  for (const entry of result.regenerate) {
    for (const e of g.outEdges.get(entry.id) ?? []) {
      if (e.type === "rendersTo") result.affectedOutputPaths.push(e.to);
    }
  }
  result.affectedOutputPaths.sort();

  const affectedDocIds = new Set(
    result.regenerate.filter((e) => g.nodesById.get(e.id)?.type === "document").map((e) => e.id),
  );
  if (origin.type === "document") affectedDocIds.add(originId);

  const staleTranslations: ImpactEntry[] = [];
  for (const docId of affectedDocIds) {
    for (const e of g.inEdges.get(docId) ?? []) {
      if (e.type !== "translationOf") continue;
      const n = g.nodesById.get(e.from);
      if (!n) continue;
      staleTranslations.push({
        id: e.from,
        type: n.type,
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
  if (results.length === 0) throw new Error("mergeImpactResults requires at least one result");
  if (results.length === 1) {
    const single = { ...results[0] };
    if (gitSeeds?.length) single.gitSeeds = gitSeeds;
    return single;
  }

  const merged: ImpactResult = {
    origin: {
      id: results.map((r) => r.origin.id).join(","),
      type: "multi",
      change: results[0].origin.change,
    },
    regenerate: [],
    review: [],
    affectedOutputPaths: [],
    gitSeeds:
      gitSeeds ??
      results.map((r) => ({
        id: r.origin.id,
        type: r.origin.type,
        reason: r.resolvedFrom?.reason ?? "git diff seed",
      })),
  };

  if (results.some((r) => r.truncated)) merged.truncated = true;

  const seen = new Set<string>();
  for (const key of ["regenerate", "review"] as const) {
    for (const r of results) {
      for (const e of r[key]) {
        const dk = `${key}:${e.id}`;
        if (seen.has(dk)) continue;
        seen.add(dk);
        merged[key].push(e);
      }
    }
    merged[key].sort((a, b) => a.id.localeCompare(b.id));
  }

  const pathSeen = new Set<string>();
  for (const r of results) {
    for (const p of r.affectedOutputPaths) {
      if (!pathSeen.has(p)) {
        pathSeen.add(p);
        merged.affectedOutputPaths.push(p);
      }
    }
  }
  merged.affectedOutputPaths.sort();

  return merged;
}
