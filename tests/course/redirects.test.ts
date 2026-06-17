import { describe, expect, it } from "vitest";
import { legacyCourseRedirect } from "@/core/course/redirects.js";

describe("legacyCourseRedirect", () => {
  it("redirects old generate SRS slug", () => {
    expect(legacyCourseRedirect("04-generate/01-generate-srs")).toBe(
      "/course/en/05-generate/01-generate-srs",
    );
  });

  it("redirects old chat basics slug", () => {
    expect(legacyCourseRedirect("02-chat-basics/01-how-chat-works")).toBe(
      "/course/en/03-chat-basics/01-how-chat-works",
    );
  });

  it("redirects unknown legacy slug to index with migrated query", () => {
    expect(legacyCourseRedirect("07-advanced/01-custom-templates")).toBe(
      "/course/en/index?migrated=1",
    );
  });

  it("returns undefined for locale-prefixed paths", () => {
    expect(legacyCourseRedirect("en/05-generate/01-generate-srs")).toBeUndefined();
  });
});
