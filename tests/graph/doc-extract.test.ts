import { describe, expect, it } from "vitest";
import {
  buildDocExtractPatch,
  classifySrsDetailFile,
  detailFileToPatch,
  documentIdForDomainDetail,
  extractDomainFromMarkdown,
  normalizeDomainId,
} from "../../src/graph/doc-extract.js";
import { parseDetailSections } from "../../src/graph/detail-sections.js";

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

describe("classifySrsDetailFile", () => {
  it("detects per-domain paths and skips list chapters", () => {
    expect(classifySrsDetailFile("docs/srs/3-use-cases.md")).toBeNull();
    expect(classifySrsDetailFile("docs/srs/4-system-features.md")).toBeNull();
    expect(classifySrsDetailFile("docs/srs/03-use-cases/uc-01-place-order.md")).toBe(
      "useCaseDetail",
    );
    expect(
      classifySrsDetailFile("docs/srs/04-system-features/f-02-checkout.md"),
    ).toBe("featureDetail");
  });
});

describe("parseDetailSections", () => {
  it("creates stable section ids from headings", () => {
    const docId = documentIdForDomainDetail("useCaseDetail", "UC-01");
    const sections = parseDetailSections(
      `**Use Case ID:** UC-1

### 1. Use Case Overview

**Use Case Name:** Order

### 2. Main Success Scenario (Basic Flow)

Step 1
`,
      docId,
    );
    expect(sections.length).toBe(2);
    expect(sections[0]!.heading).toContain("Use Case Overview");
    expect(sections[0]!.id).toMatch(/^sec\.srs\.uc-UC-01\.l3\./);
    expect(sections[1]!.heading).toContain("Main Success Scenario");
  });

  it("honors explicit section anchors", () => {
    const docId = documentIdForDomainDetail("useCaseDetail", "UC-02");
    const sections = parseDetailSections(
      `<!-- section:sec.uc02.main-flow -->
### 2. Main Success Scenario (Basic Flow)
`,
      docId,
    );
    expect(sections[0]!.id).toBe("sec.uc02.main-flow");
  });
});

describe("detailFileToPatch", () => {
  it("links UC domain node to detail sections and file path", () => {
    const patch = detailFileToPatch(
      "docs/srs/03-use-cases/uc-03-checkout.md",
      `**Use Case ID:** UC-3
**Use Case Name:** Checkout

### 1. Use Case Overview

### 2. Main Success Scenario (Basic Flow)
`,
    );
    const docId = documentIdForDomainDetail("useCaseDetail", "UC-03");
    expect(patch.nodes).toContainEqual(
      expect.objectContaining({
        id: docId,
        type: "document",
        output: "docs/srs/03-use-cases/uc-03-checkout.md",
        perDomain: "useCase",
      }),
    );
    const sectionNodes = patch.nodes.filter((n) => n.type === "section");
    expect(sectionNodes.length).toBeGreaterThanOrEqual(2);
    for (const sec of sectionNodes) {
      expect(patch.edges).toContainEqual({
        type: "definedIn",
        from: "UC-03",
        to: sec.id,
      });
      expect(patch.edges).toContainEqual({
        type: "partOf",
        from: sec.id,
        to: docId,
      });
    }
    expect(patch.edges).not.toContainEqual({
      type: "definedIn",
      from: "UC-03",
      to: docId,
    });
    expect(patch.edges).toContainEqual({
      type: "rendersTo",
      from: "UC-03",
      to: "docs/srs/03-use-cases/uc-03-checkout.md",
    });
  });

  it("links feature domain node to detail sections", () => {
    const patch = detailFileToPatch(
      "docs/srs/04-system-features/f-01-login.md",
      `**Feature ID:** F-1

### 1. Description

### 2. Stimulus/Response Sequences
`,
    );
    const docId = documentIdForDomainDetail("featureDetail", "F-01");
    expect(patch.nodes.some((n) => n.id === docId)).toBe(true);
    const sectionIds = patch.nodes.filter((n) => n.type === "section").map((n) => n.id);
    expect(sectionIds.length).toBeGreaterThanOrEqual(2);
    expect(
      patch.edges.some(
        (e) => e.type === "definedIn" && e.from === "F-01" && sectionIds.includes(e.to),
      ),
    ).toBe(true);
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

  it("merges detail document nodes from UC and feature detail files", () => {
    const { patch, stats } = buildDocExtractPatch([
      {
        relativePath: "docs/srs/03-use-cases/uc-01-order.md",
        content:
          "**Use Case ID:** UC-1\n**Use Case Name:** Order\n\n### 1. Use Case Overview\n",
      },
      {
        relativePath: "docs/srs/04-system-features/f-01-auth.md",
        content: "**Feature ID:** F-1\n### 1. Description",
      },
    ]);
    expect(stats.detailDocuments).toBe(2);
    expect(
      patch.nodes.some(
        (n) => n.id === "doc.srs.uc-UC-01" && n.output === "docs/srs/03-use-cases/uc-01-order.md",
      ),
    ).toBe(true);
    expect(
      patch.edges.some(
        (e) =>
          e.type === "definedIn" &&
          e.from === "UC-01" &&
          e.to.startsWith("sec.srs.uc-UC-01."),
      ),
    ).toBe(true);
    expect(
      patch.edges.some(
        (e) =>
          e.type === "rendersTo" &&
          e.from === "F-01" &&
          e.to === "docs/srs/04-system-features/f-01-auth.md",
      ),
    ).toBe(true);
  });
});
