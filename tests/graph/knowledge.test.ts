import { describe, expect, it } from "vitest";
import { DEFAULT_LISTED_IN } from "@/core/graph/defaults.js";
import {
  computeKnowledgeStats,
  isKnowledgePayload,
  knowledgeGraphCoverage,
  knowledgeHasDomainEntries,
  knowledgeToPatch,
} from "@/core/graph/knowledge.js";
import { loadGraph, node } from "../helpers/graph.js";

describe("knowledgeToPatch", () => {
  it("emits domain nodes and anchoring edges with default sections", () => {
    const patch = knowledgeToPatch({
      actors: [{ id: "actor.user", name: "User" }],
      features: [
        {
          id: "feat.login",
          title: "Login",
          satisfies: ["uc.auth"],
        },
      ],
    });

    expect(patch.nodes.map((n) => n.id).sort()).toEqual(["actor.user", "feat.login"]);
    expect(patch.edges).toContainEqual({
      type: "describedIn",
      from: "actor.user",
      to: DEFAULT_LISTED_IN.actor,
    });
    expect(patch.edges).toContainEqual({
      type: "listedIn",
      from: "feat.login",
      to: DEFAULT_LISTED_IN.feature,
    });
    expect(patch.edges).toContainEqual({
      type: "satisfies",
      from: "feat.login",
      to: "uc.auth",
    });
  });

  it("respects listedInSection overrides on knowledge items", () => {
    const section = "sec.custom";
    const patch = knowledgeToPatch({
      useCases: [
        { id: "uc.1", title: "Auth", listedInSection: section },
      ],
    });

    expect(patch.edges).toContainEqual({
      type: "listedIn",
      from: "uc.1",
      to: section,
    });
  });
});

describe("isKnowledgePayload", () => {
  it("detects knowledge-shaped objects", () => {
    expect(isKnowledgePayload({ knowledgeVersion: 1 })).toBe(true);
    expect(isKnowledgePayload({ useCases: [] })).toBe(true);
    expect(isKnowledgePayload({ version: 1, nodes: [], edges: [] })).toBe(false);
    expect(isKnowledgePayload(null)).toBe(false);
  });
});

describe("knowledgeHasDomainEntries", () => {
  it("returns true when any domain array is non-empty", () => {
    expect(knowledgeHasDomainEntries({ features: [{ id: "f", title: "F" }] })).toBe(
      true,
    );
    expect(knowledgeHasDomainEntries({})).toBe(false);
  });
});

describe("computeKnowledgeStats", () => {
  const sample = {
    knowledgeVersion: 1,
    actors: [{ id: "actor.guest", name: "Guest" }],
    useCases: [
      { id: "UC-01", title: "Checkout" },
      { id: "UC-02", title: "Browse" },
    ],
    features: [{ id: "F-01", title: "Pay", satisfies: ["UC-01"] }],
  };

  it("counts entries", () => {
    const stats = computeKnowledgeStats(sample);
    expect(stats.present).toBe(true);
    expect(stats.actors).toBe(1);
    expect(stats.useCases).toBe(2);
    expect(stats.features).toBe(1);
  });
});

describe("knowledgeGraphCoverage", () => {
  const sample = {
    knowledgeVersion: 1,
    actors: [{ id: "actor.guest", name: "Guest" }],
    useCases: [
      { id: "UC-01", title: "Checkout" },
      { id: "UC-02", title: "Browse" },
    ],
    features: [{ id: "F-01", title: "Pay", satisfies: ["UC-01"] }],
  };

  it("marks in-graph rows", () => {
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
