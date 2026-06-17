import { describe, expect, it } from "vitest";
import {
  coursePageUrl,
  normalizeCourseLocale,
  parseCourseRequest,
  SUPPORTED_COURSE_LOCALES,
} from "@/core/course/locale.js";

describe("parseCourseRequest", () => {
  it("parses /course/en/index", () => {
    expect(parseCourseRequest("/course/en/index")).toEqual({ locale: "en", slug: "index" });
  });

  it("parses /course/vi/06-review/01-document-review", () => {
    expect(parseCourseRequest("/course/vi/06-review/01-document-review")).toEqual({
      locale: "vi",
      slug: "06-review/01-document-review",
    });
  });

  it("defaults bare /course/index to en", () => {
    expect(parseCourseRequest("/course/index")).toEqual({ locale: "en", slug: "index" });
  });

  it("treats legacy slug without locale as en slug (redirect handled in serve)", () => {
    expect(parseCourseRequest("/course/04-generate/01-generate-srs")).toEqual({
      locale: "en",
      slug: "04-generate/01-generate-srs",
    });
  });
});

describe("coursePageUrl", () => {
  it("includes locale prefix", () => {
    expect(coursePageUrl("en", "05-generate/01-generate-srs")).toBe(
      "/course/en/05-generate/01-generate-srs",
    );
    expect(coursePageUrl("vi", "index")).toBe("/course/vi/index");
  });
});

describe("normalizeCourseLocale", () => {
  it("accepts en and vi", () => {
    expect(normalizeCourseLocale("vi")).toBe("vi");
    expect(normalizeCourseLocale("en")).toBe("en");
  });

  it("falls back to en for unknown", () => {
    expect(normalizeCourseLocale("fr")).toBe("en");
  });

  it("exports both locales", () => {
    expect(SUPPORTED_COURSE_LOCALES).toEqual(["en", "vi"]);
  });
});

describe("resolveCourseRoot", () => {
  it("resolves bundled en locale under website/docs/en", async () => {
    const { resolveCourseRoot } = await import("@/core/course/catalog.js");
    const root = await resolveCourseRoot(undefined, "en");
    expect(root).toMatch(/website\/docs\/en$/);
  });

  it("resolves bundled vi locale under website/docs/vi", async () => {
    const { resolveCourseRoot } = await import("@/core/course/catalog.js");
    const root = await resolveCourseRoot(undefined, "vi");
    expect(root).toMatch(/website\/docs\/vi$/);
  });
});
