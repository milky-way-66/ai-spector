import { describe, expect, it } from "vitest";
import { InMemoryGraph } from "../../src/core/graph/InMemoryGraph.js";
import { mergePatch } from "../../src/core/graph/merge.js";
import { normalizeDataSourcePath } from "../../src/core/graph/provenance.js";
import { node } from "../helpers/graph.js";

describe("normalizeDataSourcePath", () => {
  it("maps knowledge-style sourceRef paths under docs/data-source", () => {
    expect(
      normalizeDataSourcePath(
        "requirement/SAKUSEN_TOKYO_Development_Request_Outline_v1.en.md §1-4",
        "docs/data-source",
      ),
    ).toBe(
      "docs/data-source/requirement/SAKUSEN_TOKYO_Development_Request_Outline_v1.en.md",
    );
  });
});

describe("derivedFrom path targets", () => {
  it("loads derivedFrom without a target node", () => {
    const g = InMemoryGraph.from({
      version: 1,
      nodes: [node("UC-01", "useCase")],
      edges: [
        {
          type: "derivedFrom",
          from: "UC-01",
          to: "docs/data-source/interviews/uc01.md",
        },
      ],
    });
    expect(g.hasEdge({
      type: "derivedFrom",
      from: "UC-01",
      to: "docs/data-source/interviews/uc01.md",
    })).toBe(true);
  });

  it("mergePatch allows derivedFrom from domain nodes", () => {
    const g = InMemoryGraph.from({
      version: 1,
      nodes: [node("UC-01", "useCase")],
      edges: [],
    });
    const { stats } = mergePatch(g, {
      version: 1,
      nodes: [],
      edges: [
        {
          type: "derivedFrom",
          from: "UC-01",
          to: "docs/data-source/foo.md",
        },
      ],
    });
    expect(stats.edgesAdded).toBe(1);
  });
});
