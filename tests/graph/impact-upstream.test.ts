import { describe, expect, it } from "vitest";
import { computeImpact, DEFAULT_IMPACT_RULES } from "@/core/graph/impact.js";
import { loadGraph, node } from "../helpers/graph.js";

describe("computeImpact upstream", () => {
  it("populates syncUpstream when direction is both", () => {
    const g = loadGraph(
      [
        node("doc.bd", "document", { projectionPath: "docs/basic-design/en/api-list.md" }),
        node("sec.f", "section"),
        node("feat.auth", "feature"),
        node("doc.srs.f", "document", { projectionPath: "docs/srs/en/features/F-03.md" }),
      ],
      [
        { type: "partOf", from: "sec.f", to: "doc.bd" },
        { type: "listedIn", from: "feat.auth", to: "sec.f" },
        { type: "tracesTo", from: "doc.srs.f", to: "feat.auth" },
      ],
    );

    const result = computeImpact(g, "sec.f", "changed", DEFAULT_IMPACT_RULES, "both");

    expect(result.syncUpstream?.map((e) => e.id)).toContain("feat.auth");
    expect(result.regenerate.length + result.review.length).toBeGreaterThan(0);
  });
});
