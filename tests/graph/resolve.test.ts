import { describe, expect, it } from "vitest";
import {
  findDocumentNodeIdForPath,
  findSectionNodeIdsByHeading,
  parseGitDiffRegions,
  pickPrimaryImpactOrigin,
  prioritizeGitDiffRegions,
  resolveFromGitDiff,
  resolveImpactOrigins,
} from "../../src/graph/resolve.js";
import { loadGraph, node } from "../helpers/graph.js";

describe("findDocumentNodeIdForPath", () => {
  it("matches document output path", () => {
    const g = loadGraph(
      [
        node("doc.srs.3", "document", { output: "docs/srs/3-use-cases.md" }),
        node("doc.srs.4", "document", { outputPattern: "docs/srs/uc-*.md" }),
      ],
      [],
    );
    expect(findDocumentNodeIdForPath(g, "docs/srs/3-use-cases.md")).toBe("doc.srs.3");
    expect(findDocumentNodeIdForPath(g, "docs/srs/uc-01.md")).toBe("doc.srs.4");
  });
});

describe("findSectionNodeIdsByHeading", () => {
  it("matches heading within optional file scope", () => {
    const g = loadGraph(
      [
        node("doc.a", "document", { output: "docs/a.md" }),
        node("sec.a", "section", {
          documentId: "doc.a",
          heading: "### 3.2 List Use Case",
        }),
        node("doc.b", "document", { output: "docs/b.md" }),
        node("sec.b", "section", {
          documentId: "doc.b",
          heading: "### 3.2 Other",
        }),
      ],
      [],
    );
    expect(findSectionNodeIdsByHeading(g, "List Use Case", "docs/a.md")).toEqual([
      "sec.a",
    ]);
    expect(findSectionNodeIdsByHeading(g, "3.2")).toHaveLength(2);
  });
});

describe("resolveImpactOrigins", () => {
  it("resolves UC id from text and prefers section over document", () => {
    const g = loadGraph(
      [
        node("doc.uc", "document", { output: "docs/srs/uc-01.md" }),
        node("sec.flow", "section", {
          documentId: "doc.uc",
          heading: "### 2. Main Flow",
        }),
        node("UC-01", "useCase", { title: "Place order" }),
      ],
      [
        { type: "partOf", from: "sec.flow", to: "doc.uc" },
        { type: "listedIn", from: "UC-01", to: "sec.flow" },
      ],
    );

    const origins = resolveImpactOrigins(g, {
      text: "UC-01",
      file: "docs/srs/uc-01.md",
      heading: "Main Flow",
    });

    expect(origins.map((o) => o.id)).toContain("UC-01");
    expect(origins.map((o) => o.id)).toContain("sec.flow");
    const primary = pickPrimaryImpactOrigin(origins);
    expect(primary?.id).toBe("sec.flow");
  });
});

const SAMPLE_DIFF = `diff --git a/docs/srs/3-use-cases.md b/docs/srs/3-use-cases.md
index 111..222 100644
--- a/docs/srs/3-use-cases.md
+++ b/docs/srs/3-use-cases.md
@@ -10,6 +10,7 @@
 <!-- section:sec.srs.3.l3.3.32-list-use-case -->
 ### 3.2 List Use Case
+Added acceptance line
 - existing bullet
diff --git a/README.md b/README.md
--- a/README.md
+++ b/README.md
@@ -1 +1,2 @@
+# readme tweak
`;

describe("parseGitDiffRegions", () => {
  it("extracts file paths, section anchors, and headings; prioritizes docs/", () => {
    const regions = parseGitDiffRegions(SAMPLE_DIFF);
    expect(regions.map((r) => r.file)).toContain("docs/srs/3-use-cases.md");
    expect(regions.some((r) => r.sectionAnchor === "sec.srs.3.l3.3.32-list-use-case")).toBe(
      true,
    );
    expect(regions.some((r) => r.heading === "3.2 List Use Case")).toBe(true);
    expect(regions[0].file.startsWith("docs/")).toBe(true);
  });

  it("dedupes regions via prioritizeGitDiffRegions", () => {
    const duped = [
      { file: "docs/a.md", heading: "H" },
      { file: "docs/a.md", heading: "H" },
    ];
    expect(prioritizeGitDiffRegions(duped)).toHaveLength(1);
  });
});

describe("resolveFromGitDiff", () => {
  it("maps diff hunks to document and section nodes", () => {
    const g = loadGraph(
      [
        node("doc.srs.3", "document", { output: "docs/srs/3-use-cases.md" }),
        node("sec.list", "section", {
          documentId: "doc.srs.3",
          heading: "### 3.2 List Use Case",
        }),
      ],
      [{ type: "partOf", from: "sec.list", to: "doc.srs.3" }],
    );

    const origins = resolveFromGitDiff(g, SAMPLE_DIFF);
    expect(origins.map((o) => o.id)).toContain("doc.srs.3");
    expect(origins.map((o) => o.id)).toContain("sec.list");
    expect(pickPrimaryImpactOrigin(origins)?.id).toBe("sec.list");
  });
});
