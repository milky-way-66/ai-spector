import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { loadCoursePages, neighbors, resolveCourseRoot } from "./catalog.js";
import { resolvePageWithFallback } from "./fallback.js";
import { buildCoursePageHtml } from "./html-shell.js";
import {
  coursePageUrl,
  normalizeCourseLocale,
  parseCourseRequest,
  type CourseLocale,
} from "./locale.js";
import { isLegacyCoursePath, legacyCourseRedirect } from "./redirects.js";
import { loadPageHtml } from "./render.js";

export interface CourseServeOptions {
  projectRoot?: string;
  host?: string;
  port?: number;
  open?: boolean;
}

export interface CourseServeResult {
  url: string;
  host: string;
  port: number;
  courseRoot: string;
  pageCount: number;
  locale: CourseLocale;
}

function sendHtml(res: ServerResponse, html: string, status = 200): void {
  res.writeHead(status, { "Content-Type": "text/html; charset=utf-8" });
  res.end(html);
}

function sendText(res: ServerResponse, body: string, status = 200): void {
  res.writeHead(status, { "Content-Type": "text/plain; charset=utf-8" });
  res.end(body);
}

function pathAfterCourse(pathname: string): string {
  return pathname.replace(/^\/course\/?/, "").replace(/\/$/, "");
}

async function handleRequest(
  req: IncomingMessage,
  res: ServerResponse,
  projectRoot?: string,
): Promise<void> {
  const url = new URL(req.url ?? "/", "http://localhost");
  const path = url.pathname;

  if (path === "/" || path === "/course" || path === "/course/" || path === "/course/index") {
    res.writeHead(302, { Location: "/course/en/index" });
    res.end();
    return;
  }

  if (!path.startsWith("/course/")) {
    sendText(res, "Not found", 404);
    return;
  }

  const afterCourse = pathAfterCourse(path);
  if (isLegacyCoursePath(afterCourse)) {
    const target = legacyCourseRedirect(afterCourse);
    if (target) {
      res.writeHead(302, { Location: target });
      res.end();
      return;
    }
  }

  const { locale, slug } = parseCourseRequest(path);
  const courseRoot = await resolveCourseRoot(projectRoot, locale);
  const pages = await loadCoursePages(courseRoot, locale);

  let enPages = pages;
  if (locale === "vi") {
    const enRoot = await resolveCourseRoot(projectRoot, "en");
    enPages = await loadCoursePages(enRoot, "en");
  }

  const resolved = resolvePageWithFallback(locale, slug, pages, enPages);
  const page = resolved.page;
  if (!page) {
    sendText(res, "Course page not found", 404);
    return;
  }

  const bodyRoot =
    resolved.fallback && locale === "vi"
      ? await resolveCourseRoot(projectRoot, "en")
      : courseRoot;

  const bodyHtml = await loadPageHtml(bodyRoot, page, resolved.bodyLocale);
  const { prev, next } = neighbors(pages, slug);
  const html = buildCoursePageHtml({
    title: page.title,
    bodyHtml,
    pages,
    activeSlug: slug,
    activePage: page,
    prev,
    next,
    locale,
    localeFallback: resolved.fallback,
  });
  sendHtml(res, html);
}

export async function runCourseServe(opts: CourseServeOptions = {}): Promise<CourseServeResult> {
  const host = opts.host ?? "127.0.0.1";
  const port = opts.port ?? 4177;
  const locale = normalizeCourseLocale();
  const courseRoot = await resolveCourseRoot(opts.projectRoot, locale);
  const pages = await loadCoursePages(courseRoot, locale);

  const server = createServer((req, res) => {
    handleRequest(req, res, opts.projectRoot).catch((err) => {
      sendText(res, err instanceof Error ? err.message : String(err), 500);
    });
  });

  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, host, () => resolve());
  });

  const url = `http://${host}:${port}${coursePageUrl(locale, "index")}`;
  if (opts.open) {
    const { openInBrowser } = await import("../util/open-browser.js");
    await openInBrowser(url);
  }

  return { url, host, port, courseRoot, pageCount: pages.length, locale };
}

export function formatCourseServeStarted(result: CourseServeResult): string {
  return [
    "AI Spector course server running",
    `  ${result.url}`,
    `  Pages: ${result.pageCount} (from ${result.courseRoot})`,
    "",
    "Press Ctrl+C to stop.",
  ].join("\n");
}
