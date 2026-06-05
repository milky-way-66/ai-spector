import { describe, expect, it } from "vitest";
import { auditGraphLayers } from "../src/layer-audit.js";
import { loadGraph, node } from "../../../tests/helpers/graph.js";

describe("auditGraphLayers", () => {
  it("suggests index when UC docs missing but use cases exist", () => {
    const g = loadGraph([node("UC-01", "useCase")], []);
    const report = auditGraphLayers(g);
    expect(report.layers.specInstances.ok).toBe(false);
    expect(report.suggestedCommand).toBe("npx ai-spector index");
  });

  it("suggests link-graph when derivedFrom but no relatesTo", () => {
    const g = loadGraph(
      [node("UC-03", "useCase"), node("sec.a", "section", { documentId: "doc.x" })],
      [{ type: "derivedFrom", from: "UC-03", to: "docs/data-source/r.md" }],
    );
    const report = auditGraphLayers(g);
    expect(report.layers.semanticLinks.domainsWithoutSemanticLinks).toContain("UC-03");
    expect(report.suggestedAgentCommand).toMatch(/link-graph/);
  });

  it("uses existingPaths for missingOnDisk", () => {
    const g = loadGraph(
      [
        node("UC-01", "useCase"),
        node("doc.uc-01", "document", {
          perDomain: "useCase",
          output: "docs/srs/en/03-use-cases/uc-01-checkout.md",
        }),
      ],
      [],
    );
    const report = auditGraphLayers(g, {
      existingPaths: new Set([
        "docs/srs/en/03-use-cases/uc-01-checkout.md",
        "docs/srs/en/03-use-cases/uc-99-orphan.md",
      ]),
    });
    expect(report.layers.specInstances.missingOnDisk).toContain(
      "docs/srs/en/03-use-cases/uc-99-orphan.md",
    );
  });
});
