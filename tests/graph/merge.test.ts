import { describe, expect, it } from "vitest";
import { mergePatch, normalizePatch } from "../../src/graph/merge.js";
import type { GraphNode } from "../../src/types.js";
import { loadGraph, node } from "../helpers/graph.js";

describe("normalizePatch", () => {
  it("fills version and empty arrays when fields are omitted", () => {
    expect(normalizePatch({})).toEqual({ version: 1, nodes: [], edges: [] });
  });
});

describe("mergePatch", () => {
  it("skips structure nodes (section, table, diagram) and counts them as skipped", () => {
    const g = loadGraph([node("doc.srs", "document")], []);
    const result = mergePatch(g, {
      version: 1,
      nodes: [
        node("sec.a", "section"),
        node("tbl.1", "table"),
        node("diag.1", "diagram"),
      ],
      edges: [],
    });

    expect(result.stats.nodesSkipped).toBe(3);
    expect(result.stats.nodesCreated).toBe(0);
    expect(g.nodesById.has("sec.a")).toBe(false);
  });

  it("creates domain nodes and adds edges when absent", () => {
    const g = loadGraph(
      [node("doc.srs", "document"), node("sec.anchor", "section")],
      [{ type: "contains", from: "doc.srs", to: "sec.anchor" }],
    );

    const result = mergePatch(g, {
      version: 1,
      nodes: [node("feat.login", "feature", { title: "Login" })],
      edges: [{ type: "listedIn", from: "feat.login", to: "sec.anchor" }],
    });

    expect(result.stats.nodesCreated).toBe(1);
    expect(result.stats.edgesAdded).toBe(1);
    expect(g.hasEdge({ type: "listedIn", from: "feat.login", to: "sec.anchor" })).toBe(
      true,
    );
  });

  it("does not double-count edges that already exist", () => {
    const g = loadGraph(
      [
        node("doc.srs", "document"),
        node("sec.anchor", "section"),
        node("feat.login", "feature"),
      ],
      [
        { type: "contains", from: "doc.srs", to: "sec.anchor" },
        { type: "listedIn", from: "feat.login", to: "sec.anchor" },
      ],
    );

    const result = mergePatch(g, {
      version: 1,
      nodes: [],
      edges: [{ type: "listedIn", from: "feat.login", to: "sec.anchor" }],
    });

    expect(result.stats.edgesAdded).toBe(0);
  });

  it("allows rendersTo from a section to a file path", () => {
    const g = loadGraph(
      [node("doc.srs", "document"), node("sec.intro", "section")],
      [{ type: "contains", from: "doc.srs", to: "sec.intro" }],
    );

    mergePatch(g, {
      version: 1,
      nodes: [],
      edges: [
        {
          type: "rendersTo",
          from: "sec.intro",
          to: "docs/srs/intro.md",
        },
      ],
    });

    expect(
      g.hasEdge({
        type: "rendersTo",
        from: "sec.intro",
        to: "docs/srs/intro.md",
      }),
    ).toBe(true);
  });

  it("rejects edges that target structure nodes with disallowed types", () => {
    const g = loadGraph(
      [node("doc.srs", "document"), node("sec.a", "section")],
      [{ type: "contains", from: "doc.srs", to: "sec.a" }],
    );

    expect(() =>
      mergePatch(g, {
        version: 1,
        nodes: [node("feat.x", "feature")],
        edges: [{ type: "satisfies", from: "feat.x", to: "sec.a" }],
      }),
    ).toThrow(/cannot target structure node/);
  });

  it("throws for patch node types that are neither structure nor domain", () => {
    const g = loadGraph([], []);

    expect(() =>
      mergePatch(g, {
        version: 1,
        nodes: [{ id: "x", type: "unknown" as GraphNode["type"] }],
        edges: [],
      }),
    ).toThrow(/unsupported type/);
  });
});
