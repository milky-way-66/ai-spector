import { describe, expect, it } from "vitest";
import { computeImpact } from "../../src/core/graph/impact.js";
import type { ImpactRulesFile } from "../../src/core/graph/impact.js";
import { loadGraph, node } from "../helpers/graph.js";

const SAMPLE_RULES: ImpactRulesFile = {
  version: 2,
  pass1_expand: {
    listedIn: { direction: "in", depth: 1 },
    partOf:   { direction: "out", depth: "unbounded" },
  },
  pass2_downstream: {
    tracesTo: { direction: "in", depth: "unbounded" },
    partOf:   { direction: "out", depth: "unbounded" },
  },
  buckets: {
    regenerate: ["section", "document"],
    review: ["useCase", "feature"],
  },
};

describe("computeImpact", () => {
  it("throws when the origin node is missing", () => {
    const g = loadGraph([], []);
    expect(() => computeImpact(g, "missing", "edit", SAMPLE_RULES)).toThrow(/Unknown node/);
  });

  it("pass 1: finds domain nodes and parent sections/documents", () => {
    const g = loadGraph(
      [
        node("sec.a", "section"),
        node("doc.srs", "document"),
        node("uc.login", "useCase"),
        node("feat.auth", "feature"),
      ],
      [
        { type: "partOf",   from: "sec.a",     to: "doc.srs" },
        { type: "listedIn", from: "uc.login",  to: "sec.a" },
        { type: "listedIn", from: "feat.auth", to: "sec.a" },
      ],
    );

    const result = computeImpact(g, "sec.a", "changed", SAMPLE_RULES);

    expect(result.regenerate.map((e) => e.id)).toEqual(["doc.srs"]);
    expect(result.review.map((e) => e.id)).toEqual(["feat.auth", "uc.login"]);
  });

  it("pass 2: propagates downstream from domain nodes via tracesTo", () => {
    const g = loadGraph(
      [
        node("uc.login",  "useCase"),
        node("sec.bd.1",  "section"),
        node("doc.bd",    "document"),
        node("sec.dd.1",  "section"),
        node("doc.dd",    "document"),
      ],
      [
        { type: "tracesTo", from: "sec.bd.1", to: "uc.login" },
        { type: "partOf",   from: "sec.bd.1", to: "doc.bd" },
        { type: "tracesTo", from: "sec.dd.1", to: "sec.bd.1" },
        { type: "partOf",   from: "sec.dd.1", to: "doc.dd" },
      ],
    );

    const result = computeImpact(g, "uc.login", "changed", SAMPLE_RULES);

    const ids = result.regenerate.map((e) => e.id);
    expect(ids).toContain("sec.bd.1");
    expect(ids).toContain("doc.bd");
    expect(ids).toContain("sec.dd.1");
    expect(ids).toContain("doc.dd");
  });

  it("pass 3: collects rendersTo output paths from regenerate nodes", () => {
    const g = loadGraph(
      [
        node("doc.dd", "document"),
      ],
      [
        { type: "rendersTo", from: "doc.dd", to: "prototype/index.html" },
      ],
    );

    const rules: ImpactRulesFile = {
      version: 2,
      pass1_expand: { partOf: { direction: "out", depth: "unbounded" } },
      pass2_downstream: {},
      buckets: { regenerate: ["document"], review: [] },
    };

    // origin is the document itself — it's in regenerate via being the origin? No, origin is not added to regenerate.
    // Let's seed from a section that partOf doc.dd
    const g2 = loadGraph(
      [
        node("sec.1",  "section"),
        node("doc.dd", "document"),
      ],
      [
        { type: "partOf",    from: "sec.1",  to: "doc.dd" },
        { type: "rendersTo", from: "doc.dd", to: "prototype/index.html" },
      ],
    );

    const result = computeImpact(g2, "sec.1", "changed", rules);

    expect(result.regenerate.map((e) => e.id)).toContain("doc.dd");
    expect(result.affectedOutputPaths).toEqual(["prototype/index.html"]);
  });

  it("results are sorted by id", () => {
    const rules2: ImpactRulesFile = {
      version: 2,
      pass1_expand: { listedIn: { direction: "in", depth: 1 } },
      pass2_downstream: {},
      buckets: { regenerate: [], review: ["useCase"] },
    };

    const g2 = loadGraph(
      [
        node("sec.x", "section"),
        node("uc.z",  "useCase"),
        node("uc.a",  "useCase"),
        node("uc.m",  "useCase"),
      ],
      [
        { type: "listedIn", from: "uc.z", to: "sec.x" },
        { type: "listedIn", from: "uc.a", to: "sec.x" },
        { type: "listedIn", from: "uc.m", to: "sec.x" },
      ],
    );

    const result = computeImpact(g2, "sec.x", "changed", rules2);
    expect(result.review.map((e) => e.id)).toEqual(["uc.a", "uc.m", "uc.z"]);
  });

  it("pass 2: domain node → req (tracesTo) → section (listedIn) → doc (partOf)", () => {
    // Scenario: updating a useCase should surface the BD section whose requirement traces to it
    const g = loadGraph(
      [
        node("uc.login",  "useCase"),
        node("req.bd.1",  "requirement"),
        node("sec.bd.1",  "section"),
        node("doc.bd",    "document"),
      ],
      [
        { type: "tracesTo", from: "req.bd.1", to: "uc.login" },
        { type: "listedIn", from: "req.bd.1", to: "sec.bd.1" },
        { type: "partOf",   from: "sec.bd.1", to: "doc.bd" },
      ],
    );

    const rules: ImpactRulesFile = {
      version: 2,
      pass1_expand: {},
      pass2_downstream: {
        tracesTo:  { direction: "in",  depth: "unbounded" },
        listedIn:  { direction: "out", depth: "unbounded" },
        partOf:    { direction: "out", depth: "unbounded" },
      },
      buckets: {
        regenerate: ["section", "document"],
        review: ["useCase", "requirement"],
      },
    };

    const result = computeImpact(g, "uc.login", "changed", rules);

    const regenIds = result.regenerate.map((e) => e.id);
    expect(regenIds).toContain("sec.bd.1");
    expect(regenIds).toContain("doc.bd");
    // req.bd.1 is in review (domain node found via tracesTo)
    expect(result.review.map((e) => e.id)).toContain("req.bd.1");
  });
});
