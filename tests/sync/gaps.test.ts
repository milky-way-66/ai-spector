import { describe, expect, it } from "vitest";
import { scanTraceabilityGaps } from "@/core/sync/gaps.js";
import { loadGraph, node } from "../helpers/graph.js";
import type { DesignLayer } from "@/core/sync/types.js";

function emptyLayerFiles(): Record<
  DesignLayer,
  Record<string, { hash: string; sizeBytes: number }>
> {
  return {
    srs: {},
    "basic-design": {},
    "detail-design": {},
  };
}

describe("scanTraceabilityGaps", () => {
  it("flags missingDownstream when feature has SRS + BD but no DD coverage", () => {
    const g = loadGraph(
      [
        node("feat.auth", "feature"),
        node("doc.srs", "document", { output: "docs/srs/en/features/F-03.md" }),
        node("sec.srs", "section", { documentId: "doc.srs" }),
        node("doc.bd", "document", { output: "docs/basic-design/en/api-list.md" }),
        node("sec.bd", "section", { documentId: "doc.bd" }),
      ],
      [
        { type: "partOf", from: "sec.srs", to: "doc.srs" },
        { type: "partOf", from: "sec.bd", to: "doc.bd" },
        { type: "listedIn", from: "feat.auth", to: "sec.srs" },
        { type: "listedIn", from: "feat.auth", to: "sec.bd" },
      ],
    );

    const gaps = scanTraceabilityGaps({ graph: g, layerFiles: emptyLayerFiles() });

    expect(gaps.missingDownstream).toEqual([
      {
        domainId: "feat.auth",
        layer: "detail-design",
        message: "feat.auth has SRS + basic-design coverage but no detail-design document",
      },
    ]);
    expect(gaps.missingUpstream).toEqual([]);
    expect(gaps.orphanFiles).toEqual([]);
  });

  it("does not flag missingDownstream when DD tracesTo chain exists", () => {
    const g = loadGraph(
      [
        node("feat.auth", "feature"),
        node("doc.srs", "document", { output: "docs/srs/en/features/F-03.md" }),
        node("sec.srs", "section", { documentId: "doc.srs" }),
        node("doc.bd", "document", { output: "docs/basic-design/en/api-list.md" }),
        node("sec.bd", "section", { documentId: "doc.bd" }),
        node("doc.dd", "document", { output: "docs/detail-design/en/features/f-03.md" }),
        node("sec.dd", "section", { documentId: "doc.dd" }),
      ],
      [
        { type: "partOf", from: "sec.srs", to: "doc.srs" },
        { type: "partOf", from: "sec.bd", to: "doc.bd" },
        { type: "partOf", from: "sec.dd", to: "doc.dd" },
        { type: "listedIn", from: "feat.auth", to: "sec.srs" },
        { type: "listedIn", from: "feat.auth", to: "sec.bd" },
        { type: "tracesTo", from: "sec.bd", to: "feat.auth" },
        { type: "tracesTo", from: "sec.dd", to: "sec.bd" },
      ],
    );

    const gaps = scanTraceabilityGaps({ graph: g, layerFiles: emptyLayerFiles() });

    expect(gaps.missingDownstream).toEqual([]);
  });

  it("reports orphanFiles for disk paths without graph document output", () => {
    const g = loadGraph(
      [node("doc.bd", "document", { output: "docs/basic-design/en/api-list.md" })],
      [],
    );

    const gaps = scanTraceabilityGaps({
      graph: g,
      layerFiles: {
        srs: {},
        "basic-design": {
          "docs/basic-design/en/api-list.md": { hash: "a", sizeBytes: 1 },
          "docs/basic-design/en/orphan.md": { hash: "b", sizeBytes: 2 },
        },
        "detail-design": {},
      },
    });

    expect(gaps.orphanFiles).toEqual(["docs/basic-design/en/orphan.md"]);
  });
});
