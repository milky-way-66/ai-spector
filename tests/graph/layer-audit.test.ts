import { describe, expect, it } from "vitest";
import { auditGraphLayers } from "@/core/graph/layer-audit.js";
import { mergePatch } from "@/core/graph/merge.js";
import { buildSourceBundlePatch } from "@/core/graph/bundles.js";
import { loadGraph, node } from "../helpers/graph.js";

describe("auditGraphLayers", () => {
  it("suggests index when UC docs missing but use cases exist", () => {
    const g = loadGraph([node("UC-01", "useCase")], []);
    const report = auditGraphLayers(g);
    expect(report.layers.specInstances.ok).toBe(false);
    expect(report.suggestedCommand).toBe("npx ai-spector index");
  });

  it("suggests link-graph when derivedFrom but no relatesTo", () => {
    const g = loadGraph(
      [
        node("UC-03", "useCase"),
        node("sec.a", "section", { documentId: "doc.x" }),
      ],
      [
        {
          type: "derivedFrom",
          from: "UC-03",
          to: "docs/data-source/r.md",
        },
      ],
    );
    const report = auditGraphLayers(g);
    expect(report.layers.semanticLinks.domainsWithoutSemanticLinks).toContain("UC-03");
    expect(report.suggestedAgentCommand).toMatch(/link-graph/);
  });

  it("reports source hub when bundle present", () => {
    const g = loadGraph([], []);
    mergePatch(g, buildSourceBundlePatch(["docs/data-source/a.md"]));
    const report = auditGraphLayers(g);
    expect(report.layers.sourceHub.bundlePresent).toBe(true);
    expect(report.layers.sourceHub.sourceFiles).toBe(1);
  });
});
