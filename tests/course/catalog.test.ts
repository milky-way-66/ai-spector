import { describe, expect, it, vi } from "vitest";
import * as configLoad from "@/core/config/load.js";
import {
  CourseNotFoundError,
  formatCourseNotFoundMessage,
  loadCoursePages,
  neighbors,
  pageBySlug,
  resolveCourseRoot,
} from "@/core/course/catalog.js";
import { renderCourseMarkdown } from "@/core/course/render.js";
import { buildCoursePageHtml } from "@/core/course/html-shell.js";

describe("course catalog", () => {
  it("resolves bundled course from website/docs", () => {
    const root = configLoad.courseBundleRoot();
    expect(root).toMatch(/website\/docs$/);
  });

  it("throws a clear error when course files are missing", async () => {
    const missingBundled = "/tmp/ai-spector-course-bundle-missing";
    const missingProject = "/tmp/ai-spector-course-project-missing";
    vi.spyOn(configLoad, "courseBundleRoot").mockReturnValue(missingBundled);
    await expect(resolveCourseRoot(missingProject, "en")).rejects.toBeInstanceOf(CourseNotFoundError);
    await expect(resolveCourseRoot(missingProject, "en")).rejects.toThrow(/Course files not found/);
    const msg = formatCourseNotFoundMessage("en", [
      `${missingProject}/docs/course`,
      missingBundled,
    ]);
    expect(msg).toContain("Checked:");
    expect(msg).toContain("npm install ai-spector");
    vi.restoreAllMocks();
  });

  it("loads composed lessons (13 + section READMEs)", async () => {
    const pages = await loadCoursePages(configLoad.courseBundleRoot());
    const lessons = pages.filter((p) => /\/\d{2}-.+\.md$/.test(p.relPath));
    expect(lessons.length).toBe(13);
    expect(pages.some((p) => p.slug === "04-generate/01-generate-srs")).toBe(true);
    expect(pages.some((p) => p.slug === "06-review/01-review-comments-changes")).toBe(true);
  });

  it("resolves neighbors across sections", async () => {
    const pages = await loadCoursePages(configLoad.courseBundleRoot());
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

  it("rewrites links for Vietnamese locale", async () => {
    const html = await renderCourseMarkdown(
      "See [SRS](../04-generate/01-generate-srs.md).",
      "03-graph/02-validate-index-explore.md",
      "vi",
    );
    expect(html).toContain('href="/course/vi/04-generate/01-generate-srs"');
  });

  it("builds section-grouped shell", async () => {
    const pages = await loadCoursePages(configLoad.courseBundleRoot());
    const page = pageBySlug(pages, "02-chat-basics/01-how-chat-works");
    const html = buildCoursePageHtml({
      title: page!.title,
      bodyHtml: "<p>Hello</p>",
      pages,
      activeSlug: page!.slug,
      activePage: page,
    });
    expect(html).toContain("Chat basics");
    expect(html).toContain("Lesson 3 of 13");
    expect(html).toContain("Try in chat");
    expect(html).toContain("On this page");
  });
});

describe("course locale", () => {
  it("loads Vietnamese lessons", async () => {
    const viRoot = `${configLoad.courseBundleRoot()}/vi`;
    const pages = await loadCoursePages(viRoot, "vi");
    const lessons = pages.filter((p) => /\/\d{2}-.+\.md$/.test(p.relPath));
    expect(lessons.length).toBe(13);
    expect(pages.some((p) => p.slug === "02-chat-basics/01-how-chat-works")).toBe(true);
  });

  it("builds Vietnamese shell with language switcher", async () => {
    const viRoot = `${configLoad.courseBundleRoot()}/vi`;
    const pages = await loadCoursePages(viRoot, "vi");
    const page = pageBySlug(pages, "01-get-started/01-prerequisites-and-init");
    const html = buildCoursePageHtml({
      title: page!.title,
      bodyHtml: "<p>Xin chào</p>",
      pages,
      activeSlug: page!.slug,
      activePage: page,
      locale: "vi",
    });
    expect(html).toContain('lang="vi"');
    expect(html).toContain("Bài 1 / 13");
    expect(html).toContain("/course/vi/");
    expect(html).toContain("Tiếng Việt");
  });
});
