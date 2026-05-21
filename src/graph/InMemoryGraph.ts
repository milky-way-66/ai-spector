import type { GraphEdge, GraphNode, TraceabilityGraph, ValidationIssue } from "../types.js";

export class InMemoryGraph {
  readonly nodesById = new Map<string, GraphNode>();
  readonly outEdges = new Map<string, GraphEdge[]>();
  readonly inEdges = new Map<string, GraphEdge[]>();

  static from(data: TraceabilityGraph): InMemoryGraph {
    const g = new InMemoryGraph();
    for (const node of data.nodes) {
      g.addNode(node);
    }
    for (const edge of data.edges) {
      if (!g.nodesById.has(edge.from)) {
        throw new Error(`Edge references missing node: ${edge.from} -> ${edge.to}`);
      }
      if (edge.type !== "rendersTo" && !g.nodesById.has(edge.to)) {
        throw new Error(`Edge references missing node: ${edge.from} -> ${edge.to}`);
      }
      g.addEdge(edge);
    }
    return g;
  }

  toJSON(): TraceabilityGraph {
    return {
      version: 1,
      nodes: [...this.nodesById.values()],
      edges: [...this.outEdges.values(), ...this.inEdges.values()].flat(),
    };
  }

  /** Dedupe edges when exporting (each edge stored once in outEdges). */
  toTraceabilityGraph(): TraceabilityGraph {
    const edgeSet = new Set<string>();
    const edges: GraphEdge[] = [];
    for (const list of this.outEdges.values()) {
      for (const e of list) {
        const key = `${e.type}|${e.from}|${e.to}|${e.role ?? ""}`;
        if (!edgeSet.has(key)) {
          edgeSet.add(key);
          edges.push(e);
        }
      }
    }
    return {
      version: 1,
      nodes: [...this.nodesById.values()],
      edges,
    };
  }

  addNode(node: GraphNode): void {
    if (this.nodesById.has(node.id)) {
      throw new Error(`Duplicate node id: ${node.id}`);
    }
    this.nodesById.set(node.id, node);
    this.outEdges.set(node.id, []);
    this.inEdges.set(node.id, []);
  }

  /** Update an existing node or insert. Same `type` required when updating. */
  upsertNode(node: GraphNode): "created" | "updated" {
    const existing = this.nodesById.get(node.id);
    if (existing) {
      if (existing.type !== node.type) {
        throw new Error(
          `Cannot change node type for ${node.id}: ${existing.type} → ${node.type}`,
        );
      }
      this.nodesById.set(node.id, { ...existing, ...node });
      return "updated";
    }
    this.addNode(node);
    return "created";
  }

  edgeKey(edge: GraphEdge): string {
    return `${edge.type}|${edge.from}|${edge.to}|${edge.role ?? ""}`;
  }

  hasEdge(edge: GraphEdge): boolean {
    const key = this.edgeKey(edge);
    for (const list of this.outEdges.values()) {
      for (const e of list) {
        if (this.edgeKey(e) === key) {
          return true;
        }
      }
    }
    return false;
  }

  addEdge(edge: GraphEdge): void {
    this.outEdges.get(edge.from)!.push(edge);
    const inbound = this.inEdges.get(edge.to);
    if (inbound) {
      inbound.push(edge);
    } else if (edge.type !== "rendersTo") {
      throw new Error(`Edge references missing target node: ${edge.from} -> ${edge.to}`);
    }
  }

  addEdgeIfAbsent(edge: GraphEdge): boolean {
    if (this.hasEdge(edge)) {
      return false;
    }
    if (!this.nodesById.has(edge.from)) {
      throw new Error(`Edge references missing source node: ${edge.from}`);
    }
    // rendersTo targets a markdown path, not a graph node id
    if (edge.type !== "rendersTo" && !this.nodesById.has(edge.to)) {
      throw new Error(`Edge references missing target node: ${edge.from} -> ${edge.to}`);
    }
    this.addEdge(edge);
    return true;
  }

  neighbors(
    id: string,
    direction: "out" | "in" | "both",
    edgeTypes?: Set<string>,
    depth = 1,
  ): Set<string> {
    const seen = new Set<string>();
    const queue: { id: string; d: number }[] = [{ id, d: 0 }];
    while (queue.length > 0) {
      const { id: current, d } = queue.shift()!;
      if (d > depth) {
        continue;
      }
      if (d > 0) {
        seen.add(current);
      }
      if (d === depth) {
        continue;
      }
      const expand = (next: string) => {
        if (!seen.has(next) && next !== id) {
          queue.push({ id: next, d: d + 1 });
        }
      };
      if (direction === "out" || direction === "both") {
        for (const e of this.outEdges.get(current) ?? []) {
          if (!edgeTypes || edgeTypes.has(e.type)) {
            expand(e.to);
          }
        }
      }
      if (direction === "in" || direction === "both") {
        for (const e of this.inEdges.get(current) ?? []) {
          if (!edgeTypes || edgeTypes.has(e.type)) {
            expand(e.from);
          }
        }
      }
    }
    seen.delete(id);
    return seen;
  }

  validateStructure(): ValidationIssue[] {
    const issues: ValidationIssue[] = [];
    const domainTypes = new Set([
      "actor",
      "useCase",
      "feature",
      "requirement",
      "dataEntity",
    ]);

    for (const node of this.nodesById.values()) {
      if (node.type === "section") {
        const partOf = (this.outEdges.get(node.id) ?? []).filter(
          (e) => e.type === "partOf",
        );
        if (partOf.length !== 1) {
          issues.push({
            ruleId: "SECTION-TREE",
            severity: "error",
            message: `Section ${node.id} must have exactly one partOf parent (found ${partOf.length})`,
            nodeId: node.id,
          });
        }
      }

      if (domainTypes.has(node.type)) {
        const anchored = (this.outEdges.get(node.id) ?? []).some((e) =>
          ["listedIn", "definedIn", "describedIn"].includes(e.type),
        );
        const anchoredIn = (this.inEdges.get(node.id) ?? []).some((e) =>
          ["listedIn", "definedIn", "describedIn"].includes(e.type),
        );
        if (!anchored && !anchoredIn) {
          issues.push({
            ruleId: "DOMAIN-ANCHORED",
            severity: "error",
            message: `Domain node ${node.id} has no listedIn, definedIn, or describedIn edge`,
            nodeId: node.id,
          });
        }
      }
    }

    for (const node of this.nodesById.values()) {
      if (node.type === "document") {
        const hasSection = [...this.outEdges.get(node.id) ?? []].some(
          (e) =>
            e.type === "contains" &&
            this.nodesById.get(e.to)?.type === "section",
        );
        if (!hasSection) {
          issues.push({
            ruleId: "DOC-SECTION-COVERAGE",
            severity: "error",
            message: `Document ${node.id} has no child sections`,
            nodeId: node.id,
          });
        }
      }
    }

    return issues;
  }
}
