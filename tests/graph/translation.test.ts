import { describe, expect, it } from "vitest";
import { InMemoryGraph } from "../../src/graph/InMemoryGraph.js";
import {
  buildTranslationDocNode,
  primaryDocumentNodes,
  translationOutputForLang,
  wireTranslationDocNode,
} from "../../src/graph/translation.js";
import type { GraphNode } from "../../src/types.js";

function docNode(id: string, extra: Record<string, unknown> = {}): GraphNode {
  return { id, type: "document", ...extra };
}

describe("translationOutputForLang", () => {
  it("maps SRS and basic-design output paths", () => {
    expect(
      translationOutputForLang(docNode("doc", { output: "docs/srs/1-introduction.md" }), "vi"),
    ).toBe("docs/srs/vi/1-introduction.md");
    expect(
      translationOutputForLang(
        docNode("doc", { output: "docs/srs/03-use-cases/UC-01-foo.md" }),
        "vi",
      ),
    ).toBe("docs/srs/vi/03-use-cases/UC-01-foo.md");
    expect(
      translationOutputForLang(
        docNode("doc", { output: "docs/basic-design/list-screens.md" }),
        "vi",
      ),
    ).toBe("docs/basic-design/vi/list-screens.md");
  });

  it("maps outputPattern for per-domain templates", () => {
    expect(
      translationOutputForLang(
        docNode("doc", { outputPattern: "docs/srs/03-use-cases/uc-{nn}-{slug}.md" }),
        "vi",
      ),
    ).toBe("docs/srs/vi/03-use-cases/uc-{nn}-{slug}.md");
  });
});

describe("wireTranslationDocNode", () => {
  it("creates full translation node with metadata and contains edges", () => {
    const g = InMemoryGraph.from({
      version: 1,
      nodes: [
        docNode("doc.srs.1-introduction", {
          template: "1-introduction.md",
          output: "docs/srs/1-introduction.md",
        }),
        { id: "sec.srs.1-introduction.l2.1", type: "section" },
      ],
      edges: [
        { type: "contains", from: "doc.srs.1-introduction", to: "sec.srs.1-introduction.l2.1" },
      ],
    });

    wireTranslationDocNode(g, g.nodesById.get("doc.srs.1-introduction")!, {
      code: "vi",
      label: "Vietnamese",
    });

    const translated = g.nodesById.get("doc:vi:doc.srs.1-introduction");
    expect(translated).toMatchObject({
      id: "doc:vi:doc.srs.1-introduction",
      type: "document",
      lang: "vi",
      label: "Vietnamese",
      template: "1-introduction.md",
      output: "docs/srs/vi/1-introduction.md",
    });
    expect(
      g.hasEdge({
        type: "translationOf",
        from: "doc:vi:doc.srs.1-introduction",
        to: "doc.srs.1-introduction",
      }),
    ).toBe(true);
    expect(
      g.hasEdge({
        type: "contains",
        from: "doc:vi:doc.srs.1-introduction",
        to: "sec.srs.1-introduction.l2.1",
      }),
    ).toBe(true);

    const issues = g.validateStructure().filter((i) => i.ruleId === "DOC-SECTION-COVERAGE");
    expect(issues).toHaveLength(0);
  });

  it("refreshes stub nodes on re-index", () => {
    const g = InMemoryGraph.from({
      version: 1,
      nodes: [
        docNode("doc.srs.1-introduction", {
          template: "1-introduction.md",
          output: "docs/srs/1-introduction.md",
        }),
        docNode("doc:vi:doc.srs.1-introduction", { lang: "vi", label: "Vietnamese" }),
        { id: "sec.srs.1-introduction.l2.1", type: "section" },
      ],
      edges: [
        { type: "contains", from: "doc.srs.1-introduction", to: "sec.srs.1-introduction.l2.1" },
        {
          type: "translationOf",
          from: "doc:vi:doc.srs.1-introduction",
          to: "doc.srs.1-introduction",
        },
      ],
    });

    const outcome = wireTranslationDocNode(g, g.nodesById.get("doc.srs.1-introduction")!, {
      code: "vi",
      label: "Vietnamese",
    });

    expect(outcome).toBe("updated");
    expect(g.nodesById.get("doc:vi:doc.srs.1-introduction")?.output).toBe(
      "docs/srs/vi/1-introduction.md",
    );
    expect(
      g.hasEdge({
        type: "contains",
        from: "doc:vi:doc.srs.1-introduction",
        to: "sec.srs.1-introduction.l2.1",
      }),
    ).toBe(true);
  });

  it("copies outputPattern and perDomain for template documents", () => {
    const primary = docNode("doc.srs.uc-detail", {
      template: "uc-detail.md",
      outputPattern: "docs/srs/03-use-cases/uc-{nn}-{slug}.md",
      perDomain: "useCase",
    });
    const built = buildTranslationDocNode(primary, { code: "vi", label: "Vietnamese" });
    expect(built).toMatchObject({
      outputPattern: "docs/srs/vi/03-use-cases/uc-{nn}-{slug}.md",
      perDomain: "useCase",
    });
    expect(built.output).toBeUndefined();
  });
});

describe("primaryDocumentNodes", () => {
  it("excludes translation-prefixed document nodes", () => {
    const g = InMemoryGraph.from({
      version: 1,
      nodes: [
        docNode("doc.srs.1-introduction"),
        docNode("doc:vi:doc.srs.1-introduction", { lang: "vi" }),
        docNode("doc:jp:doc.srs.1-introduction", { lang: "jp" }),
      ],
      edges: [],
    });

    const primaries = primaryDocumentNodes(g, ["en", "vi", "jp"]);
    expect(primaries.map((n) => n.id)).toEqual(["doc.srs.1-introduction"]);
  });
});
