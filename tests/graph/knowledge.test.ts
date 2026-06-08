import { describe, expect, it } from "vitest";
import { DEFAULT_LISTED_IN } from "../../src/core/graph/defaults.js";
import {
  isKnowledgePayload,
  knowledgeHasDomainEntries,
  knowledgeToPatch,
} from "../../src/core/graph/knowledge.js";

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
