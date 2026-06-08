import { InMemoryGraph } from "./InMemoryGraph.js";
import {
  computeImpact,
  mergeImpactResults,
  type ImpactResult,
  type ImpactRulesFile,
} from "./impact.js";
import { querySubgraph, type GraphQueryResult, type QueryOptions } from "./query.js";
import {
  pickPrimaryImpactOrigin,
  resolveImpactOrigins,
  type ResolvedOrigin,
  type ResolveHints,
} from "./resolve.js";
import { computeGraphStats, type GraphStats } from "./stats.js";
import type { TraceabilityGraph } from "../../types.js";

export interface GraphSessionOptions {
  impactRules?: ImpactRulesFile;
}

export interface ResolveOriginsHints {
  id?: string;
  file?: string;
  heading?: string;
  text?: string;
  sectionAnchor?: string;
}

export interface ImpactOptions {
  change?: string;
}

export class GraphSession {
  readonly graph: InMemoryGraph;
  private readonly impactRules: ImpactRulesFile | undefined;

  private constructor(graph: InMemoryGraph, options?: GraphSessionOptions) {
    this.graph = graph;
    this.impactRules = options?.impactRules;
  }

  /** Build a session from `traceability.graph.json` (or equivalent JSON). */
  static fromJson(
    data: TraceabilityGraph,
    options?: GraphSessionOptions,
  ): GraphSession {
    return new GraphSession(InMemoryGraph.from(data), options);
  }

  query(seedId: string, options?: QueryOptions): GraphQueryResult {
    return querySubgraph(this.graph, seedId, options);
  }

  stats(): GraphStats {
    return computeGraphStats(this.graph.toTraceabilityGraph());
  }

  resolveOrigins(hints: ResolveOriginsHints): ResolvedOrigin[] {
    const resolveHints: ResolveHints = {
      nodeId: hints.id,
      file: hints.file,
      heading: hints.heading,
      text: hints.text,
      sectionAnchor: hints.sectionAnchor,
    };
    return resolveImpactOrigins(this.graph, resolveHints);
  }

  impactFromNode(nodeId: string, options: ImpactOptions = {}): ImpactResult {
    this.requireImpactRules();
    return computeImpact(
      this.graph,
      nodeId,
      options.change ?? "change",
      this.impactRules!,
    );
  }

  impactFromOrigins(
    origins: ResolvedOrigin[],
    options: ImpactOptions = {},
  ): ImpactResult {
    this.requireImpactRules();
    if (origins.length === 0) {
      throw new Error("impactFromOrigins requires at least one origin");
    }
    const change = options.change ?? "change";
    const results = origins.map((o) =>
      computeImpact(this.graph, o.id, change, this.impactRules!),
    );
    const merged = mergeImpactResults(results);
    const primary = pickPrimaryImpactOrigin(origins);
    if (primary) {
      merged.resolvedFrom = {
        id: primary.id,
        type: primary.type,
        reason: primary.reason,
      };
    }
    return merged;
  }

  mergeImpacts(results: ImpactResult[]): ImpactResult {
    return mergeImpactResults(results);
  }

  private requireImpactRules(): void {
    if (!this.impactRules) {
      throw new Error(
        "Impact rules required. Pass impactRules to GraphSession.fromJson() or use DEFAULT_IMPACT_RULES.",
      );
    }
  }
}
