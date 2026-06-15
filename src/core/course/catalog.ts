import { readdir } from "node:fs/promises";
import { join, relative } from "node:path";
import { pathExists } from "../util/fs.js";
import { courseBundleRoot } from "../config/load.js";
import { sectionIdFromRelPath, sectionLabel } from "./sections.js";

export interface CoursePage {
  /** URL slug, e.g. "01-get-started/01-prerequisites" */
  slug: string;
  /** Path relative to course root */
  relPath: string;
  order: number;
  title: string;
  sectionId?: string;
  sectionTitle?: string;
}

const LESSON_FILE = /^\d{2}-.+\.md$/;
const SECTION_DIR = /^\d{2}-.+/;

async function collectMarkdownFiles(
  dir: string,
  base = dir,
  inSection = false,
): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  const files: string[] = [];
  for (const ent of entries) {
    const abs = join(dir, ent.name);
    if (ent.isDirectory()) {
      if (SECTION_DIR.test(ent.name)) {
        files.push(...(await collectMarkdownFiles(abs, base, true)));
      }
      continue;
    }
    if (!ent.name.endsWith(".md")) {
      continue;
    }
    if (inSection) {
      if (ent.name === "README.md" || LESSON_FILE.test(ent.name)) {
        files.push(relative(base, abs));
      }
      continue;
    }
    if (ent.name === "README.md" || ent.name === "00-overview.md") {
      files.push(relative(base, abs));
    }
  }
  return files;
}

function slugFromRelPath(relPath: string): string {
  if (relPath === "README.md") {
    return "index";
  }
  if (relPath === "00-overview.md") {
    return "00-overview";
  }
  if (relPath.endsWith("/README.md")) {
    return relPath.replace(/\/README\.md$/, "");
  }
  return relPath.replace(/\.md$/, "");
}

function orderFromRelPath(relPath: string): number {
  if (relPath === "README.md") {
    return -2;
  }
  if (relPath === "00-overview.md") {
    return -1;
  }
  const parts = relPath.split("/");
  const sectionMatch = /^(\d{2})-/.exec(parts[0] ?? "");
  const section = sectionMatch ? Number(sectionMatch[1]) : 99;
  if (parts.length === 2 && parts[1] === "README.md") {
    return section * 100;
  }
  const lessonMatch = /^(\d{2})-/.exec(parts[1] ?? "");
  const lesson = lessonMatch ? Number(lessonMatch[1]) : 50;
  return section * 100 + lesson;
}

function titleFromMarkdown(markdown: string, fallback: string): string {
  const line = markdown.split("\n").find((l) => l.startsWith("# "));
  if (!line) {
    return fallback;
  }
  return line.slice(2).trim();
}

/** Prefer project-local course copy when present; otherwise bundled docs. */
export async function resolveCourseRoot(projectRoot?: string): Promise<string> {
  if (projectRoot) {
    const local = join(projectRoot, "docs", "course");
    if (await pathExists(local)) {
      return local;
    }
  }
  return courseBundleRoot();
}

export async function loadCoursePages(courseRoot: string): Promise<CoursePage[]> {
  const relPaths = await collectMarkdownFiles(courseRoot);
  const pages: CoursePage[] = [];

  for (const relPath of relPaths) {
    const filePath = join(courseRoot, relPath);
    const { readFile } = await import("node:fs/promises");
    const markdown = await readFile(filePath, "utf8");
    const slug = slugFromRelPath(relPath);
    const sectionId = sectionIdFromRelPath(relPath);
    pages.push({
      slug,
      relPath,
      order: orderFromRelPath(relPath),
      title: titleFromMarkdown(markdown, slug),
      sectionId,
      sectionTitle: sectionId ? sectionLabel(sectionId) : undefined,
    });
  }

  return pages.sort((a, b) => a.order - b.order);
}

export function pageBySlug(pages: CoursePage[], slug: string): CoursePage | undefined {
  const normalized = slug === "" || slug === "/" ? "index" : slug.replace(/\/$/, "");
  return pages.find((p) => p.slug === normalized);
}

export function neighbors(
  pages: CoursePage[],
  slug: string,
): { prev?: CoursePage; next?: CoursePage; current?: CoursePage } {
  const navPages = pages.filter((p) => p.slug !== "00-overview");
  const current = pageBySlug(pages, slug);
  if (!current) {
    return {};
  }
  const idx = navPages.findIndex((p) => p.slug === current.slug);
  return {
    current,
    prev: idx > 0 ? navPages[idx - 1] : undefined,
    next: idx >= 0 && idx < navPages.length - 1 ? navPages[idx + 1] : undefined,
  };
}
