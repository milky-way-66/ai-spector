import { describe, expect, it } from "vitest";
import {
  buildDocExtractPatch,
  extractDomainFromMarkdown,
  normalizeDomainId,
} from "../../src/graph/doc-extract.js";

describe("normalizeDomainId", () => {
  it("pads numeric suffixes", () => {
    expect(normalizeDomainId("UC-1")).toBe("UC-01");
    expect(normalizeDomainId("f-3")).toBe("F-03");
  });

  it("leaves template placeholders", () => {
    expect(normalizeDomainId("UC-XX")).toBe("UC-XX");
  });
});

describe("extractDomainFromMarkdown", () => {
  it("parses use case detail fields", () => {
    const content = `
**Use Case ID:** UC-3
**Use Case Name:** Checkout

**Priority:** High
`;
    const parsed = extractDomainFromMarkdown(content, "docs/srs/UC-03-checkout.md");
    expect(parsed.useCases.get("UC-03")?.title).toBe("Checkout");
  });

  it("parses feature table rows and satisfies links", () => {
    const content = `
| F-01 | Login | UC-01, UC-02 | High | Draft | [detail](f-01.md) |
`;
    const parsed = extractDomainFromMarkdown(
      content,
      "docs/srs/4-system-features-list.md",
    );
    expect(parsed.features.has("F-01")).toBe(true);
    expect(parsed.satisfies).toContainEqual({ from: "F-01", to: "UC-01" });
  });

  it("ignores template placeholder ids", () => {
    const content = "| UC-XX | TBD |";
    const parsed = extractDomainFromMarkdown(content, "docs/srs/3-use-cases.md");
    expect(parsed.useCases.size).toBe(0);
  });
});

describe("buildDocExtractPatch", () => {
  it("produces mergeable domain nodes and listedIn edges", () => {
    const { patch, stats } = buildDocExtractPatch([
      {
        relativePath: "docs/srs/3-use-cases.md",
        content: "| UC-01 | Place order | | High | Draft |",
      },
    ]);
    expect(stats.useCases).toBe(1);
    expect(patch.nodes.some((n) => n.id === "UC-01" && n.type === "useCase")).toBe(true);
    expect(patch.edges.some((e) => e.type === "listedIn" && e.from === "UC-01")).toBe(true);
  });
});
