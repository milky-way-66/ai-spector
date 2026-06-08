import { describe, expect, it } from "vitest";
import { headingSlug, sectionIdFromHeading } from "../../src/core/registry/slug.js";

describe("headingSlug", () => {
  it("lowercases, strips punctuation, and hyphenates words", () => {
    expect(headingSlug("  User Classes & Roles!  ")).toBe("user-classes-roles");
  });

  it("truncates long headings to 80 characters", () => {
    const long = "A".repeat(100);
    expect(headingSlug(long).length).toBe(80);
  });
});

describe("sectionIdFromHeading", () => {
  it("builds stable section ids from document id, level, and order", () => {
    expect(
      sectionIdFromHeading("doc.srs", "Introduction", 2, 1),
    ).toBe("sec.srs.l2.1.introduction");
  });

  it("strips doc. prefix from the document key", () => {
    expect(sectionIdFromHeading("doc.basic", "Scope", 3, 2)).toBe(
      "sec.basic.l3.2.scope",
    );
  });
});
