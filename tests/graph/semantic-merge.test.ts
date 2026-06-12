import { describe, expect, it } from "vitest";
import { mergePatch } from "@/core/graph/merge.js";
import { loadGraph, node } from "../helpers/graph.js";

describe("mergePatch semanticOnly", () => {
  it("merges relatesTo between section and sourceFile", () => {
    const g = loadGraph(
      [
        node("UC-03", "useCase"),
        node("sec.ov", "section", { documentId: "doc.srs.uc-UC-03" }),
        node("source.file:docs/data-source/r.md", "sourceFile", {
          path: "docs/data-source/r.md",
        }),
      ],
      [],
    );
    const result = mergePatch(
      g,
      {
        version: 1,
        nodes: [],
        edges: [
          {
            type: "relatesTo",
            from: "sec.ov",
            to: "source.file:docs/data-source/r.md",
            role: "evidence",
          },
          {
            type: "relatesTo",
            from: "UC-03",
            to: "sec.ov",
            role: "describes",
          },
        ],
      },
      { semanticOnly: true },
    );
    expect(result.stats.edgesAdded).toBe(2);
    expect(
      g.hasEdge({
        type: "relatesTo",
        from: "sec.ov",
        to: "source.file:docs/data-source/r.md",
        role: "evidence",
      }),
    ).toBe(true);
  });

  it("rejects structure nodes in semantic patch", () => {
    const g = loadGraph([node("UC-01", "useCase")], []);
    expect(() =>
      mergePatch(
        g,
        {
          version: 1,
          nodes: [node("sec.new", "section", { documentId: "doc.x" })],
          edges: [],
        },
        { semanticOnly: true },
      ),
    ).toThrow(/Semantic patch cannot add structure node/);
  });

  it("rejects satisfies in semantic-only mode", () => {
    const g = loadGraph(
      [node("F-01", "feature"), node("UC-01", "useCase")],
      [],
    );
    expect(() =>
      mergePatch(
        g,
        {
          version: 1,
          nodes: [],
          edges: [{ type: "satisfies", from: "F-01", to: "UC-01" }],
        },
        { semanticOnly: true },
      ),
    ).toThrow(/not allowed/);
  });
});
