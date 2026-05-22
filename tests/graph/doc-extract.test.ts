import { describe, expect, it } from "vitest";
import {
  buildDocExtractPatch,
  classifyBasicDesignDetailFile,
  classifySrsDetailFile,
  detailFileToPatch,
  documentIdForBasicDesignDetail,
  documentIdForDomainDetail,
  extractBasicDesignDetailMeta,
  extractDetailDomainMeta,
  extractDomainFromMarkdown,
  normalizeDomainId,
} from "../../src/graph/doc-extract.js";
import {
  basicDesignListChapterFileToPatch,
  parseDetailSections,
  snippetAfterHeading,
} from "../../src/graph/detail-sections.js";

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

describe("extractDetailDomainMeta", () => {
  it("reads title and brief description from use case detail", () => {
    const meta = extractDetailDomainMeta(
      `**Use Case ID:** UC-01
**Use Case Name:** Assessment cycle

### 1. Use Case Overview

**Brief Description:**

> HR admin issues invitations; employee completes the full assessment path.

**Priority:** High
`,
      "useCaseDetail",
    );
    expect(meta?.title).toBe("Assessment cycle");
    expect(meta?.description).toContain("HR admin");
    expect(meta?.priority).toBe("High");
  });
});

describe("snippetAfterHeading", () => {
  it("extracts prose after a section heading", () => {
    const snippet = snippetAfterHeading(
      `### 1. Use Case Overview

The employee completes each assessment step in order.

**Actor(s):**
`,
      "1. Use Case Overview",
    );
    expect(snippet).toContain("assessment step");
  });
});

describe("detailFileToPatch", () => {
  it("links UC domain node to detail sections and file path", () => {
    const patch = detailFileToPatch(
      "docs/srs/03-use-cases/uc-03-checkout.md",
      `**Use Case ID:** UC-3
**Use Case Name:** Checkout

### 1. Use Case Overview

**Brief Description:**

> Customer completes checkout with saved payment method.

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
        title: "Checkout",
        description: expect.stringContaining("checkout"),
      }),
    );
    expect(patch.nodes).toContainEqual(
      expect.objectContaining({
        id: "UC-03",
        type: "useCase",
        title: "Checkout",
        description: expect.stringContaining("checkout"),
      }),
    );
    const sectionNodes = patch.nodes.filter((n) => n.type === "section");
    expect(sectionNodes.length).toBeGreaterThanOrEqual(2);
    const overview = sectionNodes.find((n) =>
      String(n.heading).includes("Use Case Overview"),
    );
    expect(overview?.title).toBe(overview?.heading);
    for (const sec of sectionNodes) {
      expect(patch.edges).toContainEqual({
        type: "definedIn",
        from: "UC-03",
        to: sec.id,
      });
      expect(patch.edges).toContainEqual({
        type: "describedIn",
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
    expect(patch.edges).toContainEqual({
      type: "contains",
      from: "sec.srs.3-use-cases.l3.3.32-list-use-case",
      to: docId,
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

describe("basicDesignListChapterFileToPatch", () => {
  it("parses sections for api-list.md under doc.bd.list-api", () => {
    const patch = basicDesignListChapterFileToPatch(
      "docs/basic-design/api-list.md",
      `# API List: Demo

## 1. API Overview

**Base URL:** https://example.com
`,
    );
    expect(patch.nodes.some((n) => n.type === "section")).toBe(true);
    expect(patch.edges).toContainEqual({
      type: "contains",
      from: "doc.bd.list-api",
      to: expect.any(String),
    });
  });
});

describe("classifyBasicDesignDetailFile", () => {
  it("detects API and screen detail paths and skips list chapters", () => {
    expect(classifyBasicDesignDetailFile("docs/basic-design/api-list.md")).toBeNull();
    expect(
      classifyBasicDesignDetailFile("docs/basic-design/list-screens.md"),
    ).toBeNull();
    expect(
      classifyBasicDesignDetailFile("docs/basic-design/screens/list-screens.md"),
    ).toBeNull();
    expect(
      classifyBasicDesignDetailFile("docs/basic-design/api/post-checkout.md"),
    ).toBe("apiDetail");
    expect(
      classifyBasicDesignDetailFile("docs/basic-design/screens/dashboard.md"),
    ).toBe("screenDetail");
  });
});

describe("extractBasicDesignDetailMeta", () => {
  it("derives API title from endpoint heading", () => {
    const meta = extractBasicDesignDetailMeta(
      `### 1.1 \`POST /checkout\`

**Source Requirement:** SRS Section 4.2 - F-02 Checkout
`,
      "apiDetail",
      "docs/basic-design/api/post-checkout.md",
    );
    expect(meta.title).toBe("POST /checkout");
    expect(meta.featureIds).toContain("F-02");
  });
});

describe("basic design detailFileToPatch", () => {
  it("links API detail document to list chapter and related features", () => {
    const path = "docs/basic-design/api/post-checkout.md";
    const patch = detailFileToPatch(
      path,
      `## 1. Detailed Endpoint Specifications

### 1.1 \`POST /checkout\`

**Summary:** Submit checkout

**Source Requirement:** SRS Section 4.2 - F-02 Checkout
`,
    );
    const docId = documentIdForBasicDesignDetail("apiDetail", path);
    expect(patch.nodes).toContainEqual(
      expect.objectContaining({
        id: docId,
        type: "document",
        output: path,
        perDomain: "apiDetail",
        title: "POST /checkout",
      }),
    );
    expect(patch.edges).toContainEqual({
      type: "contains",
      from: "doc.bd.list-api",
      to: docId,
    });
    expect(patch.edges).toContainEqual({
      type: "tracesTo",
      from: "F-02",
      to: docId,
    });
    expect(
      patch.edges.some((e) => e.type === "definedIn" && e.from === "F-02"),
    ).toBe(false);
    expect(patch.nodes.filter((n) => n.type === "section").length).toBeGreaterThanOrEqual(1);
  });

  it("links screen detail from screen heading and list chapter", () => {
    const path = "docs/basic-design/screens/dashboard.md";
    const patch = detailFileToPatch(
      path,
      `## 1. Screen: Dashboard

**Purpose:**

> Main dashboard for managers.
`,
    );
    const docId = documentIdForBasicDesignDetail("screenDetail", path);
    expect(patch.nodes).toContainEqual(
      expect.objectContaining({
        id: docId,
        title: "Dashboard",
      }),
    );
    expect(patch.edges).toContainEqual({
      type: "contains",
      from: "doc.bd.list-screen",
      to: docId,
    });
    expect(
      patch.edges.some((e) => e.type === "definedIn"),
    ).toBe(false);
  });
});

describe("buildDocExtractPatch", () => {
  it("produces mergeable domain nodes and listedIn edges", async () => {
    const { patch, stats } = await buildDocExtractPatch([
      {
        relativePath: "docs/srs/3-use-cases.md",
        content: "| UC-01 | Place order | | High | Draft |",
      },
    ]);
    expect(stats.useCases).toBe(1);
    expect(patch.nodes.some((n) => n.id === "UC-01" && n.type === "useCase")).toBe(true);
    expect(patch.edges.some((e) => e.type === "listedIn" && e.from === "UC-01")).toBe(true);
  });

  it("merges detail document nodes from UC and feature detail files", async () => {
    const { patch, stats } = await buildDocExtractPatch([
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

  it("emits list-chapter sections for doc.bd.* when projectRoot is set", async () => {
    const { mkdtemp, mkdir, writeFile } = await import("node:fs/promises");
    const { join } = await import("node:path");
    const { tmpdir } = await import("node:os");
    const root = await mkdtemp(join(tmpdir(), "bd-extract-"));
    await mkdir(join(root, ".ai-spector"), { recursive: true });
    await writeFile(
      join(root, ".ai-spector/docflow.config.json"),
      `${JSON.stringify({
        version: 1,
        paths: {
          graph: ".ai-spector/graph/traceability.graph.json",
          registry: ".ai-spector/registry/section-registry.json",
          templates: ".ai-spector/templates",
        },
      })}\n`,
    );

    const { patch } = await buildDocExtractPatch(
      [
        {
          relativePath: "docs/basic-design/api-list.md",
          content: "# API List\n\n## 1. Custom Overview\n",
        },
      ],
      root,
    );

    expect(
      patch.edges.some(
        (e) => e.type === "contains" && e.from === "doc.bd.list-api",
      ),
    ).toBe(true);
    expect(patch.nodes.filter((n) => n.type === "section" && n.documentId === "doc.bd.list-api").length).toBeGreaterThan(0);
  });

  it("merges basic-design detail documents alongside SRS", async () => {
    const { patch, stats } = await buildDocExtractPatch([
      {
        relativePath: "docs/basic-design/api/get-session.md",
        content: "### 1.1 `GET /session`\n\n**Source Requirement:** F-01",
      },
      {
        relativePath: "docs/basic-design/screens/login.md",
        content: "## 1. Screen: Login\n\n**Purpose:**\n\n> Login page",
      },
    ]);
    expect(stats.bdDetailDocuments).toBe(2);
    expect(patch.nodes.some((n) => n.id === "doc.bd.api-get-session")).toBe(true);
    expect(patch.nodes.some((n) => n.id === "doc.bd.screen-login")).toBe(true);
  });
});
