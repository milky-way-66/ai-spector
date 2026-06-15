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
import { renderCourseMarkdown, transformMermaidBlocks } from "@/core/course/render.js";
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

  it("loads composed lessons (15 + section READMEs)", async () => {
    const pages = await loadCoursePages(configLoad.courseBundleRoot());
    const lessons = pages.filter((p) => /\/\d{2}-.+\.md$/.test(p.relPath));
    expect(lessons.length).toBe(15);
    expect(pages.some((p) => p.slug === "04-generate/01-generate-srs")).toBe(true);
    expect(pages.some((p) => p.slug === "06-review/01-document-review")).toBe(true);
    expect(pages.some((p) => p.slug === "02-chat-basics/03-incremental-changes")).toBe(true);
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

  it("renders mermaid fences for client-side diagrams", async () => {
    const md = "```mermaid\nflowchart LR\n  A --> B\n```";
    const html = await renderCourseMarkdown(md);
    expect(html).toContain('class="mermaid-diagram"');
    expect(html).toContain('<pre class="mermaid">');
    expect(html).toContain("flowchart LR");
    expect(html).toContain("A --> B");
  });

  it("transformMermaidBlocks decodes HTML entities in diagrams", () => {
    const html = transformMermaidBlocks(
      '<pre><code class="language-mermaid">flowchart LR\n  A --&gt; B</code></pre>',
    );
    expect(html).toContain("A --> B");
  });

  it("includes mermaid.js in course shell", async () => {
    const pages = await loadCoursePages(configLoad.courseBundleRoot());
    const page = pageBySlug(pages, "01-get-started");
    const body = await renderCourseMarkdown(
      "```mermaid\nflowchart LR\n  A --> B\n```",
      page!.relPath,
    );
    const html = buildCoursePageHtml({
      title: page!.title,
      bodyHtml: body,
      pages,
      activeSlug: page!.slug,
      activePage: page,
    });
    expect(html).toContain("mermaid.min.js");
    expect(html).toContain("mermaid.initialize");
  });

  it("builds section-grouped shell", async () => {
    const pages = await loadCoursePages(configLoad.courseBundleRoot());
    const page = pageBySlug(pages, "02-chat-basics/01-how-chat-works");
    const html = buildCoursePageHtml({
      title: page!.title,
      bodyHtml: "<h2>Section</h2><p>Hello</p>",
      pages,
      activeSlug: page!.slug,
      activePage: page,
    });
    expect(html).toContain("Chat basics");
    expect(html).toContain("Lesson 3 of 15");
    expect(html).toContain("Try in chat");
    expect(html).toContain("has-toc");
  });
});
