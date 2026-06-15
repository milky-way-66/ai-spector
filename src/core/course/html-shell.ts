import type { CoursePage } from "./catalog.js";
import {
  chatHintForSection,
  coursePageUrl,
  courseUi,
  sectionLabelForLocale,
  type CourseLocale,
} from "./locale.js";

const STYLES = `
:root {
  color-scheme: light dark;
  --bg: #f4f6fb;
  --panel: #fff;
  --text: #111827;
  --muted: #6b7280;
  --border: #e5e7eb;
  --accent: #2563eb;
  --accent-hover: #1d4ed8;
  --accent-soft: #eff6ff;
  --accent-border: #bfdbfe;
  --code-bg: #f3f4f6;
  --shadow: 0 1px 3px rgba(0,0,0,.06), 0 4px 16px rgba(0,0,0,.04);
  --radius: .65rem;
  --sidebar-w: 300px;
  font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, sans-serif;
}
@media (prefers-color-scheme: dark) {
  :root {
    --bg: #0b0f19;
    --panel: #141a27;
    --text: #f3f4f6;
    --muted: #9ca3af;
    --border: #2a3142;
    --accent: #60a5fa;
    --accent-hover: #93c5fd;
    --accent-soft: #172554;
    --accent-border: #1e3a5f;
    --code-bg: #0f1520;
    --shadow: 0 1px 3px rgba(0,0,0,.3), 0 4px 16px rgba(0,0,0,.2);
  }
}
* { box-sizing: border-box; }
body { margin: 0; background: var(--bg); color: var(--text); line-height: 1.6; }
a { color: var(--accent); }
button { font: inherit; cursor: pointer; }

.topbar {
  position: sticky;
  top: 0;
  z-index: 40;
  display: flex;
  align-items: center;
  gap: .75rem;
  padding: .65rem 1rem;
  background: var(--panel);
  border-bottom: 1px solid var(--border);
  box-shadow: var(--shadow);
}
.menu-btn {
  display: none;
  border: 1px solid var(--border);
  background: var(--bg);
  color: var(--text);
  border-radius: .4rem;
  padding: .35rem .55rem;
  line-height: 1;
}
.topbar-title { font-weight: 700; font-size: .95rem; margin: 0; flex: 1; min-width: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.progress-wrap { display: flex; align-items: center; gap: .5rem; font-size: .78rem; color: var(--muted); white-space: nowrap; }
.progress-bar {
  width: 88px;
  height: 6px;
  background: var(--border);
  border-radius: 999px;
  overflow: hidden;
}
.progress-fill { height: 100%; background: var(--accent); border-radius: 999px; transition: width .2s; }
.open-chat {
  font-size: .78rem;
  padding: .35rem .65rem;
  border-radius: .4rem;
  border: 1px solid var(--accent-border);
  background: var(--accent-soft);
  color: var(--accent);
  text-decoration: none;
  white-space: nowrap;
}
.lang-switch {
  display: flex;
  gap: .2rem;
  font-size: .75rem;
  border: 1px solid var(--border);
  border-radius: .4rem;
  overflow: hidden;
}
.lang-switch a {
  padding: .3rem .5rem;
  text-decoration: none;
  color: var(--muted);
  background: var(--bg);
}
.lang-switch a:hover { color: var(--accent); }
.lang-switch a.active { background: var(--accent-soft); color: var(--accent); font-weight: 600; }

.layout {
  display: grid;
  grid-template-columns: var(--sidebar-w) minmax(0, 1fr);
  min-height: calc(100vh - 49px);
}
@media (max-width: 960px) {
  .menu-btn { display: inline-block; }
  .layout { grid-template-columns: 1fr; }
  .sidebar {
    position: fixed;
    left: 0;
    top: 49px;
    bottom: 0;
    width: min(var(--sidebar-w), 88vw);
    z-index: 30;
    transform: translateX(-105%);
    transition: transform .2s ease;
    box-shadow: var(--shadow);
  }
  .sidebar.open { transform: translateX(0); }
  .sidebar-backdrop {
    display: none;
    position: fixed;
    inset: 49px 0 0 0;
    background: rgba(0,0,0,.35);
    z-index: 25;
  }
  .sidebar-backdrop.open { display: block; }
}

.sidebar {
  background: var(--panel);
  border-right: 1px solid var(--border);
  padding: 1rem .85rem 2rem;
  position: sticky;
  top: 49px;
  align-self: start;
  max-height: calc(100vh - 49px);
  overflow: auto;
}
.brand { font-weight: 800; font-size: 1.1rem; margin: 0 0 .15rem; letter-spacing: -.02em; }
.brand-sub { color: var(--muted); font-size: .82rem; margin: 0 0 .85rem; }
.search {
  width: 100%;
  padding: .45rem .6rem;
  border: 1px solid var(--border);
  border-radius: .45rem;
  background: var(--bg);
  color: var(--text);
  font-size: .85rem;
  margin-bottom: .75rem;
}
.search:focus { outline: 2px solid var(--accent-border); border-color: var(--accent); }
.nav-group { margin: .85rem 0 0; }
.nav-group h3 {
  font-size: .68rem;
  text-transform: uppercase;
  letter-spacing: .07em;
  color: var(--muted);
  margin: 0 0 .3rem;
  padding: 0 .35rem;
}
.nav-group ul { list-style: none; margin: 0; padding: 0; }
.nav-group a {
  display: block;
  padding: .32rem .45rem;
  border-radius: .4rem;
  color: var(--text);
  text-decoration: none;
  font-size: .86rem;
  line-height: 1.35;
}
.nav-group a.section-link { font-weight: 600; font-size: .8rem; margin-top: .1rem; color: var(--muted); }
.nav-group a.lesson-link { padding-left: 1.1rem; }
.nav-group a:hover { background: var(--accent-soft); }
.nav-group a.active { background: var(--accent-soft); color: var(--accent); font-weight: 600; }
.nav-group li.hidden { display: none; }

.main-wrap { padding: 1.5rem clamp(1rem, 3vw, 2.5rem) 3rem; }
.content-panel {
  max-width: 48rem;
  background: var(--panel);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  box-shadow: var(--shadow);
  padding: clamp(1.25rem, 3vw, 2rem);
}
.lesson-meta {
  display: flex;
  flex-wrap: wrap;
  gap: .4rem;
  margin-bottom: 1rem;
}
.badge {
  font-size: .72rem;
  font-weight: 600;
  padding: .2rem .55rem;
  border-radius: 999px;
  background: var(--accent-soft);
  color: var(--accent);
  border: 1px solid var(--accent-border);
}
.breadcrumb { font-size: .82rem; color: var(--muted); margin: 0 0 .75rem; }
.breadcrumb a { color: var(--muted); text-decoration: none; }
.breadcrumb a:hover { color: var(--accent); text-decoration: underline; }

.with-toc {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 200px;
  gap: 2rem;
  align-items: start;
}
@media (max-width: 1100px) {
  .with-toc { grid-template-columns: 1fr; }
  .toc { display: none; }
}
.toc {
  position: sticky;
  top: 4.5rem;
  font-size: .78rem;
  border-left: 2px solid var(--border);
  padding-left: .75rem;
}
.toc h4 { margin: 0 0 .5rem; font-size: .72rem; text-transform: uppercase; letter-spacing: .06em; color: var(--muted); }
.toc ul { list-style: none; margin: 0; padding: 0; }
.toc a { display: block; padding: .2rem 0; color: var(--muted); text-decoration: none; line-height: 1.35; }
.toc a:hover { color: var(--accent); }
.toc .toc-h3 { padding-left: .65rem; font-size: .74rem; }

.content :is(h1, h2, h3) { line-height: 1.25; scroll-margin-top: 4.5rem; }
.content h1 { font-size: 1.65rem; margin-top: 0; letter-spacing: -.02em; }
.content h2 { margin-top: 1.75rem; border-bottom: 1px solid var(--border); padding-bottom: .35rem; font-size: 1.12rem; }
.content h3 { font-size: 1rem; margin-top: 1.25rem; }
.content a { color: var(--accent); }
.content code { background: var(--code-bg); padding: .12rem .35rem; border-radius: .25rem; font-size: .88em; }
.content pre {
  position: relative;
  background: var(--code-bg);
  padding: 1rem 2.5rem 1rem 1rem;
  border-radius: .5rem;
  overflow: auto;
  border: 1px solid var(--border);
}
.content pre code { background: none; padding: 0; }
.copy-btn {
  position: absolute;
  top: .45rem;
  right: .45rem;
  font-size: .7rem;
  padding: .2rem .45rem;
  border: 1px solid var(--border);
  border-radius: .3rem;
  background: var(--panel);
  color: var(--muted);
}
.copy-btn:hover { color: var(--accent); border-color: var(--accent-border); }
.content table { width: 100%; border-collapse: collapse; font-size: .9rem; margin: 1rem 0; }
.content th, .content td { border: 1px solid var(--border); padding: .5rem .65rem; text-align: left; }
.content th { background: var(--bg); font-weight: 600; }
.content hr { border: none; border-top: 1px solid var(--border); margin: 1.5rem 0; }
.content blockquote {
  margin: 1rem 0;
  padding: .75rem 1rem;
  border-left: 3px solid var(--accent);
  background: var(--accent-soft);
  border-radius: 0 var(--radius) var(--radius) 0;
  color: var(--text);
}
.content blockquote p { margin: 0; }

.pager {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: .75rem;
  margin-top: 2rem;
}
.pager a, .pager .pager-empty {
  display: block;
  padding: .85rem 1rem;
  border: 1px solid var(--border);
  border-radius: var(--radius);
  text-decoration: none;
  background: var(--bg);
  transition: border-color .15s, background .15s;
}
.pager a:hover { border-color: var(--accent-border); background: var(--accent-soft); }
.pager .next { text-align: right; }
.pager .label { color: var(--muted); display: block; font-size: .72rem; text-transform: uppercase; letter-spacing: .05em; margin-bottom: .2rem; }
.pager .title { color: var(--accent); font-weight: 600; font-size: .9rem; }
.pager-empty { visibility: hidden; }

.chat-hint {
  margin-top: 1.5rem;
  padding: .85rem 1rem;
  border-radius: var(--radius);
  border: 1px dashed var(--accent-border);
  background: var(--accent-soft);
  font-size: .88rem;
}
.chat-hint strong { color: var(--accent); }
.chat-hint code { font-size: .85em; }
`;

const SCRIPTS = (copyLabel: string, copiedLabel: string) => `
(function () {
  var sidebar = document.querySelector('.sidebar');
  var backdrop = document.querySelector('.sidebar-backdrop');
  var menuBtn = document.querySelector('.menu-btn');
  function closeSidebar() {
    sidebar.classList.remove('open');
    backdrop.classList.remove('open');
  }
  if (menuBtn) {
    menuBtn.addEventListener('click', function () {
      sidebar.classList.toggle('open');
      backdrop.classList.toggle('open');
    });
    backdrop.addEventListener('click', closeSidebar);
    sidebar.querySelectorAll('a').forEach(function (a) {
      a.addEventListener('click', closeSidebar);
    });
  }

  var search = document.querySelector('.search');
  if (search) {
    search.addEventListener('input', function () {
      var q = search.value.trim().toLowerCase();
      document.querySelectorAll('.nav-group li').forEach(function (li) {
        var text = li.textContent.toLowerCase();
        li.classList.toggle('hidden', q.length > 0 && !text.includes(q));
      });
    });
  }

  document.querySelectorAll('.content pre').forEach(function (pre) {
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'copy-btn';
    btn.textContent = ${JSON.stringify(copyLabel)};
    btn.addEventListener('click', function () {
      var code = pre.querySelector('code');
      var text = code ? code.textContent : pre.textContent;
      navigator.clipboard.writeText(text || '').then(function () {
        btn.textContent = ${JSON.stringify(copiedLabel)};
        setTimeout(function () { btn.textContent = ${JSON.stringify(copyLabel)}; }, 1500);
      });
    });
    pre.appendChild(btn);
  });

  var content = document.querySelector('.content');
  var tocList = document.querySelector('.toc ul');
  if (content && tocList) {
    var headings = content.querySelectorAll('h2, h3');
    headings.forEach(function (h, i) {
      if (!h.id) h.id = 'section-' + i;
      var li = document.createElement('li');
      var a = document.createElement('a');
      a.href = '#' + h.id;
      a.textContent = h.textContent;
      if (h.tagName === 'H3') a.className = 'toc-h3';
      li.appendChild(a);
      tocList.appendChild(li);
    });
    if (!headings.length) {
      document.querySelector('.toc').style.display = 'none';
    }
  }
})();
`;

export interface CourseShellOptions {
  title: string;
  bodyHtml: string;
  pages: CoursePage[];
  activeSlug: string;
  activePage?: CoursePage;
  prev?: CoursePage;
  next?: CoursePage;
  locale?: CourseLocale;
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
    .replace(/^Section: /, "")
    .replace(/^Phần: /, "");
}

function isLessonPage(page: CoursePage): boolean {
  return /\/\d{2}-.+\.md$/.test(page.relPath);
}

function lessonPages(pages: CoursePage[]): CoursePage[] {
  return pages.filter(isLessonPage);
}

function lessonProgress(
  pages: CoursePage[],
  activeSlug: string,
): { index: number; total: number; pct: number } {
  const lessons = lessonPages(pages);
  const idx = lessons.findIndex((p) => p.slug === activeSlug);
  const index = idx >= 0 ? idx + 1 : 0;
  const total = lessons.length;
  const pct = total > 0 && index > 0 ? Math.round((index / total) * 100) : 0;
  return { index, total, pct };
}

const SECTION_IDS = [
  "01-get-started",
  "02-chat-basics",
  "03-graph",
  "04-generate",
  "05-prototype",
  "06-review",
  "07-advanced",
] as const;

function navGroups(
  pages: CoursePage[],
  locale: CourseLocale,
): Array<{ label: string; sectionId: string; items: CoursePage[] }> {
  return SECTION_IDS
    .map((sectionId) => {
      const sectionReadme = pages.find((p) => p.slug === sectionId);
      const lessons = pages.filter(
        (p) => p.sectionId === sectionId && !p.relPath.endsWith("/README.md"),
      );
      return {
        label: sectionLabelForLocale(sectionId, locale),
        sectionId,
        items: sectionReadme ? [sectionReadme, ...lessons] : lessons,
      };
    })
    .filter((g) => g.items.length > 0);
}

function breadcrumbHtml(page: CoursePage | undefined, locale: CourseLocale, ui: ReturnType<typeof courseUi>): string {
  const home = coursePageUrl(locale, "index");
  if (!page || page.slug === "index" || page.slug === "00-overview") {
    return `<p class="breadcrumb"><a href="${home}">${escapeHtml(ui.course)}</a></p>`;
  }
  const parts = [`<a href="${home}">${escapeHtml(ui.course)}</a>`];
  if (page.sectionId) {
    parts.push(
      `<a href="${coursePageUrl(locale, page.sectionId)}">${escapeHtml(sectionLabelForLocale(page.sectionId, locale))}</a>`,
    );
  }
  parts.push(`<span>${escapeHtml(shortTitle(page.title))}</span>`);
  return `<p class="breadcrumb">${parts.join(" › ")}</p>`;
}

function metaBadges(
  page: CoursePage | undefined,
  progress: { index: number; total: number } | undefined,
  ui: ReturnType<typeof courseUi>,
): string {
  const badges: string[] = [];
  if (page?.sectionTitle) {
    badges.push(`<span class="badge">${escapeHtml(page.sectionTitle)}</span>`);
  }
  if (progress && progress.index > 0) {
    badges.push(`<span class="badge">${escapeHtml(ui.lessonBadge(progress.index, progress.total))}</span>`);
  }
  if (badges.length === 0) {
    return "";
  }
  return `<div class="lesson-meta">${badges.join("")}</div>`;
}

function langSwitcherHtml(activeSlug: string, locale: CourseLocale, ui: ReturnType<typeof courseUi>): string {
  const enUrl = coursePageUrl("en", activeSlug);
  const viUrl = coursePageUrl("vi", activeSlug);
  const enActive = locale === "en" ? " active" : "";
  const viActive = locale === "vi" ? " active" : "";
  return `<div class="lang-switch" role="navigation" aria-label="Language">
    <a class="${enActive.trim()}" href="${enUrl}" hreflang="en">${escapeHtml(ui.langEn)}</a>
    <a class="${viActive.trim()}" href="${viUrl}" hreflang="vi">${escapeHtml(ui.langVi)}</a>
  </div>`;
}

function chatHintHtml(page: CoursePage | undefined, locale: CourseLocale, ui: ReturnType<typeof courseUi>): string {
  const hint = chatHintForSection(page?.sectionId, locale);
  return `<div class="chat-hint"><strong>${escapeHtml(ui.inEditor)}</strong> ${hint}</div>`;
}

export function buildCoursePageHtml(opts: CourseShellOptions): string {
  const locale = opts.locale ?? "en";
  const ui = courseUi(locale);
  const progress = lessonProgress(opts.pages, opts.activeSlug);
  const topLinks = [
    opts.pages.find((p) => p.slug === "index"),
    opts.pages.find((p) => p.slug === "00-overview"),
  ].filter(Boolean) as CoursePage[];

  const topNav = topLinks
    .map((p) => {
      const active = p.slug === opts.activeSlug ? " active" : "";
      return `<li><a class="${active.trim()}" href="${coursePageUrl(locale, p.slug)}">${escapeHtml(shortTitle(p.title))}</a></li>`;
    })
    .join("");

  const sectionNav = navGroups(opts.pages, locale)
    .map((group) => {
      const links = group.items
        .map((p) => {
          const active = p.slug === opts.activeSlug ? " active" : "";
          const isSection = p.relPath.endsWith("/README.md");
          const cls = [
            active.trim(),
            isSection ? "section-link" : "lesson-link",
          ].filter(Boolean).join(" ");
          const label = shortTitle(p.title);
          return `<li><a class="${cls}" href="${coursePageUrl(locale, p.slug)}">${escapeHtml(label)}</a></li>`;
        })
        .join("");
      return `<div class="nav-group"><h3>${escapeHtml(group.label)}</h3><ul>${links}</ul></div>`;
    })
    .join("");

  const prevLink = opts.prev
    ? `<a class="prev" href="${coursePageUrl(locale, opts.prev.slug)}"><span class="label">${escapeHtml(ui.previous)}</span><span class="title">← ${escapeHtml(shortTitle(opts.prev.title))}</span></a>`
    : `<span class="pager-empty"></span>`;
  const nextLink = opts.next
    ? `<a class="next" href="${coursePageUrl(locale, opts.next.slug)}"><span class="label">${escapeHtml(ui.next)}</span><span class="title">${escapeHtml(shortTitle(opts.next.title))} →</span></a>`
    : `<span class="pager-empty"></span>`;

  const progressLabel = progress.index > 0
    ? ui.lessonOf(progress.index, progress.total)
    : ui.browse;

  return `<!DOCTYPE html>
<html lang="${locale}">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(opts.title)} · ${escapeHtml(ui.courseTitle)}</title>
  <style>${STYLES}</style>
</head>
<body>
  <header class="topbar">
    <button type="button" class="menu-btn" aria-label="${escapeHtml(ui.openNav)}">☰</button>
    <p class="topbar-title">${escapeHtml(shortTitle(opts.title))}</p>
    ${langSwitcherHtml(opts.activeSlug, locale, ui)}
    <div class="progress-wrap" title="${escapeHtml(ui.progressTitle)}">
      <span>${escapeHtml(progressLabel)}</span>
      <div class="progress-bar" aria-hidden="true"><div class="progress-fill" style="width:${progress.pct}%"></div></div>
    </div>
    <a class="open-chat" href="#chat-hint">${escapeHtml(ui.tryInChat)}</a>
  </header>
  <div class="sidebar-backdrop"></div>
  <div class="layout">
    <aside class="sidebar">
      <p class="brand">AI Spector</p>
      <p class="brand-sub">${escapeHtml(ui.brandSub)}</p>
      <input type="search" class="search" placeholder="${escapeHtml(ui.searchPlaceholder)}" aria-label="${escapeHtml(ui.searchAria)}" />
      <div class="nav-group"><ul>${topNav}</ul></div>
      ${sectionNav}
    </aside>
    <div class="main-wrap">
      <div class="content-panel">
        ${breadcrumbHtml(opts.activePage, locale, ui)}
        ${metaBadges(opts.activePage, progress, ui)}
        <div class="with-toc">
          <article class="content">${opts.bodyHtml}</article>
          <nav class="toc" aria-label="${escapeHtml(ui.onThisPage)}">
            <h4>${escapeHtml(ui.onThisPage)}</h4>
            <ul></ul>
          </nav>
        </div>
        <nav class="pager">${prevLink}${nextLink}</nav>
        <div id="chat-hint">${chatHintHtml(opts.activePage, locale, ui)}</div>
      </div>
    </div>
  </div>
  <script>${SCRIPTS(ui.copy, ui.copied)}</script>
</body>
</html>`;
}
