# Course Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a bilingual (EN + VI) essentials-first course — 9 chat-first lessons, locale-aware server, legacy URL redirects, updated agent skill.

**Architecture:** Parallel locale trees under `website/docs/{en,vi}/`; `resolveCourseRoot` appends locale; URLs `/course/{locale}/{slug}`; legacy flat slugs 302 via `redirects.ts`; markdown callouts via `:::exercise` / `:::roletip` / `:::behind` preprocessed in `render.ts`.

**Tech Stack:** TypeScript, unified/remark (existing), Vitest, static markdown in `website/docs/`.

**Spec:** [`docs/superpowers/specs/2026-06-17-course-redesign-design.md`](../specs/2026-06-17-course-redesign-design.md)

---

## File map

| File | Responsibility |
|------|----------------|
| `src/core/course/locale.ts` | `CourseLocale` = `"en" \| "vi"`, UI strings, `parseCourseRequest`, `coursePageUrl` with locale prefix |
| `src/core/course/catalog.ts` | `resolveCourseRoot` → `…/docs/{locale}/`; update error message paths |
| `src/core/course/redirects.ts` | Legacy slug → `/course/en/{newSlug}` map |
| `src/core/course/serve.ts` | `/course/index` → `/course/en/index`; legacy redirects; VI→EN fallback |
| `src/core/course/sections.ts` | Essentials section IDs + labels |
| `src/core/course/render.ts` | Callout preprocessor; locale-aware links |
| `src/core/course/html-shell.ts` | Locale switcher, advanced stub nav, callout CSS, dynamic `SECTION_IDS` |
| `website/docs/en/**` | English essentials (9 lessons + section READMEs) |
| `website/docs/vi/**` | Vietnamese essentials (mirror) |
| `website/docs/legacy/**` | Archived current 16-lesson course |
| `tests/course/locale.test.ts` | Locale parsing + root resolution |
| `tests/course/redirects.test.ts` | Legacy redirect map |
| `tests/course/catalog.test.ts` | Updated lesson counts |
| `tests/course/render.test.ts` | Callout HTML transformation |
| `scaffold/cursor/skills/ai-spector-course/` | SKILL.md + course-guide.md |
| `scaffold/claude/.claude/skills/ai-spector-course/` | Claude parity (or `npm run build:claude-scaffold`) |

---

### Task 1: Locale types and URL parsing

**Files:**
- Modify: `src/core/course/locale.ts`
- Test: `tests/course/locale.test.ts` (create)

- [ ] **Step 1: Write the failing tests**

```typescript
// tests/course/locale.test.ts
import { describe, expect, it } from "vitest";
import {
  coursePageUrl,
  normalizeCourseLocale,
  parseCourseRequest,
  SUPPORTED_COURSE_LOCALES,
} from "@/core/course/locale.js";

describe("parseCourseRequest", () => {
  it("parses /course/en/index", () => {
    expect(parseCourseRequest("/course/en/index")).toEqual({ locale: "en", slug: "index" });
  });

  it("parses /course/vi/06-review/01-document-review", () => {
    expect(parseCourseRequest("/course/vi/06-review/01-document-review")).toEqual({
      locale: "vi",
      slug: "06-review/01-document-review",
    });
  });

  it("defaults bare /course/index to en", () => {
    expect(parseCourseRequest("/course/index")).toEqual({ locale: "en", slug: "index" });
  });

  it("treats legacy slug without locale as en slug (redirect handled in serve)", () => {
    expect(parseCourseRequest("/course/04-generate/01-generate-srs")).toEqual({
      locale: "en",
      slug: "04-generate/01-generate-srs",
    });
  });
});

describe("coursePageUrl", () => {
  it("includes locale prefix", () => {
    expect(coursePageUrl("en", "05-generate/01-generate-srs")).toBe(
      "/course/en/05-generate/01-generate-srs",
    );
    expect(coursePageUrl("vi", "index")).toBe("/course/vi/index");
  });
});

describe("normalizeCourseLocale", () => {
  it("accepts en and vi", () => {
    expect(normalizeCourseLocale("vi")).toBe("vi");
    expect(normalizeCourseLocale("en")).toBe("en");
  });

  it("falls back to en for unknown", () => {
    expect(normalizeCourseLocale("fr")).toBe("en");
  });

  it("exports both locales", () => {
    expect(SUPPORTED_COURSE_LOCALES).toEqual(["en", "vi"]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/course/locale.test.ts`  
Expected: FAIL — `vi` not in `CourseLocale`, `coursePageUrl` missing locale segment

- [ ] **Step 3: Implement locale.ts changes**

Replace `src/core/course/locale.ts` core exports with:

```typescript
export type CourseLocale = "en" | "vi";

export const DEFAULT_COURSE_LOCALE: CourseLocale = "en";

export const SUPPORTED_COURSE_LOCALES: readonly CourseLocale[] = ["en", "vi"] as const;

const UI_EN: CourseUiStrings = { /* existing UI object */ brandSub: "9 lessons · ~10 min each", /* … */ };
const UI_VI: CourseUiStrings = {
  course: "Khóa học",
  courseTitle: "Khóa học AI Spector",
  brandSub: "9 bài · ~10 phút mỗi bài",
  searchPlaceholder: "Tìm bài học…",
  searchAria: "Tìm bài học",
  onThisPage: "Trong trang này",
  previous: "Trước",
  next: "Tiếp",
  lessonOf: (i, t) => `Bài ${i}/${t}`,
  lessonBadge: (i, t) => `Bài ${i} / ${t}`,
  browse: "Duyệt",
  progressTitle: "Tiến độ khóa học",
  tryInChat: "Thử trong chat ↓",
  openNav: "Mở menu",
  copy: "Sao chép",
  copied: "Đã sao chép",
  inEditor: "Trong Cursor / Claude Code:",
};

export function courseUi(locale: CourseLocale = DEFAULT_COURSE_LOCALE): CourseUiStrings {
  return locale === "vi" ? UI_VI : UI_EN;
}

export function coursePathPrefix(locale: CourseLocale = DEFAULT_COURSE_LOCALE): string {
  return `/course/${locale}`;
}

export function coursePageUrl(locale: CourseLocale, slug: string): string {
  const base = coursePathPrefix(locale);
  return `${base}/${slug === "index" ? "index" : slug}`;
}

export function parseCourseRequest(pathname: string): { locale: CourseLocale; slug: string } {
  const trimmed = pathname.replace(/^\/course\/?/, "").replace(/\/$/, "");
  if (!trimmed || trimmed === "index") {
    return { locale: "en", slug: "index" };
  }
  const [first, ...rest] = trimmed.split("/");
  if (first === "en" || first === "vi") {
    const slugRest = rest.join("/");
    return { locale: first, slug: slugRest || "index" };
  }
  return { locale: "en", slug: trimmed };
}

export function normalizeCourseLocale(value?: string): CourseLocale {
  return value === "vi" ? "vi" : "en";
}
```

Update `SECTION_LABELS` and `CHAT_HINTS` to essentials section IDs (Task 5 will finalize keys).

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- tests/course/locale.test.ts`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/core/course/locale.ts tests/course/locale.test.ts
git commit -m "feat(course): add vi locale and locale-prefixed URLs"
```

---

### Task 2: Locale-aware course root resolution

**Files:**
- Modify: `src/core/course/catalog.ts`
- Modify: `tests/course/catalog.test.ts`
- Modify: `tests/course/locale.test.ts`

- [ ] **Step 1: Write the failing test**

Add to `tests/course/locale.test.ts`:

```typescript
import { resolveCourseRoot } from "@/core/course/catalog.js";
import * as configLoad from "@/core/config/load.js";

describe("resolveCourseRoot", () => {
  it("resolves bundled en locale under website/docs/en", async () => {
    const root = await resolveCourseRoot(undefined, "en");
    expect(root).toMatch(/website\/docs\/en$/);
  });

  it("resolves bundled vi locale under website/docs/vi", async () => {
    const root = await resolveCourseRoot(undefined, "vi");
    expect(root).toMatch(/website\/docs\/vi$/);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/course/locale.test.ts`  
Expected: FAIL — root is `website/docs` without `/en`

- [ ] **Step 3: Update resolveCourseRoot**

In `src/core/course/catalog.ts`:

```typescript
function localeCourseDir(base: string, locale: CourseLocale): string {
  return join(base, locale);
}

export async function resolveCourseRoot(
  projectRoot?: string,
  locale: CourseLocale = DEFAULT_COURSE_LOCALE,
): Promise<string> {
  const bundledBase = courseBundleRoot();
  const localBase = projectRoot ? join(projectRoot, "docs", "course") : undefined;

  const checkedPaths: string[] = [];
  if (localBase) {
    const localLocale = localeCourseDir(localBase, locale);
    checkedPaths.push(localLocale);
    if (await pathExists(localLocale)) {
      return localLocale;
    }
  }
  const bundledLocale = localeCourseDir(bundledBase, locale);
  checkedPaths.push(bundledLocale);
  if (await pathExists(bundledLocale)) {
    return bundledLocale;
  }

  throw new CourseNotFoundError(locale, checkedPaths);
}
```

Update `formatCourseNotFoundMessage` fix hints to mention `docs/course/en/` and `website/docs/en/`.

- [ ] **Step 4: Run test — still fails until Task 3 scaffolds dirs**

Proceed to Task 3 scaffold, then re-run.

- [ ] **Step 5: Commit**

```bash
git add src/core/course/catalog.ts tests/course/locale.test.ts
git commit -m "feat(course): resolve course root per locale"
```

---

### Task 3: Archive legacy content and scaffold locale trees

**Files:**
- Move: `website/docs/01-get-started` … `07-advanced`, `README.md` → `website/docs/legacy/`
- Create: `website/docs/en/README.md` (stub)
- Create: `website/docs/vi/README.md` (stub)

- [ ] **Step 1: Move legacy content**

```bash
cd /Users/khang/work/ai-center/ai-spector
mkdir -p website/docs/legacy
for d in 01-get-started 02-chat-basics 03-graph 04-generate 05-prototype 06-review 07-advanced; do
  git mv "website/docs/$d" "website/docs/legacy/$d"
done
git mv website/docs/README.md website/docs/legacy/README.md
```

- [ ] **Step 2: Create stub EN home**

`website/docs/en/README.md`:

```markdown
---
sidebar_position: 1
---

# AI Spector Course

Learn AI Spector step by step — **describe what you need in chat**.

`npx ai-spector course serve --open`

**In chat:** *"open the course"* · *"learn ai-spector"*

## Essentials (9 lessons)

| Section | Lessons | Covers |
|---------|---------|--------|
| [Welcome](01-welcome/README.md) | 1 | What AI Spector does |
| [Get started](02-get-started/README.md) | 1 | Setup via chat |
| [Chat basics](03-chat-basics/README.md) | 2 | Phrases and approve types |
| [Changes](04-changes/README.md) | 1 | Add one requirement |
| [Generate](05-generate/README.md) | 1 | SRS generation |
| [Review](06-review/README.md) | 2 | Sign-off and comments |
| [Everyday](07-everyday/README.md) | 1 | Tasks and workspace |

## Next

[Welcome](01-welcome/01-what-is-ai-spector.md)
```

- [ ] **Step 3: Create stub VI home**

`website/docs/vi/README.md` — Vietnamese translation of EN home (same table links, Vietnamese headings).

- [ ] **Step 4: Verify roots exist**

Run: `ls website/docs/en/README.md website/docs/vi/README.md website/docs/legacy/README.md`  
Expected: all three exist

- [ ] **Step 5: Commit**

```bash
git add website/docs/
git commit -m "chore(course): archive legacy lessons and scaffold en/vi trees"
```

---

### Task 4: Legacy URL redirects

**Files:**
- Create: `src/core/course/redirects.ts`
- Modify: `src/core/course/serve.ts`
- Test: `tests/course/redirects.test.ts`

- [ ] **Step 1: Write the failing tests**

```typescript
// tests/course/redirects.test.ts
import { describe, expect, it } from "vitest";
import { legacyCourseRedirect } from "@/core/course/redirects.js";

describe("legacyCourseRedirect", () => {
  it("redirects old generate SRS slug", () => {
    expect(legacyCourseRedirect("04-generate/01-generate-srs")).toBe(
      "/course/en/05-generate/01-generate-srs",
    );
  });

  it("redirects old chat basics slug", () => {
    expect(legacyCourseRedirect("02-chat-basics/01-how-chat-works")).toBe(
      "/course/en/03-chat-basics/01-how-chat-works",
    );
  });

  it("redirects unknown legacy slug to index with migrated query", () => {
    expect(legacyCourseRedirect("07-advanced/01-custom-templates")).toBe(
      "/course/en/index?migrated=1",
    );
  });

  it("returns undefined for locale-prefixed paths", () => {
    expect(legacyCourseRedirect("en/05-generate/01-generate-srs")).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/course/redirects.test.ts`  
Expected: FAIL — module not found

- [ ] **Step 3: Implement redirects.ts**

```typescript
// src/core/course/redirects.ts
const LEGACY_REDIRECTS: Record<string, string> = {
  index: "/course/en/index",
  "01-get-started": "/course/en/02-get-started",
  "01-get-started/01-prerequisites-and-init": "/course/en/02-get-started/01-setup-via-chat",
  "01-get-started/02-setup-and-skills": "/course/en/02-get-started/01-setup-via-chat",
  "02-chat-basics": "/course/en/03-chat-basics",
  "02-chat-basics/01-how-chat-works": "/course/en/03-chat-basics/01-how-chat-works",
  "02-chat-basics/02-workspace-and-tasks": "/course/en/07-everyday/01-tasks-and-workspace",
  "02-chat-basics/03-incremental-changes": "/course/en/04-changes/01-add-or-change-requirement",
  "04-generate/01-generate-srs": "/course/en/05-generate/01-generate-srs",
  "04-generate/02-basic-design": "/course/en/index?migrated=1",
  "06-review/01-document-review": "/course/en/06-review/01-document-review",
  "06-review/02-comment-threads": "/course/en/06-review/02-resolve-comments",
};

export function legacyCourseRedirect(slug: string): string | undefined {
  if (slug.startsWith("en/") || slug.startsWith("vi/")) {
    return undefined;
  }
  return LEGACY_REDIRECTS[slug] ?? "/course/en/index?migrated=1";
}

export function isLegacyCourseSlug(slug: string): boolean {
  return legacyCourseRedirect(slug) !== undefined && !slug.startsWith("en/") && !slug.startsWith("vi/");
}
```

- [ ] **Step 4: Wire serve.ts**

In `handleRequest`, after parsing path:

```typescript
import { legacyCourseRedirect } from "./redirects.js";

// After: if path === "/course/index" → redirect to /course/en/index
if (path === "/course/index") {
  res.writeHead(302, { Location: "/course/en/index" });
  res.end();
  return;
}

const { locale, slug } = parseCourseRequest(path);

// Legacy slug without locale prefix in URL (e.g. /course/04-generate/...)
const pathAfterCourse = path.replace(/^\/course\/?/, "").replace(/\/$/, "");
if (pathAfterCourse && !pathAfterCourse.startsWith("en/") && !pathAfterCourse.startsWith("vi/") && pathAfterCourse !== "index") {
  const target = legacyCourseRedirect(pathAfterCourse);
  if (target) {
    res.writeHead(302, { Location: target });
    res.end();
    return;
  }
}
```

Update `runCourseServe` default URL to `http://${host}:${port}/course/en/index`.

- [ ] **Step 5: Run tests**

Run: `npm test -- tests/course/redirects.test.ts`  
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/core/course/redirects.ts src/core/course/serve.ts tests/course/redirects.test.ts
git commit -m "feat(course): redirect legacy lesson URLs to essentials"
```

---

### Task 5: Essentials section labels and nav

**Files:**
- Modify: `src/core/course/sections.ts`
- Modify: `src/core/course/locale.ts` (`SECTION_LABELS`, `CHAT_HINTS`)
- Modify: `src/core/course/html-shell.ts` (`SECTION_IDS`)

- [ ] **Step 1: Update sections.ts**

```typescript
export const SECTION_LABELS: Record<string, string> = {
  "01-welcome": "Welcome",
  "02-get-started": "Get started",
  "03-chat-basics": "Chat basics",
  "04-changes": "Changes",
  "05-generate": "Generate",
  "06-review": "Review",
  "07-everyday": "Everyday",
};

export const SECTION_LABELS_VI: Record<string, string> = {
  "01-welcome": "Giới thiệu",
  "02-get-started": "Bắt đầu",
  "03-chat-basics": "Chat cơ bản",
  "04-changes": "Thay đổi",
  "05-generate": "Tạo tài liệu",
  "06-review": "Rà soát",
  "07-everyday": "Hàng ngày",
};
```

Update `sectionLabel` to use `SECTION_LABELS_VI` when `locale === "vi"`.

- [ ] **Step 2: Update html-shell SECTION_IDS**

```typescript
const SECTION_IDS = [
  "01-welcome",
  "02-get-started",
  "03-chat-basics",
  "04-changes",
  "05-generate",
  "06-review",
  "07-everyday",
] as const;
```

Add after section nav in `buildCoursePageHtml`:

```typescript
const advancedStub = `<div class="nav-group nav-group-disabled"><h3>${escapeHtml(locale === "vi" ? "Nâng cao (sắp ra mắt)" : "Advanced (coming soon)")}</h3><ul><li><span class="nav-disabled">${escapeHtml(locale === "vi" ? "Đồ thị, prototype, mẫu tùy chỉnh…" : "Graph, prototype, custom templates…")}</span></li></ul></div>`;
```

Add CSS:

```css
.nav-group-disabled h3 { color: var(--muted); opacity: .7; }
.nav-disabled { display: block; padding: .32rem .45rem; font-size: .82rem; color: var(--muted); }
```

- [ ] **Step 3: Add locale switcher to topbar**

In `buildCoursePageHtml`, before `open-chat` link:

```typescript
function localeSwitcherHtml(activeLocale: CourseLocale, activeSlug: string): string {
  const locales: CourseLocale[] = ["en", "vi"];
  return locales
    .map((loc) => {
      const active = loc === activeLocale ? ' class="locale-active"' : "";
      return `<a href="${coursePageUrl(loc, activeSlug)}"${active}>${loc.toUpperCase()}</a>`;
    })
    .join(' <span class="locale-sep">|</span> ');
}
```

Insert `<div class="locale-switch">${localeSwitcherHtml(locale, opts.activeSlug)}</div>` in topbar.

- [ ] **Step 4: Commit**

```bash
git add src/core/course/sections.ts src/core/course/locale.ts src/core/course/html-shell.ts
git commit -m "feat(course): essentials nav, locale switcher, advanced stub"
```

---

### Task 6: Markdown callout preprocessor

**Files:**
- Modify: `src/core/course/render.ts`
- Test: `tests/course/render.test.ts` (create)

- [ ] **Step 1: Write the failing tests**

```typescript
// tests/course/render.test.ts
import { describe, expect, it } from "vitest";
import { preprocessCallouts, renderCourseMarkdown } from "@/core/course/render.js";

describe("preprocessCallouts", () => {
  it("wraps exercise block", () => {
    const md = ":::exercise\nTry: `setup ai-spector project`\n:::";
    expect(preprocessCallouts(md)).toContain('class="callout exercise"');
    expect(preprocessCallouts(md)).toContain("setup ai-spector project");
  });

  it("wraps roletip block", () => {
    const md = ":::roletip\n**BA** — focus on approval wording\n:::";
    expect(preprocessCallouts(md)).toContain('class="callout roletip"');
  });

  it("wraps behind block in details", () => {
    const md = ":::behind\nUses skill `ai-spector-setup`\n:::";
    expect(preprocessCallouts(md)).toContain("<details");
    expect(preprocessCallouts(md)).toContain('class="callout behind"');
  });
});

describe("renderCourseMarkdown links", () => {
  it("rewrites links with locale prefix", async () => {
    const html = await renderCourseMarkdown(
      "Next [lesson](../05-generate/01-generate-srs.md).",
      "03-chat-basics/01-how-chat-works.md",
      "en",
    );
    expect(html).toContain('href="/course/en/05-generate/01-generate-srs"');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/course/render.test.ts`  
Expected: FAIL

- [ ] **Step 3: Implement preprocessCallouts**

Add to `src/core/course/render.ts`:

```typescript
export function preprocessCallouts(markdown: string): string {
  return markdown.replace(
    /:::(exercise|roletip|behind)\n([\s\S]*?):::/g,
    (_, kind: string, body: string) => {
      if (kind === "behind") {
        return `<details class="callout behind"><summary>Behind the scenes</summary>\n\n${body.trim()}\n\n</details>`;
      }
      return `<div class="callout ${kind}">\n\n${body.trim()}\n\n</div>`;
    },
  );
}
```

In `renderCourseMarkdown`, before `rewriteMarkdownLinks`:

```typescript
const withCallouts = preprocessCallouts(markdown);
const prepared = rewriteMarkdownLinks(withCallouts, currentRelPath, locale);
```

Note: remark will pass through raw HTML blocks.

Add to `html-shell.ts` STYLES:

```css
.callout { margin: 1.25rem 0; padding: 1rem 1.1rem; border-radius: var(--radius); border: 1px solid var(--border); }
.callout.exercise { border-color: var(--accent-border); background: var(--accent-soft); }
.callout.exercise::before { content: "Try it now"; display: block; font-weight: 700; color: var(--accent); margin-bottom: .5rem; }
.callout.roletip { font-size: .88rem; background: var(--bg); }
.callout.roletip::before { content: "Role tip"; display: block; font-weight: 600; color: var(--muted); margin-bottom: .35rem; }
.callout.behind { font-size: .85rem; color: var(--muted); }
.locale-switch { font-size: .78rem; }
.locale-switch a { color: var(--muted); text-decoration: none; }
.locale-switch a.locale-active { color: var(--accent); font-weight: 700; }
.locale-sep { color: var(--muted); }
.locale-fallback-banner { background: #fef3c7; color: #92400e; padding: .75rem 1rem; border-radius: var(--radius); margin-bottom: 1rem; font-size: .88rem; }
```

- [ ] **Step 4: Run tests**

Run: `npm test -- tests/course/render.test.ts`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/core/course/render.ts src/core/course/html-shell.ts tests/course/render.test.ts
git commit -m "feat(course): markdown callouts for exercises and role tips"
```

---

### Task 7: VI fallback when translation missing

**Files:**
- Modify: `src/core/course/serve.ts`
- Modify: `src/core/course/html-shell.ts`
- Test: extend `tests/course/locale.test.ts`

- [ ] **Step 1: Write failing test for fallback helper**

```typescript
// tests/course/fallback.test.ts
import { describe, expect, it } from "vitest";
import { resolvePageWithFallback } from "@/core/course/fallback.js";
import type { CoursePage } from "@/core/course/catalog.js";

const pages: CoursePage[] = [
  { slug: "01-welcome/01-what-is-ai-spector", relPath: "01-welcome/01-what-is-ai-spector.md", order: 101, title: "Welcome" },
];

describe("resolvePageWithFallback", () => {
  it("returns vi page when found", async () => {
    const result = await resolvePageWithFallback("vi", "01-welcome/01-what-is-ai-spector", pages, pages);
    expect(result.fallback).toBe(false);
  });

  it("falls back to en when vi page missing", async () => {
    const result = await resolvePageWithFallback("vi", "missing-lesson", pages, pages);
    expect(result.fallback).toBe(true);
    expect(result.page?.slug).toBe("01-welcome/01-what-is-ai-spector");
  });
});
```

- [ ] **Step 2: Implement `src/core/course/fallback.ts`**

```typescript
import type { CoursePage } from "./catalog.js";
import { pageBySlug } from "./catalog.js";
import type { CourseLocale } from "./locale.js";

export async function resolvePageWithFallback(
  locale: CourseLocale,
  slug: string,
  localePages: CoursePage[],
  enPages: CoursePage[],
): Promise<{ page?: CoursePage; fallback: boolean; bodyLocale: CourseLocale }> {
  const page = pageBySlug(localePages, slug);
  if (page) {
    return { page, fallback: false, bodyLocale: locale };
  }
  if (locale === "vi") {
    const enPage = pageBySlug(enPages, slug);
    if (enPage) {
      return { page: enPage, fallback: true, bodyLocale: "en" };
    }
  }
  return { fallback: false };
}
```

- [ ] **Step 3: Wire serve.ts**

Load both `en` and `vi` roots when `locale === "vi"`. Pass `fallbackBanner` to `buildCoursePageHtml` when `fallback === true`.

- [ ] **Step 4: Run tests and commit**

```bash
git add src/core/course/fallback.ts src/core/course/serve.ts src/core/course/html-shell.ts tests/course/fallback.test.ts
git commit -m "feat(course): fall back to English when Vietnamese lesson missing"
```

---

### Task 8: English essentials lessons (1–3)

**Files:**
- Create: `website/docs/en/01-welcome/README.md`, `01-what-is-ai-spector.md`
- Create: `website/docs/en/02-get-started/README.md`, `01-setup-via-chat.md`
- Create: `website/docs/en/03-chat-basics/README.md`, `01-how-chat-works.md`

- [ ] **Step 1: Write lesson 1**

`website/docs/en/01-welcome/01-what-is-ai-spector.md`:

```markdown
# What is AI Spector?

**Section:** [Welcome](README.md) · **Course:** [Home](../README.md)  
**Time:** ~10 min

**Goal:** Understand that you describe what you need in chat — the agent does the technical work.

---

## In plain terms

AI Spector helps your team turn requirements into structured documents (SRS, designs, reviews). **You talk to the agent in Cursor or Claude Code.** You do not need to memorize commands or edit config files for daily work.

| You do | Agent does |
|--------|------------|
| Say what you need | Picks the right workflow |
| Answer clarifying questions | Reads your project and sources |
| Approve plans when asked | Writes documents and updates the project |

---

## You say → Agent does → You see

**You say:** *"open the course"*

**Agent does:** Starts the course in your browser and points you to the right lesson.

**You see:** A link like `http://127.0.0.1:4177/course/en/index` and a short summary.

---

:::exercise
**Paste in chat:**

```
open the course
```

**You should see:**
- Agent runs `npx ai-spector course serve --open` (or links if already running)
- Browser opens the course home
- Agent summarizes this lesson in chat — not the full text
:::

:::roletip
**Everyone** — bookmark the course URL for quick reference.
:::

## If something goes wrong

| Symptom | Say in chat |
|---------|-------------|
| Port already in use | *"course server port is busy"* — close the other window or ask dev |
| Course not found | *"setup ai-spector project"* first (lesson 2) |

---

## Next

[Setup via chat](../02-get-started/01-setup-via-chat.md)
```

- [ ] **Step 2: Write lesson 2** (`02-get-started/01-setup-via-chat.md`)

Key exercise: `setup ai-spector project`  
Structure: same template; explain agent runs setup wizard via `ai-spector-setup` skill; no npm commands in body.

:::behind
Developers can also run `npx ai-spector setup -y` from the terminal.
:::

- [ ] **Step 3: Write lesson 3** (`03-chat-basics/01-how-chat-works.md`)

Key exercise: `help me approve`  
Include plain-language table of common phrases (generate SRS, review documents, add feature) — **no skill names in body**.

- [ ] **Step 4: Verify catalog loads 3 lessons**

Run: `npm test -- tests/course/catalog.test.ts` (update expected count incrementally)

- [ ] **Step 5: Commit**

```bash
git add website/docs/en/01-welcome website/docs/en/02-get-started website/docs/en/03-chat-basics
git commit -m "docs(course): add English essentials lessons 1-3"
```

---

### Task 9: English essentials lessons (4–6)

**Files:**
- Create: `website/docs/en/03-chat-basics/02-four-kinds-of-approve.md`
- Create: `website/docs/en/04-changes/README.md`, `01-add-or-change-requirement.md`
- Create: `website/docs/en/05-generate/README.md`, `01-generate-srs.md`

- [ ] **Step 1: Lesson 4 — Four kinds of approve**

Exercise: `help me approve` — expect four-option menu (doc sign-off / spec / plan / comment). Use table from `scaffold/cursor/WORKFLOW.md` approve disambiguation — plain language only.

- [ ] **Step 2: Lesson 5 — Add or change requirement**

Exercise: `I want to add login with Google`  
Explain: one small change without regenerating entire SRS.

- [ ] **Step 3: Lesson 6 — Generate SRS**

Exercise: `generate the SRS`  
Explain gated flow in plain language: questions → plan table → you say *"yes, go ahead"* → documents appear. No tool names.

- [ ] **Step 4: Commit**

```bash
git add website/docs/en/
git commit -m "docs(course): add English essentials lessons 4-6"
```

---

### Task 10: English essentials lessons (7–9)

**Files:**
- Create: `website/docs/en/06-review/01-document-review.md`, `02-resolve-comments.md`
- Create: `website/docs/en/07-everyday/README.md`, `01-tasks-and-workspace.md`

- [ ] **Step 1: Lesson 7 — Document review**

Exercise: `review documents`  
Target: BA/tester can complete without terminal.

- [ ] **Step 2: Lesson 8 — Resolve comments**

Exercise: `resolve comments`

- [ ] **Step 3: Lesson 9 — Tasks and workspace**

Exercise: `active tasks` then `check my workspace`

- [ ] **Step 4: Update catalog test — expect 9 EN lessons**

In `tests/course/catalog.test.ts`:

```typescript
it("loads 9 essential lessons per locale", async () => {
  const enRoot = await resolveCourseRoot(undefined, "en");
  const pages = await loadCoursePages(enRoot);
  const lessons = pages.filter((p) => /\/\d{2}-.+\.md$/.test(p.relPath));
  expect(lessons.length).toBe(9);
  expect(pages.some((p) => p.slug === "05-generate/01-generate-srs")).toBe(true);
});
```

Run: `npm test -- tests/course/catalog.test.ts`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add website/docs/en/ tests/course/catalog.test.ts
git commit -m "docs(course): complete English essentials (9 lessons)"
```

---

### Task 11: Vietnamese essentials (all 9 lessons)

**Files:**
- Create: `website/docs/vi/**` — mirror EN structure

- [ ] **Step 1: Translate section READMEs and home** (vi/README.md already stubbed in Task 3 — expand)

- [ ] **Step 2: Translate lessons 1–9**

Rules per spec:
- Headings and prose: Vietnamese
- Exercise copy boxes: **English phrases** with VI explanation above each box
- `:::behind` summary text: Vietnamese; skill names allowed inside collapsed block only

Example exercise block in VI lesson:

```markdown
:::exercise
**Dán vào chat (tiếng Anh):**

```
setup ai-spector project
```

**Bạn sẽ thấy:**
- Agent chạy thiết lập dự án
- Không cần gõ lệnh terminal
:::
```

- [ ] **Step 3: Verify 9 VI lessons load**

```typescript
const viRoot = await resolveCourseRoot(undefined, "vi");
const lessons = (await loadCoursePages(viRoot)).filter((p) => /\/\d{2}-.+\.md$/.test(p.relPath));
expect(lessons.length).toBe(9);
```

- [ ] **Step 4: Commit**

```bash
git add website/docs/vi/
git commit -m "docs(course): add Vietnamese essentials (9 lessons)"
```

---

### Task 12: Update agent course skill

**Files:**
- Modify: `scaffold/cursor/skills/ai-spector-course/SKILL.md`
- Modify: `scaffold/cursor/skills/ai-spector-course/references/course-guide.md`
- Modify: `scaffold/claude/.claude/skills/ai-spector-course/` (mirror)
- Modify: `.cursor/skills/ai-spector-course/` if not symlinked from scaffold

- [ ] **Step 1: Update course-guide intent map**

Replace 16-lesson map with essentials table from spec §5. Update URLs:

```
http://127.0.0.1:4177/course/en/<slug>
http://127.0.0.1:4177/course/vi/<slug>
```

- [ ] **Step 2: Update SKILL.md**

- Default open URL: `/course/en/index`
- If user writes Vietnamese, deep-link `/course/vi/…`
- After exercise: link next lesson URL, not task skill (unless user asks to run task)

- [ ] **Step 3: Sync scaffold to .cursor if needed**

Run project scaffold copy script if one exists, or copy manually.

- [ ] **Step 4: Commit**

```bash
git add scaffold/cursor/skills/ai-spector-course/ scaffold/claude/.claude/skills/ai-spector-course/
git commit -m "docs(skill): update ai-spector-course for essentials redesign"
```

---

### Task 13: Fix remaining tests and update spec status

**Files:**
- Modify: `tests/course/catalog.test.ts`
- Modify: `docs/superpowers/specs/2026-06-17-course-redesign-design.md`

- [ ] **Step 1: Fix shell test lesson count**

Update `tests/course/catalog.test.ts`:

```typescript
expect(html).toContain("Lesson 3 of 9");
expect(html).toContain("locale-switch");
```

Fix neighbor test to use new slug path e.g. `02-get-started/01-setup-via-chat` → `03-chat-basics`.

- [ ] **Step 2: Run full course test suite**

Run: `npm test -- tests/course/`  
Expected: all PASS

- [ ] **Step 3: Manual smoke test**

```bash
npx ai-spector course serve --open
```

Verify:
- `/course/en/index` loads
- Locale switcher toggles VI
- Legacy `/course/04-generate/01-generate-srs` redirects
- Exercise callouts render
- Lesson badge shows `of 9`

- [ ] **Step 4: Mark spec approved**

In `docs/superpowers/specs/2026-06-17-course-redesign-design.md`, change status to **Approved**.

- [ ] **Step 5: Commit**

```bash
git add tests/course/ docs/superpowers/specs/2026-06-17-course-redesign-design.md
git commit -m "test(course): update suite for essentials redesign; approve spec"
```

---

## Spec coverage checklist

| Spec requirement | Task |
|------------------|------|
| 9 essentials lessons | Tasks 8–10 (EN), 11 (VI) |
| Bilingual EN + VI | Tasks 1, 11 |
| Locale switcher | Task 5 |
| Chat-first, no jargon | Tasks 8–11 content rules |
| Try it now exercises | Tasks 6, 8–11 |
| Legacy redirects | Task 4 |
| VI fallback banner | Task 7 |
| Advanced coming soon | Task 5 |
| Agent skill update | Task 12 |
| Legacy archive | Task 3 |
| Automated tests | Tasks 1, 4, 6, 7, 10, 13 |

**Phase 2 (advanced module):** out of scope for this plan — separate plan when essentials ship.

---

## Manual QA checklist (post-Task 13)

- [ ] Non-technical reviewer completes EN lesson 7 exercise without terminal
- [ ] VI lesson 1: prose Vietnamese, exercise phrase English
- [ ] Toggle EN ↔ VI on lesson 6 — content switches
- [ ] `npx ai-spector course serve --open` opens `/course/en/index`
