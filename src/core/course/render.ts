import { dirname, join, normalize } from "node:path";
import { readFile } from "node:fs/promises";
import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkGfm from "remark-gfm";
import remarkRehype from "remark-rehype";
import rehypeStringify from "rehype-stringify";
import type { CoursePage } from "./catalog.js";

const mdProcessor = unified()
  .use(remarkParse)
  .use(remarkGfm)
  .use(remarkRehype)
  .use(rehypeStringify);

function slugFromHref(href: string, currentRelPath: string): string {
  const clean = href.split("#")[0];
  const hash = href.includes("#") ? `#${href.split("#").slice(1).join("#")}` : "";
  if (!clean) {
    return `/course/index${hash}`;
  }
  if (clean === "README.md") {
    const dir = dirname(currentRelPath);
    if (dir === ".") {
      return `/course/index${hash}`;
    }
    return `/course/${dir}${hash}`;
  }
  if (clean.endsWith(".md")) {
    const resolved = normalize(join(dirname(currentRelPath), clean));
    const slug = resolved === "README.md"
      ? "index"
      : resolved.endsWith("/README.md")
        ? resolved.replace(/\/README\.md$/, "")
        : resolved.replace(/\.md$/, "");
    return `/course/${slug}${hash}`;
  }
  return `/course/${clean}${hash}`;
}

function rewriteMarkdownLinks(markdown: string, currentRelPath: string): string {
  return markdown.replace(/\]\(([^)]+)\)/g, (full, href: string) => {
    if (href.startsWith("http://") || href.startsWith("https://") || href.startsWith("#")) {
      return full;
    }
    if (href.startsWith("/course/")) {
      return full;
    }
    const url = slugFromHref(href, currentRelPath);
    return `](${url})`;
  });
}

export async function renderCourseMarkdown(
  markdown: string,
  currentRelPath = "README.md",
): Promise<string> {
  const prepared = rewriteMarkdownLinks(markdown, currentRelPath);
  const file = await mdProcessor.process(prepared);
  return String(file);
}

export async function loadPageHtml(
  courseRoot: string,
  page: CoursePage,
): Promise<string> {
  const markdown = await readFile(join(courseRoot, page.relPath), "utf8");
  return renderCourseMarkdown(markdown, page.relPath);
}
