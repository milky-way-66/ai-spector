import { describe, expect, it } from "vitest";
import { extractSourceRefsFromMarkdown } from "@/core/graph/source-refs.js";
import { normalizeDataSourcePath } from "@/core/graph/provenance.js";

describe("extractSourceRefsFromMarkdown", () => {
  it("finds inline docs/data-source paths", () => {
    const refs = extractSourceRefsFromMarkdown(
      "Based on `docs/data-source/interviews/uc01.md` and notes.",
    );
    expect(refs).toContain("docs/data-source/interviews/uc01.md");
  });

  it("parses Source: lines", () => {
    const refs = extractSourceRefsFromMarkdown(
      "**Source:** docs/data-source/specs/auth.ts, interviews/pm.md",
    );
    expect(refs.some((r) => r.includes("auth.ts"))).toBe(true);
  });
});

describe("normalizeDataSourcePath", () => {
  it("prefixes relative paths with data-source root", () => {
    expect(normalizeDataSourcePath("interviews/a.md", "docs/data-source")).toBe(
      "docs/data-source/interviews/a.md",
    );
  });

  it("keeps fully qualified paths", () => {
    expect(
      normalizeDataSourcePath("docs/data-source/foo.ts", "docs/data-source"),
    ).toBe("docs/data-source/foo.ts");
  });
});
