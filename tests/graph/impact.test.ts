import { describe, expect, it } from "vitest";
import { computeImpact, propagateImpact } from "../../src/graph/impact.js";
import type { ImpactRulesFile } from "../../src/graph/impact.js";
import { loadGraph, node } from "../helpers/graph.js";

const SAMPLE_RULES: ImpactRulesFile = {
  version: 1,
  edgePropagation: {
    satisfies: { direction: "out", depth: 1 },
    listedIn: { direction: "in", depth: 1 },
  },
  buckets: {
    regenerate: ["section"],
    review: ["useCase", "feature"],
  },
};

describe("propagateImpact", () => {
  it("walks inbound edges per rules and excludes the origin", () => {
    const g = loadGraph(
      [
        node("uc.login", "useCase"),
        node("feat.auth", "feature"),
      ],
      [{ type: "satisfies", from: "feat.auth", to: "uc.login" }],
    );

    const affected = propagateImpact(g, "feat.auth", SAMPLE_RULES);

    expect(affected.has("feat.auth")).toBe(false);
    expect([...affected]).toEqual(["uc.login"]);
  });
});

describe("computeImpact", () => {
  it("buckets affected nodes and sorts entries by id", () => {
    const g = loadGraph(
      [
        node("doc.srs", "document", { output: "docs/srs.md" }),
        node("sec.a", "section"),
        node("uc.z", "useCase"),
        node("uc.a", "useCase"),
        node("feat.x", "feature"),
      ],
      [
        { type: "contains", from: "doc.srs", to: "sec.a" },
        { type: "partOf", from: "sec.a", to: "doc.srs" },
        { type: "listedIn", from: "feat.x", to: "sec.a" },
        { type: "satisfies", from: "feat.x", to: "uc.z" },
        { type: "satisfies", from: "feat.x", to: "uc.a" },
      ],
    );

    const result = computeImpact(g, "feat.x", "changed", SAMPLE_RULES);

    expect(result.origin).toEqual({
      id: "feat.x",
      type: "feature",
      change: "changed",
    });
    expect(result.affected.review.map((e) => e.id)).toEqual(["uc.a", "uc.z"]);
    expect(result.affected.regenerate).toEqual([]);
  });

  it("throws when the origin node is missing", () => {
    const g = loadGraph([], []);

    expect(() => computeImpact(g, "missing", "edit", SAMPLE_RULES)).toThrow(
      /Unknown node/,
    );
  });
});
