import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  DEFAULT_IMPACT_RULES,
  GraphSession,
  type TraceabilityGraph,
} from "../src/index.js";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "../../..");

function loadGraphj(): TraceabilityGraph {
  const raw = readFileSync(join(repoRoot, "graphj.json"), "utf8");
  return JSON.parse(raw) as TraceabilityGraph;
}

describe("GraphSession", () => {
  it("loads graphj.json and returns stats", () => {
    const session = GraphSession.fromJson(loadGraphj(), {
      impactRules: DEFAULT_IMPACT_RULES,
    });
    const stats = session.stats();
    expect(stats.nodes).toBeGreaterThan(0);
    expect(stats.edges).toBeGreaterThan(0);
  });

  it("queries a subgraph when seed exists", () => {
    const graph = loadGraphj();
    const seed = graph.nodes[0]?.id;
    if (!seed) {
      return;
    }
    const session = GraphSession.fromJson(graph, {
      impactRules: DEFAULT_IMPACT_RULES,
    });
    const result = session.query(seed, { depth: 1 });
    expect(result.seed).toBe(seed);
    expect(result.nodes.length).toBeGreaterThan(0);
  });

  it("runs impact when rules are provided", () => {
    const graph = loadGraphj();
    const domain = graph.nodes.find((n) => n.type === "feature");
    if (!domain) {
      return;
    }
    const session = GraphSession.fromJson(graph, {
      impactRules: DEFAULT_IMPACT_RULES,
    });
    const impact = session.impactFromNode(domain.id);
    expect(impact.origin.id).toBe(domain.id);
    expect(Array.isArray(impact.regenerate)).toBe(true);
    expect(Array.isArray(impact.review)).toBe(true);
  });

  it("throws when impact is called without rules", () => {
    const session = GraphSession.fromJson(loadGraphj());
    expect(() => session.impactFromNode("any")).toThrow(/Impact rules required/);
  });
});
