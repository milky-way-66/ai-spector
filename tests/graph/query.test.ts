import { describe, expect, it } from "vitest";
import {
  dataSourcePathsForNode,
  projectionPathForNode,
  querySubgraph,
  resolveDocumentForNode,
} from "../../src/core/graph/query.js";
import { loadGraph, node } from "../helpers/graph.js";

describe("resolveDocumentForNode", () => {
  it("returns the document for a section via partOf chain", () => {
    const g = loadGraph(
      [
        node("doc.srs", "document", { output: "docs/srs.md" }),
        node("sec.intro", "section"),
      ],
      [
        { type: "contains", from: "doc.srs", to: "sec.intro" },
        { type: "partOf", from: "sec.intro", to: "doc.srs" },
      ],
    );

    expect(resolveDocumentForNode(g, "sec.intro")?.id).toBe("doc.srs");
  });

  it("returns the document for a domain node via listedIn", () => {
    const g = loadGraph(
      [
        node("doc.srs", "document"),
        node("sec.anchor", "section"),
        node("feat.login", "feature"),
      ],
      [
        { type: "contains", from: "doc.srs", to: "sec.anchor" },
        { type: "partOf", from: "sec.anchor", to: "doc.srs" },
        { type: "listedIn", from: "feat.login", to: "sec.anchor" },
      ],
    );

    expect(resolveDocumentForNode(g, "feat.login")?.id).toBe("doc.srs");
  });
});

describe("projectionPathForNode", () => {
  it("uses document output for document nodes", () => {
    const g = loadGraph(
      [node("doc.srs", "document", { output: "docs/srs.md" })],
      [],
    );

    expect(projectionPathForNode(g, "doc.srs")).toBe("docs/srs.md");
  });

  it("uses outputPattern for sections when the parent document defines it", () => {
    const g = loadGraph(
      [
        node("doc.srs", "document", { outputPattern: "docs/srs/{slug}.md" }),
        node("sec.intro", "section"),
      ],
      [
        { type: "contains", from: "doc.srs", to: "sec.intro" },
        { type: "partOf", from: "sec.intro", to: "doc.srs" },
      ],
    );

    expect(projectionPathForNode(g, "sec.intro")).toBe("docs/srs/{slug}.md");
  });

  it("collects derivedFrom data-source paths", () => {
    const g = loadGraph([node("UC-01", "useCase")], [
      {
        type: "derivedFrom",
        from: "UC-01",
        to: "docs/data-source/interviews/a.md",
      },
    ]);

    expect(dataSourcePathsForNode(g, "UC-01")).toEqual([
      "docs/data-source/interviews/a.md",
    ]);
  });

  it("uses rendersTo target for domain nodes", () => {
    const g = loadGraph([node("feat.x", "feature")], [
      { type: "rendersTo", from: "feat.x", to: "docs/features/x.md" },
    ]);

    expect(projectionPathForNode(g, "feat.x")).toBe("docs/features/x.md");
  });
});

describe("querySubgraph", () => {
  it("throws for unknown seed ids", () => {
    const g = loadGraph([], []);

    expect(() => querySubgraph(g, "missing")).toThrow(/Unknown node id/);
  });

  it("collects neighbors within depth and filters by node type", () => {
    const g = loadGraph(
      [
        node("doc.srs", "document"),
        node("sec.a", "section"),
        node("sec.b", "section"),
        node("feat.x", "feature"),
      ],
      [
        { type: "contains", from: "doc.srs", to: "sec.a" },
        { type: "partOf", from: "sec.a", to: "doc.srs" },
        { type: "contains", from: "doc.srs", to: "sec.b" },
        { type: "partOf", from: "sec.b", to: "doc.srs" },
        { type: "follows", from: "sec.a", to: "sec.b" },
        { type: "listedIn", from: "feat.x", to: "sec.a" },
      ],
    );

    const result = querySubgraph(g, "sec.a", {
      depth: 1,
      direction: "both",
      edgeTypes: ["follows", "listedIn"],
      nodeTypes: ["section", "feature"],
    });

    expect(result.seed).toBe("sec.a");
    expect(result.nodes.map((n) => n.id).sort()).toEqual(["feat.x", "sec.a", "sec.b"]);
    expect(result.edges.some((e) => e.type === "follows")).toBe(true);
  });

  it("omits projection paths that still contain template placeholders", () => {
    const g = loadGraph(
      [
        node("doc.srs", "document", { outputPattern: "docs/srs/{slug}.md" }),
        node("sec.intro", "section"),
      ],
      [
        { type: "contains", from: "doc.srs", to: "sec.intro" },
        { type: "partOf", from: "sec.intro", to: "doc.srs" },
      ],
    );

    const result = querySubgraph(g, "sec.intro", { depth: 1 });

    expect(result.projectionPaths).toEqual([]);
  });

  it("includes derivedFrom paths in projectionPaths", () => {
    const g = loadGraph(
      [node("UC-01", "useCase"), node("sec", "section")],
      [
        { type: "listedIn", from: "UC-01", to: "sec" },
        {
          type: "derivedFrom",
          from: "UC-01",
          to: "docs/data-source/spec.ts",
        },
      ],
    );

    const result = querySubgraph(g, "UC-01", {
      depth: 1,
      edgeTypes: ["derivedFrom", "listedIn"],
    });

    expect(result.projectionPaths).toContain("docs/data-source/spec.ts");
  });
});
