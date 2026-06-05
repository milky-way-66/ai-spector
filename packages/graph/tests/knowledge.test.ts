import { describe, expect, it } from "vitest";
import { InMemoryGraph } from "../src/InMemoryGraph.js";
import {
  computeKnowledgeStats,
  isKnowledgePayload,
  knowledgeGraphCoverage,
  knowledgeHasDomainEntries,
} from "../src/knowledge.js";
import { loadGraph, node } from "../../../tests/helpers/graph.js";

describe("knowledge", () => {
  const sample = {
    knowledgeVersion: 1,
    actors: [{ id: "actor.guest", name: "Guest" }],
    useCases: [
      { id: "UC-01", title: "Checkout" },
      { id: "UC-02", title: "Browse" },
    ],
    features: [{ id: "F-01", title: "Pay", satisfies: ["UC-01"] }],
  };

  it("isKnowledgePayload detects valid knowledge", () => {
    expect(isKnowledgePayload(sample)).toBe(true);
    expect(isKnowledgePayload({})).toBe(false);
    expect(isKnowledgePayload(null)).toBe(false);
  });

  it("computeKnowledgeStats counts entries", () => {
    const stats = computeKnowledgeStats(sample);
    expect(stats.present).toBe(true);
    expect(stats.actors).toBe(1);
    expect(stats.useCases).toBe(2);
    expect(stats.features).toBe(1);
  });

  it("knowledgeHasDomainEntries is false for empty", () => {
    expect(knowledgeHasDomainEntries({})).toBe(false);
    expect(knowledgeHasDomainEntries(sample)).toBe(true);
  });

  it("knowledgeGraphCoverage marks in-graph rows", () => {
    const g = loadGraph(
      [
        node("UC-01", "useCase", { title: "Checkout" }),
        node("F-01", "feature", { title: "Pay" }),
      ],
      [],
    );

    const report = knowledgeGraphCoverage(sample, g);
    expect(report.present).toBe(true);

    const ucCat = report.categories.find((c) => c.category === "useCase");
    expect(ucCat?.total).toBe(2);
    expect(ucCat?.inGraph).toBe(1);
    expect(ucCat?.rows.find((r) => r.id === "UC-01")?.inGraph).toBe(true);
    expect(ucCat?.rows.find((r) => r.id === "UC-02")?.inGraph).toBe(false);

    const actorCat = report.categories.find((c) => c.category === "actor");
    expect(actorCat?.rows[0]?.inGraph).toBe(false);
  });
});
