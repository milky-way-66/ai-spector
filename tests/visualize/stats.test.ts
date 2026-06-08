import { describe, expect, it } from "vitest";
import {
  computeGraphStats,
  computeKnowledgeStats,
} from "../../src/core/visualize/stats.js";
import { graph, node } from "../helpers/graph.js";

describe("computeGraphStats", () => {
  it("counts nodes by type and splits domain vs structure", () => {
    const stats = computeGraphStats(
      graph(
        [
          node("doc.srs", "document"),
          node("sec.a", "section"),
          node("feat.x", "feature"),
        ],
        [{ type: "contains", from: "doc.srs", to: "sec.a" }],
      ),
    );

    expect(stats.nodes).toBe(3);
    expect(stats.edges).toBe(1);
    expect(stats.structureNodes).toBe(2);
    expect(stats.domainNodes).toBe(1);
    expect(stats.byType).toEqual({
      document: 1,
      section: 1,
      feature: 1,
    });
  });
});

describe("computeKnowledgeStats", () => {
  it("returns zeroed stats when knowledge is null", () => {
    expect(computeKnowledgeStats(null)).toEqual({
      present: false,
      actors: 0,
      useCases: 0,
      features: 0,
      functionalRequirements: 0,
      nfrs: 0,
      entities: 0,
    });
  });

  it("counts knowledge arrays when present", () => {
    const stats = computeKnowledgeStats({
      actors: [{ id: "a", name: "A" }],
      features: [{ id: "f", title: "F" }],
    });

    expect(stats.present).toBe(true);
    expect(stats.actors).toBe(1);
    expect(stats.features).toBe(1);
    expect(stats.useCases).toBe(0);
  });
});
