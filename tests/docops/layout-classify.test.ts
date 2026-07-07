import { describe, expect, it } from "vitest";
import { scoreBuiltinMatch, detectLanguageLayout, extractDomainIds } from "@/core/docops/layout-classify.js";

describe("scoreBuiltinMatch", () => {
  it("scores high when filename and H1 match builtin SRS intro", () => {
    const score = scoreBuiltinMatch(
      { relativePath: "1-introduction.md", headings: [{ depth: 1, text: "Introduction" }] },
      "srs",
    );
    expect(score).toBeGreaterThanOrEqual(0.8);
  });

  it("scores low for unrelated filenames", () => {
    const score = scoreBuiltinMatch(
      { relativePath: "random-notes.md", headings: [{ depth: 1, text: "Notes" }] },
      "srs",
    );
    expect(score).toBeLessThan(0.3);
  });
});

describe("detectLanguageLayout", () => {
  it("detects per-lang folders", () => {
    const result = detectLanguageLayout(["docs/srs/en/foo.md", "docs/srs/vi/foo.md"]);
    expect(result.detected).toEqual(expect.arrayContaining(["en", "vi"]));
    expect(result.strategy).toBe("per-lang-folders");
  });

  it("detects flat layout", () => {
    const result = detectLanguageLayout(["docs/srs/1-introduction.md"]);
    expect(result.strategy).toBe("flat");
  });
});

describe("extractDomainIds", () => {
  it("finds UC and F ids", () => {
    expect(extractDomainIds("See UC-01 and F-12 for traceability.")).toEqual(["UC-01", "F-12"]);
  });
});
