import { describe, expect, it } from "vitest";
import {
  buildDocIndex,
  computeIndexSourceHash,
  findDocumentNodeIdForPath,
  globToRegExp,
  indexHasPlaceholderContent,
} from "../../src/index/docs-build.js";
import type { IndexDocsConfig } from "../../src/index/docs-config.js";
import type { TraceabilityGraph } from "../../src/types.js";

const config: IndexDocsConfig = {
  version: 1,
  outputs: {
    srs: ".ai-spector/index/srs.md",
    basicDesign: ".ai-spector/index/basic-design.md",
  },
  sources: {
    srs: { root: "docs/srs", glob: "**/*.md" },
    basicDesign: { root: "docs/basic-design", glob: "**/*.md" },
  },
};

describe("globToRegExp", () => {
  it("matches paths relative to source root", () => {
    const re = globToRegExp("**/*.md");
    expect(re.test("foo.md")).toBe(true);
    expect(re.test("a/b.md")).toBe(true);
    expect(re.test("a/b.txt")).toBe(false);
  });
});

describe("findDocumentNodeIdForPath", () => {
  const graph: TraceabilityGraph = {
    version: 1,
    nodes: [
      { id: "doc.srs", type: "document", output: "docs/srs/overview.md" },
      { id: "doc.bd", type: "document", outputPattern: "docs/basic-design/**/*.md" },
    ],
    edges: [],
  };

  it("matches exact output path", () => {
    expect(findDocumentNodeIdForPath(graph, "docs/srs/overview.md")).toBe("doc.srs");
  });

  it("matches outputPattern glob", () => {
    expect(findDocumentNodeIdForPath(graph, "docs/basic-design/api/auth.md")).toBe(
      "doc.bd",
    );
  });
});

describe("buildDocIndex", () => {
  it("writes file entries without placeholder markers when files exist", async () => {
    const built = await buildDocIndex({
      kind: "srs",
      config,
      projectRoot: "/proj",
      files: [
        {
          relativePath: "docs/srs/a.md",
          absolutePath: "/proj/docs/srs/a.md",
          basename: "a.md",
          sizeBytes: 10,
          contentHash: "abc",
        },
      ],
      graph: null,
      indexedAt: "2026-05-21T00:00:00.000Z",
    });

    expect(built.markdown).toContain("## File: a.md");
    expect(built.markdown).toContain("- location: docs/srs/a.md");
    expect(indexHasPlaceholderContent(built.markdown)).toBe(false);
  });
});

describe("computeIndexSourceHash", () => {
  it("changes when file list changes", () => {
    const a = computeIndexSourceHash([
      {
        relativePath: "docs/srs/a.md",
        absolutePath: "",
        basename: "a.md",
        sizeBytes: 1,
        contentHash: "1",
      },
    ]);
    const b = computeIndexSourceHash([
      {
        relativePath: "docs/srs/a.md",
        absolutePath: "",
        basename: "a.md",
        sizeBytes: 1,
        contentHash: "2",
      },
    ]);
    expect(a).not.toBe(b);
  });
});
