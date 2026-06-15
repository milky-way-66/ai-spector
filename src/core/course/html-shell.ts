import type { CoursePage } from "./catalog.js";
import { SECTION_LABELS } from "./sections.js";

const STYLES = `
:root {
  color-scheme: light dark;
  --bg: #fafafa;
  --panel: #fff;
  --text: #1a1a1a;
  --muted: #666;
  --border: #e5e5e5;
  --accent: #2563eb;
  --accent-soft: #eff6ff;
  --code-bg: #f4f4f5;
  font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, sans-serif;
}
@media (prefers-color-scheme: dark) {
  :root {
    --bg: #0f1117;
    --panel: #171923;
    --text: #eef0f4;
    --muted: #9aa3b2;
    --border: #2a3142;
    --accent: #60a5fa;
    --accent-soft: #1e293b;
    --code-bg: #0b1220;
  }
}
* { box-sizing: border-box; }
body { margin: 0; background: var(--bg); color: var(--text); line-height: 1.55; }
.layout {
  display: grid;
  grid-template-columns: 280px minmax(0, 1fr);
  min-height: 100vh;
}
@media (max-width: 900px) {
  .layout { grid-template-columns: 1fr; }
  .sidebar { border-right: none; border-bottom: 1px solid var(--border); max-height: none; }
}
.sidebar {
  background: var(--panel);
  border-right: 1px solid var(--border);
  padding: 1.25rem 1rem 2rem;
  position: sticky;
  top: 0;
  align-self: start;
  max-height: 100vh;
  overflow: auto;
}
.brand { font-weight: 700; font-size: 1.05rem; margin: 0 0 .25rem; }
.brand-sub { color: var(--muted); font-size: .85rem; margin: 0 0 1rem; }
.nav-group { margin: 1rem 0 0; }
.nav-group h3 {
  font-size: .72rem;
  text-transform: uppercase;
  letter-spacing: .06em;
  color: var(--muted);
  margin: 0 0 .35rem;
}
.nav-group ul { list-style: none; margin: 0; padding: 0; }
.nav-group a {
  display: block;
  padding: .28rem .45rem;
  border-radius: .35rem;
  color: var(--text);
  text-decoration: none;
  font-size: .88rem;
}
.nav-group a.section-link { font-weight: 600; font-size: .82rem; margin-top: .15rem; }
.nav-group a:hover { background: var(--accent-soft); }
.nav-group a.active { background: var(--accent-soft); color: var(--accent); font-weight: 600; }
main { padding: 2rem clamp(1rem, 4vw, 3rem) 3rem; max-width: 46rem; }
.content :is(h1, h2, h3) { line-height: 1.25; }
.content h1 { font-size: 1.75rem; margin-top: 0; }
.content h2 { margin-top: 1.75rem; border-bottom: 1px solid var(--border); padding-bottom: .35rem; font-size: 1.15rem; }
.content a { color: var(--accent); }
.content code { background: var(--code-bg); padding: .12rem .35rem; border-radius: .25rem; font-size: .9em; }
.content pre { background: var(--code-bg); padding: 1rem; border-radius: .5rem; overflow: auto; }
.content pre code { background: none; padding: 0; }
.content table { width: 100%; border-collapse: collapse; font-size: .92rem; }
.content th, .content td { border: 1px solid var(--border); padding: .45rem .6rem; text-align: left; }
.content hr { border: none; border-top: 1px solid var(--border); margin: 1.5rem 0; }
.pager {
  display: flex;
  justify-content: space-between;
  gap: 1rem;
  margin-top: 2rem;
  padding-top: 1rem;
  border-top: 1px solid var(--border);
  font-size: .92rem;
}
.pager a { text-decoration: none; color: var(--accent); }
.pager span { color: var(--muted); display: block; font-size: .78rem; }
`;

export interface CourseShellOptions {
  title: string;
  bodyHtml: string;
  pages: CoursePage[];
  activeSlug: string;
  prev?: CoursePage;
  next?: CoursePage;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function shortTitle(title: string): string {
  return title
    .replace(/^Work \d+ — /, "")
    .replace(/^AI Spector — /, "")
    .replace(/^Section: /, "");
}

function navGroups(pages: CoursePage[]): Array<{ label: string; sectionId: string; items: CoursePage[] }> {
  const sectionIds = Object.keys(SECTION_LABELS);
  return sectionIds
    .map((sectionId) => {
      const sectionReadme = pages.find((p) => p.slug === sectionId);
      const lessons = pages.filter(
        (p) => p.sectionId === sectionId && !p.relPath.endsWith("/README.md"),
      );
      return {
        label: SECTION_LABELS[sectionId] ?? sectionId,
        sectionId,
        items: sectionReadme ? [sectionReadme, ...lessons] : lessons,
      };
    })
    .filter((g) => g.items.length > 0);
}

export function buildCoursePageHtml(opts: CourseShellOptions): string {
  const topLinks = [
    opts.pages.find((p) => p.slug === "index"),
    opts.pages.find((p) => p.slug === "00-overview"),
  ].filter(Boolean) as CoursePage[];

  const topNav = topLinks
    .map((p) => {
      const active = p.slug === opts.activeSlug ? " active" : "";
      return `<li><a class="${active.trim()}" href="/course/${p.slug}">${escapeHtml(shortTitle(p.title))}</a></li>`;
    })
    .join("");

  const sectionNav = navGroups(opts.pages)
    .map((group) => {
      const links = group.items
        .map((p) => {
          const active = p.slug === opts.activeSlug ? " active" : "";
          const isSection = p.relPath.endsWith("/README.md");
          const cls = `${active.trim()}${isSection ? " section-link" : ""}`.trim();
          const prefix = isSection ? "" : "· ";
          return `<li><a class="${cls}" href="/course/${p.slug}">${escapeHtml(prefix + shortTitle(p.title))}</a></li>`;
        })
        .join("");
      return `<div class="nav-group"><h3>${escapeHtml(group.label)}</h3><ul>${links}</ul></div>`;
    })
    .join("");

  const prevLink = opts.prev
    ? `<a href="/course/${opts.prev.slug}"><span>Previous</span>${escapeHtml(shortTitle(opts.prev.title))}</a>`
    : "<span></span>";
  const nextLink = opts.next
    ? `<a href="/course/${opts.next.slug}"><span>Next</span>${escapeHtml(shortTitle(opts.next.title))}</a>`
    : "<span></span>";

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(opts.title)} · AI Spector Course</title>
  <style>${STYLES}</style>
</head>
<body>
  <div class="layout">
    <aside class="sidebar">
      <p class="brand">AI Spector</p>
      <p class="brand-sub">Interactive course</p>
      <div class="nav-group"><ul>${topNav}</ul></div>
      ${sectionNav}
    </aside>
    <main>
      <article class="content">${opts.bodyHtml}</article>
      <nav class="pager">${prevLink}${nextLink}</nav>
    </main>
  </div>
</body>
</html>`;
}
