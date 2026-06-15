import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { loadCoursePages, neighbors, pageBySlug, resolveCourseRoot } from "./catalog.js";
import { buildCoursePageHtml } from "./html-shell.js";
import {
  coursePageUrl,
  normalizeCourseLocale,
  parseCourseRequest,
  type CourseLocale,
} from "./locale.js";
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

async function handleRequest(
  req: IncomingMessage,
  res: ServerResponse,
  projectRoot?: string,
): Promise<void> {
  const url = new URL(req.url ?? "/", "http://localhost");
  const path = url.pathname;

  if (path === "/" || path === "/course" || path === "/course/") {
    res.writeHead(302, { Location: "/course/index" });
    res.end();
    return;
  }

  if (!path.startsWith("/course/")) {
    sendText(res, "Not found", 404);
    return;
  }

  const { locale, slug } = parseCourseRequest(path);
  const courseRoot = await resolveCourseRoot(projectRoot, locale);
  const pages = await loadCoursePages(courseRoot, locale);
  const page = pageBySlug(pages, slug);
  if (!page) {
    sendText(res, "Course page not found", 404);
    return;
  }

  const bodyHtml = await loadPageHtml(courseRoot, page, locale);
  const { prev, next } = neighbors(pages, slug);
  const html = buildCoursePageHtml({
    title: page.title,
    bodyHtml,
    pages,
    activeSlug: page.slug,
    activePage: page,
    prev,
    next,
    locale,
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
