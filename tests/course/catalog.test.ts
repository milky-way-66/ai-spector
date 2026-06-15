import { describe, expect, it } from "vitest";
import { courseBundleRoot } from "@/core/config/load.js";
import { loadCoursePages, neighbors, pageBySlug } from "@/core/course/catalog.js";
import { renderCourseMarkdown } from "@/core/course/render.js";
import { buildCoursePageHtml } from "@/core/course/html-shell.js";

describe("course catalog", () => {
  it("loads composed lessons (13 + section READMEs)", async () => {
    const pages = await loadCoursePages(courseBundleRoot());
    const lessons = pages.filter((p) => /\/\d{2}-.+\.md$/.test(p.relPath));
    expect(lessons.length).toBe(13);
    expect(pages.some((p) => p.slug === "04-generate/01-generate-srs")).toBe(true);
    expect(pages.some((p) => p.slug === "06-review/01-review-comments-changes")).toBe(true);
  });

  it("resolves neighbors across sections", async () => {
    const pages = await loadCoursePages(courseBundleRoot());
    const { next } = neighbors(pages, "01-get-started/02-setup-and-skills");
    expect(next?.slug).toBe("02-chat-basics");
  });
});

describe("course render", () => {
  it("rewrites relative links across sections", async () => {
    const html = await renderCourseMarkdown(
      "See [Generate SRS](../04-generate/01-generate-srs.md).",
      "03-graph/02-validate-index-explore.md",
    );
    expect(html).toContain('href="/course/04-generate/01-generate-srs"');
  });

  it("builds section-grouped shell", async () => {
    const pages = await loadCoursePages(courseBundleRoot());
    const page = pageBySlug(pages, "02-chat-basics/01-how-chat-works");
    const html = buildCoursePageHtml({
      title: page!.title,
      bodyHtml: "<p>Hello</p>",
      pages,
      activeSlug: page!.slug,
    });
    expect(html).toContain("Chat basics");
  });
});
