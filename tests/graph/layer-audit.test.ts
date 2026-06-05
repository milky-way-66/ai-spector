import { describe, expect, it } from "vitest";
import { auditGraphLayers } from "../../src/graph/layer-audit.js";
import { mergePatch } from "../../src/graph/merge.js";
import { buildSourceBundlePatch } from "../../src/graph/bundles.js";
import { loadGraph, node } from "../helpers/graph.js";

describe("auditGraphLayers", () => {
  it("suggests index when UC docs missing but use cases exist", async () => {
    const g = loadGraph([node("UC-01", "useCase")], []);
    const report = await auditGraphLayers(g);
    expect(report.layers.specInstances.ok).toBe(false);
    expect(report.suggestedCommand).toBe("npx ai-spector index");
  });

  it("suggests link-graph when derivedFrom but no relatesTo", async () => {
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
    const report = await auditGraphLayers(g);
    expect(report.layers.semanticLinks.domainsWithoutSemanticLinks).toContain("UC-03");
    expect(report.suggestedAgentCommand).toMatch(/link-graph/);
  });

  it("reports source hub when bundle present", async () => {
    const g = loadGraph([], []);
    mergePatch(g, buildSourceBundlePatch(["docs/data-source/a.md"]));
    const report = await auditGraphLayers(g);
    expect(report.layers.sourceHub.bundlePresent).toBe(true);
    expect(report.layers.sourceHub.sourceFiles).toBe(1);
  });
});
