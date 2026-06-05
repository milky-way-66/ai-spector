import { describe, expect, it } from "vitest";
import { simulatePatch } from "../src/patch.js";
import { loadGraph, node } from "../../../tests/helpers/graph.js";

describe("simulatePatch", () => {
  it("previews nodes and edges to add without mutating graph", () => {
    const g = loadGraph([node("UC-01", "useCase")], []);
    const before = g.toTraceabilityGraph().nodes.length;

    const sim = simulatePatch(g, {
      version: 1,
      nodes: [
        node("F-01", "feature"),
        node("UC-01", "useCase", { title: "Updated" }),
      ],
      edges: [
        { type: "satisfies", from: "F-01", to: "UC-01" },
        { type: "satisfies", from: "F-99", to: "UC-01" },
      ],
    });

    expect(sim.nodesToCreate).toHaveLength(1);
    expect(sim.nodesToCreate[0].id).toBe("F-01");
    expect(sim.nodesToUpdate).toHaveLength(1);
    expect(sim.edgesToAdd).toHaveLength(1);
    expect(sim.edgesSkipped).toHaveLength(1);
    expect(g.toTraceabilityGraph().nodes.length).toBe(before);
  });
});
