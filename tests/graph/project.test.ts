import { describe, expect, it } from "vitest";
import { DEFAULT_IMPACT_RULES, ProjectSession } from "@/core/graph/index.js";
import { loadGraph, node } from "../helpers/graph.js";

describe("ProjectSession", () => {
  const graph = loadGraph(
    [node("UC-01", "useCase", { title: "Checkout" })],
    [],
  ).toTraceabilityGraph();

  const knowledge = {
    useCases: [
      { id: "UC-01", title: "Checkout" },
      { id: "UC-99", title: "Missing" },
    ],
  };

  const registry = {
    version: 1,
    root: "templates",
    documents: [
      {
        documentId: "doc.srs.en",
        template: "srs.md",
        sections: [{ id: "sec.anchor", heading: "3. Use cases", level: 1 }],
      },
    ],
  };

  it("fromBundle wires graph, knowledge, and registry", () => {
    const project = ProjectSession.fromBundle({
      graph,
      impactRules: DEFAULT_IMPACT_RULES,
      knowledge,
      registry,
    });

    expect(project.graph.stats().nodes).toBe(1);
    expect(project.knowledgeStats().useCases).toBe(2);
    expect(project.knowledgeCoverage().categories[0]?.inGraph).toBe(1);
    expect(project.sectionLabel("sec.anchor")).toBe("3. Use cases");
    expect(project.registryDocuments()).toHaveLength(1);
  });

  it("works with graph only", () => {
    const project = ProjectSession.fromBundle({ graph });
    expect(project.hasKnowledge()).toBe(false);
    expect(project.knowledgeCoverage().present).toBe(false);
    expect(project.sectionLabel("any")).toBeUndefined();
  });

  it("loads translation queue and links stale translations", () => {
    const project = ProjectSession.fromBundle({
      graph,
      impactRules: DEFAULT_IMPACT_RULES,
      translationQueue: {
        pending: {
          version: 1,
          jobs: [
            {
              id: "j1",
              docType: "srs",
              relativePath: "01-overview.md",
              direction: "outbound",
              origin: {
                lang: "en",
                path: "docs/srs/en/01-overview.md",
                hash: "h",
                changedAt: "2026-01-01",
              },
              targets: [{ lang: "jp", path: "docs/srs/jp/01-overview.md", status: "pending" }],
              changes: [],
              createdAt: "2026-01-01",
              updatedAt: "2026-01-01",
            },
          ],
        },
      },
    });
    expect(project.translationQueueStats().pending).toBe(1);
    const impact = project.graph.impactFromNode("UC-01");
    expect(Array.isArray(project.linkStaleTranslations(impact))).toBe(true);
    expect(project.healthSummary().structureErrors).toBeGreaterThanOrEqual(0);
  });
});
