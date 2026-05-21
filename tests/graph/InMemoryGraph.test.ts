import { describe, expect, it } from "vitest";
import { InMemoryGraph } from "../../src/graph/InMemoryGraph.js";
import type { GraphNode, TraceabilityGraph } from "../../src/types.js";
import { node } from "../helpers/graph.js";

function graph(
  nodes: GraphNode[],
  edges: TraceabilityGraph["edges"],
): TraceabilityGraph {
  return { version: 1, nodes, edges };
}

describe("InMemoryGraph.from", () => {
  it("throws when a normal edge references a missing target node", () => {
    const data = graph([node("parent"), node("child")], [
      { type: "contains", from: "parent", to: "missing-child" },
    ]);

    expect(() => InMemoryGraph.from(data)).toThrow(
      "Edge references missing node: parent -> missing-child",
    );
  });

  it("loads a normal edge when both endpoints exist", () => {
    const data = graph([node("parent", "document"), node("child")], [
      { type: "contains", from: "parent", to: "child" },
    ]);

    const g = InMemoryGraph.from(data);

    expect(g.nodesById.size).toBe(2);
    expect(g.hasEdge({ type: "contains", from: "parent", to: "child" })).toBe(
      true,
    );
  });

  it("allows derivedFrom when the target is not a graph node (data-source path)", () => {
    const data = graph([node("UC-01", "useCase")], [
      {
        type: "derivedFrom",
        from: "UC-01",
        to: "docs/data-source/interviews/uc01.md",
      },
    ]);

    const g = InMemoryGraph.from(data);

    expect(g.hasEdge({
      type: "derivedFrom",
      from: "UC-01",
      to: "docs/data-source/interviews/uc01.md",
    })).toBe(true);
  });

  it("allows rendersTo when the target is not a graph node (file path)", () => {
    const data = graph([node("srs:intro", "section")], [
      {
        type: "rendersTo",
        from: "srs:intro",
        to: "docs/srs/1-introduction.md",
      },
    ]);

    const g = InMemoryGraph.from(data);

    expect(g.nodesById.size).toBe(1);
    expect(
      g.hasEdge({
        type: "rendersTo",
        from: "srs:intro",
        to: "docs/srs/1-introduction.md",
      }),
    ).toBe(true);
    expect(g.inEdges.has("docs/srs/1-introduction.md")).toBe(false);
  });

  it("throws when rendersTo references a missing source node", () => {
    const data = graph([], [
      {
        type: "rendersTo",
        from: "missing-section",
        to: "docs/srs/1-introduction.md",
      },
    ]);

    expect(() => InMemoryGraph.from(data)).toThrow(
      "Edge references missing node: missing-section -> docs/srs/1-introduction.md",
    );
  });

  it("throws when a normal edge references a missing source node", () => {
    const data = graph([node("child")], [
      { type: "contains", from: "missing-parent", to: "child" },
    ]);

    expect(() => InMemoryGraph.from(data)).toThrow(
      "Edge references missing node: missing-parent -> child",
    );
  });
});

describe("InMemoryGraph mutations", () => {
  it("throws on duplicate node ids", () => {
    const g = InMemoryGraph.from(graph([node("a")], []));
    expect(() => g.addNode(node("a"))).toThrow(/Duplicate node id/);
  });

  it("upserts nodes and forbids type changes", () => {
    const g = InMemoryGraph.from(
      graph([node("doc.srs", "document", { output: "old.md" })], []),
    );
    expect(g.upsertNode(node("doc.srs", "document", { output: "new.md" }))).toBe(
      "updated",
    );
    expect(g.nodesById.get("doc.srs")?.output).toBe("new.md");
    expect(() => g.upsertNode(node("doc.srs", "useCase"))).toThrow(/Cannot change node type/);
  });

  it("deduplicates edges in toTraceabilityGraph export", () => {
    const g = InMemoryGraph.from(
      graph(
        [node("doc", "document"), node("sec", "section")],
        [
          { type: "contains", from: "doc", to: "sec" },
          { type: "partOf", from: "sec", to: "doc" },
        ],
      ),
    );

    const exported = g.toTraceabilityGraph();
    expect(exported.edges).toHaveLength(2);
  });
});

describe("InMemoryGraph.neighbors", () => {
  it("returns outbound neighbors filtered by edge type and depth", () => {
    const g = InMemoryGraph.from(
      graph(
        [node("a"), node("b"), node("c")],
        [
          { type: "contains", from: "a", to: "b" },
          { type: "follows", from: "b", to: "c" },
        ],
      ),
    );

    const n1 = g.neighbors("a", "out", new Set(["contains"]), 1);
    expect([...n1]).toEqual(["b"]);

    const n2 = g.neighbors("a", "out", new Set(["contains", "follows"]), 2);
    expect([...n2].sort()).toEqual(["b", "c"]);
  });
});

describe("InMemoryGraph.validateStructure", () => {
  it("flags sections without exactly one partOf parent", () => {
    const g = InMemoryGraph.from(graph([node("sec", "section")], []));
    const issues = g.validateStructure();
    expect(issues.some((i) => i.ruleId === "SECTION-TREE")).toBe(true);
  });

  it("flags domain nodes without anchoring edges", () => {
    const g = InMemoryGraph.from(graph([node("feat.x", "feature")], []));
    const issues = g.validateStructure();
    expect(issues.some((i) => i.ruleId === "DOMAIN-ANCHORED")).toBe(true);
  });

  it("flags documents with no child sections", () => {
    const g = InMemoryGraph.from(graph([node("doc", "document")], []));
    const issues = g.validateStructure();
    expect(issues.some((i) => i.ruleId === "DOC-SECTION-COVERAGE")).toBe(true);
  });

  it("allows per-domain instance documents without template sections", () => {
    const g = InMemoryGraph.from(
      graph(
        [
          node("doc.srs.uc-detail", "document", { outputPattern: "docs/srs/03-use-cases/*.md" }),
          node("sec.uc-detail", "section", { documentId: "doc.srs.uc-detail" }),
          node("doc.srs.uc-UC-01", "document", {
            output: "docs/srs/03-use-cases/uc-01.md",
            perDomain: "useCase",
          }),
          node("UC-01", "useCase"),
        ],
        [
          { type: "contains", from: "doc.srs.uc-detail", to: "sec.uc-detail" },
          { type: "partOf", from: "sec.uc-detail", to: "doc.srs.uc-detail" },
          { type: "partOf", from: "doc.srs.uc-UC-01", to: "doc.srs.uc-detail" },
          { type: "definedIn", from: "UC-01", to: "doc.srs.uc-UC-01" },
        ],
      ),
    );
    const issues = g.validateStructure().filter((i) => i.ruleId === "DOC-SECTION-COVERAGE");
    expect(issues).toHaveLength(0);
  });

  it("passes for a minimal valid document tree with anchored domain node", () => {
    const g = InMemoryGraph.from(
      graph(
        [
          node("doc", "document"),
          node("sec", "section"),
          node("feat", "feature"),
        ],
        [
          { type: "contains", from: "doc", to: "sec" },
          { type: "partOf", from: "sec", to: "doc" },
          { type: "listedIn", from: "feat", to: "sec" },
        ],
      ),
    );

    expect(g.validateStructure()).toEqual([]);
  });
});
