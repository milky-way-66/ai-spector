import { dirname, join, normalize } from "node:path";
import { readFile } from "node:fs/promises";
import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkGfm from "remark-gfm";
import remarkRehype from "remark-rehype";
import rehypeStringify from "rehype-stringify";
import type { CoursePage } from "./catalog.js";
import { coursePageUrl, DEFAULT_COURSE_LOCALE, type CourseLocale } from "./locale.js";

const mdProcessor = unified()
  .use(remarkParse)
  .use(remarkGfm)
  .use(remarkRehype)
  .use(rehypeStringify);

function slugFromHref(href: string, currentRelPath: string, locale: CourseLocale): string {
  const clean = href.split("#")[0];
  const hash = href.includes("#") ? `#${href.split("#").slice(1).join("#")}` : "";
  if (!clean) {
    return `${coursePageUrl(locale, "index")}${hash}`;
  }
  if (clean === "README.md") {
    const dir = dirname(currentRelPath);
    if (dir === ".") {
      return `${coursePageUrl(locale, "index")}${hash}`;
    }
    return `${coursePageUrl(locale, dir)}${hash}`;
  }
  if (clean.endsWith(".md")) {
    const resolved = normalize(join(dirname(currentRelPath), clean));
    const slug = resolved === "README.md"
      ? "index"
      : resolved.endsWith("/README.md")
        ? resolved.replace(/\/README\.md$/, "")
        : resolved.replace(/\.md$/, "");
    return `${coursePageUrl(locale, slug)}${hash}`;
  }
  return `${coursePageUrl(locale, clean)}${hash}`;
}

function rewriteMarkdownLinks(
  markdown: string,
  currentRelPath: string,
  locale: CourseLocale,
): string {
  return markdown.replace(/\]\(([^)]+)\)/g, (full, href: string) => {
    if (href.startsWith("http://") || href.startsWith("https://") || href.startsWith("#")) {
      return full;
    }
    if (href.startsWith("/course/")) {
      return full;
    }
    const url = slugFromHref(href, currentRelPath, locale);
    return `](${url})`;
  });
}

export async function renderCourseMarkdown(
  markdown: string,
  currentRelPath = "README.md",
  locale: CourseLocale = DEFAULT_COURSE_LOCALE,
): Promise<string> {
  const prepared = rewriteMarkdownLinks(markdown, currentRelPath, locale);
  const file = await mdProcessor.process(prepared);
  return String(file);
}

export async function loadPageHtml(
  courseRoot: string,
  page: CoursePage,
  locale: CourseLocale = DEFAULT_COURSE_LOCALE,
): Promise<string> {
  const markdown = await readFile(join(courseRoot, page.relPath), "utf8");
  return renderCourseMarkdown(markdown, page.relPath, locale);
}
