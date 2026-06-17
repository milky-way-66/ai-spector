import { describe, expect, it } from "vitest";
import { resolvePageWithFallback } from "@/core/course/fallback.js";
import type { CoursePage } from "@/core/course/catalog.js";

const samplePage: CoursePage = {
  slug: "01-welcome/01-what-is-ai-spector",
  relPath: "01-welcome/01-what-is-ai-spector.md",
  order: 101,
  title: "Welcome",
};

describe("resolvePageWithFallback", () => {
  it("returns vi page when found", () => {
    const result = resolvePageWithFallback(
      "vi",
      "01-welcome/01-what-is-ai-spector",
      [samplePage],
      [samplePage],
    );
    expect(result.fallback).toBe(false);
    expect(result.page?.slug).toBe("01-welcome/01-what-is-ai-spector");
  });

  it("falls back to en when vi page missing", () => {
    const result = resolvePageWithFallback(
      "vi",
      "01-welcome/01-what-is-ai-spector",
      [],
      [samplePage],
    );
    expect(result.fallback).toBe(true);
    expect(result.page?.slug).toBe("01-welcome/01-what-is-ai-spector");
    expect(result.bodyLocale).toBe("en");
  });
});
