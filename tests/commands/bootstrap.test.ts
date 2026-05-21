import { describe, expect, it } from "vitest";
import { bootstrapFromRegistry } from "../../src/commands/bootstrap.js";
import type { SectionRegistry } from "../../src/types.js";

function minimalRegistry(): SectionRegistry {
  return {
    version: 1,
    root: "/proj",
    documents: [
      {
        documentId: "doc.srs",
        template: "srs.md",
        output: "docs/srs.md",
        sections: [
          { id: "sec.srs.l2.1.intro", heading: "Introduction", level: 2, order: 1 },
          {
            id: "sec.srs.l3.2.scope",
            heading: "Scope",
            level: 3,
            order: 2,
          },
        ],
      },
    ],
  };
}

describe("bootstrapFromRegistry", () => {
  it("creates document and section nodes with partOf/contains/follows edges", () => {
    const g = bootstrapFromRegistry(minimalRegistry());

    expect(g.nodesById.has("doc.srs")).toBe(true);
    expect(g.nodesById.get("doc.srs")?.output).toBe("docs/srs.md");
    expect(g.hasEdge({ type: "contains", from: "doc.srs", to: "sec.srs.l2.1.intro" })).toBe(
      true,
    );
    expect(
      g.hasEdge({ type: "partOf", from: "sec.srs.l3.2.scope", to: "sec.srs.l2.1.intro" }),
    ).toBe(true);
    expect(
      g.hasEdge({ type: "follows", from: "sec.srs.l2.1.intro", to: "sec.srs.l3.2.scope" }),
    ).toBe(false);
  });

  it("links level-2 sections directly to the document", () => {
    const g = bootstrapFromRegistry(minimalRegistry());

    expect(
      g.hasEdge({ type: "partOf", from: "sec.srs.l2.1.intro", to: "doc.srs" }),
    ).toBe(true);
  });
});
