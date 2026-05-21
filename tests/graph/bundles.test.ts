import { describe, expect, it } from "vitest";
import {
  BUNDLE_BUSINESS_ID,
  BUNDLE_SOURCE_ID,
  buildBusinessBundlePatch,
  buildSourceBundlePatch,
  ensureBusinessBundle,
  provenanceTargetId,
  sourceFileNodeId,
} from "../../src/graph/bundles.js";
import { loadGraph, node } from "../helpers/graph.js";

describe("bundles", () => {
  it("sourceFileNodeId uses stable prefix", () => {
    expect(sourceFileNodeId("docs/data-source/a.md")).toBe(
      "source.file:docs/data-source/a.md",
    );
  });

  it("provenanceTargetId prefers source file node when known", () => {
    const path = "docs/data-source/r.md";
    const id = sourceFileNodeId(path);
    expect(provenanceTargetId(path, new Set([id]))).toBe(id);
    expect(provenanceTargetId(path, new Set())).toBe(path);
  });

  it("buildSourceBundlePatch creates bundle and file nodes", () => {
    const patch = buildSourceBundlePatch(["docs/data-source/x.md"]);
    expect(patch.nodes.some((n) => n.id === BUNDLE_SOURCE_ID)).toBe(true);
    expect(patch.nodes.some((n) => n.type === "sourceFile")).toBe(true);
    expect(
      patch.edges.some(
        (e) =>
          e.type === "contains" &&
          e.from === BUNDLE_SOURCE_ID &&
          e.to === sourceFileNodeId("docs/data-source/x.md"),
      ),
    ).toBe(true);
  });

  it("ensureBusinessBundle contains domain nodes", () => {
    const g = loadGraph(
      [node("UC-01", "useCase"), node("F-01", "feature")],
      [],
    );
    const { domainMembers } = ensureBusinessBundle(g);
    expect(domainMembers).toBe(2);
    expect(g.hasEdge({ type: "contains", from: BUNDLE_BUSINESS_ID, to: "UC-01" })).toBe(
      true,
    );
  });
});
