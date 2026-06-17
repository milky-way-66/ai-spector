# AI Spector Course Redesign — Design Spec

> **Status:** Approved  
> **Date:** 2026-06-17  
> **Scope:** Essentials-first bilingual course (EN + VI), chat-first pedagogy, phased advanced module  
> **Approach:** Parallel locale trees + archived legacy lessons for phase 2

---

## 1. Problem

The current course (`website/docs/`, 7 sections, 16 lessons) is **outdated and too technical** for the intended audience:

| Issue | Detail |
|-------|--------|
| **Audience mismatch** | Written for developers (npm, init, skills, MCP, DAG waves). Many learners are BAs and testers with limited technical background. |
| **Product drift** | Missing detail design, adopt/migrate, slash commands; `init` vs `setup` flow may be stale vs current `WORKFLOW.md`. |
| **Pedagogy** | Explains internals (routing, skills) before practical chat usage. |
| **Language** | English only; team needs Vietnamese. |
| **Length** | 16 lessons cover advanced topics (templates, search, external prototype map) before core daily workflows are mastered. |

### Design decisions (brainstorming)

| Decision | Choice |
|----------|--------|
| Structure | One shared **linear** course |
| Outcome | Use **chat confidently** for day-to-day role — not full pipeline mastery |
| Lesson style | **Read + try** — one concrete chat exercise per lesson |
| Philosophy | **Chat-first** — agent does technical work; learners paste phrases, not CLI commands |
| Language | **Bilingual EN + VI** at launch |
| Scope | **~9 essential lessons** now; **advanced module** in phase 2 |

---

## 2. Goals

### Success criteria (essentials phase)

1. A non-technical BA completes lesson 7 and can run `review documents` in chat without help.
2. Every essential lesson has a **Try it now** exercise with a **You should see** checklist.
3. Course available in **EN and VI** with locale switcher; VI lessons use EN chat phrases in copy boxes.
4. Lesson body contains **no required jargon** (MCP, skill router, DAG wave). Optional *Behind the scenes* collapsible for devs.
5. Agent skill `ai-spector-course` deep-links to new slugs and locales.
6. Old lesson URLs either redirect or show a clear migration note (see §6).

### Out of scope (essentials phase)

- Vietnamese chat phrases (agent routing remains EN-optimized)
- Interactive in-browser chat simulator
- Progress persistence / completion certificates
- Video content
- Full rewrite of advanced lessons (phase 2)

---

## 3. Essentials curriculum

**9 lessons, ~10 min each, single linear path.**

| # | Slug | Lesson | Try in chat | Primary audience |
|---|------|--------|-------------|------------------|
| 1 | `01-welcome/01-what-is-ai-spector` | Welcome — what AI Spector does; you talk, agent works | `open the course` | Everyone |
| 2 | `02-get-started/01-setup-via-chat` | First-time setup via chat, not terminal | `setup ai-spector project` | Everyone |
| 3 | `03-chat-basics/01-how-chat-works` | Phrases, routing, what the agent will do | `help me approve` | Everyone |
| 4 | `03-chat-basics/02-four-kinds-of-approve` | Plan vs doc vs spec vs comment | `help me approve` (practice menu) | BA, tester |
| 5 | `04-changes/01-add-or-change-requirement` | One feature without full regen | `I want to add login with Google` | BA |
| 6 | `05-generate/01-generate-srs` | Clarify → plan → yes → waves | `generate the SRS` | BA, dev |
| 7 | `06-review/01-document-review` | Formal document sign-off | `review documents` | BA, tester |
| 8 | `06-review/02-resolve-comments` | Feedback comment threads | `resolve comments` | BA, tester, dev |
| 9 | `07-everyday/01-tasks-and-workspace` | Resume, pause, check workspace | `active tasks` / `check my workspace` | Everyone |

### Lesson template

Every lesson follows this structure:

1. **Goal** — one sentence, plain language (EN + VI)
2. **You say → Agent does → You see** — example dialogue (no jargon in main text)
3. **Try it now** — boxed exercise; learner completes before moving on
4. **Role tip** — optional 1-line callout: BA / Tester / Dev
5. **If something goes wrong** — chat recovery phrases, not CLI fixes
6. **Behind the scenes** *(optional, collapsed)* — skills/MCP for developers
7. **Next** — link to following lesson

### Jargon rule

Forbidden in lesson body: `MCP`, `skill router`, `DAG wave`, `PRECONDITION_FAILED`, tool names like `task_approve_plan`.

Allowed in plain language: “the agent asks clarifying questions”, “you approve the plan”, “documents are written in waves”.

---

## 4. Bilingual delivery & course UI

### File layout

```text
website/docs/
  en/
    README.md
    01-welcome/
      01-what-is-ai-spector.md
    02-get-started/
      …
    07-everyday/
      01-tasks-and-workspace.md
  vi/
    README.md
    … (mirror en/ structure)
  legacy/                    # archived current 16 lessons — not in nav
    01-get-started/
    …
```

Project override: `docs/course/{locale}/` when present (replaces bundled locale root).

### URL routing

| URL | Content |
|-----|---------|
| `/course/index` | Redirect → `/course/en/index` |
| `/course/en/index` | English home |
| `/course/vi/index` | Vietnamese home |
| `/course/en/05-generate/01-generate-srs` | English lesson |

**Language switcher** in top bar: `EN | VI` — same slug, other locale. If VI file missing → EN content + banner: *“Vietnamese translation not available yet — showing English.”*

### Code changes

| File | Change |
|------|--------|
| `src/core/course/locale.ts` | Add `"vi"` to `CourseLocale`; VI UI strings; update `parseCourseRequest` for `/course/{locale}/…` |
| `src/core/course/catalog.ts` | `resolveCourseRoot(projectRoot, locale)` → `…/docs/{locale}/` or `…/website/docs/{locale}/` |
| `src/core/course/sections.ts` | New section IDs and labels for essentials curriculum |
| `src/core/course/html-shell.ts` | Locale switcher; “Try it now” callout CSS; “Advanced (coming soon)” sidebar group; lesson count 9 |
| `src/core/course/render.ts` | Optional: render `:::exercise` / `:::roletip` / `:::behind` fenced blocks |
| `src/core/course/serve.ts` | Redirect `/course/index`; locale in page load |
| `tests/course/catalog.test.ts` | Update counts, slugs, locale paths |
| `scaffold/cursor/skills/ai-spector-course/` | Updated `course-guide.md`, `SKILL.md` |
| `scaffold/claude/.claude/skills/ai-spector-course/` | Same parity |

### UI elements (essentials)

| Element | Behavior |
|---------|----------|
| Lesson badge | `Lesson 3/9` |
| Try it now box | Styled callout — copy phrase + expected outcomes checklist |
| Role tip | Inline badge: `BA · Tester · Dev` |
| Behind the scenes | `<details>` collapsed by default |
| Advanced section | Sidebar group greyed: “Advanced (coming soon)” |
| Progress bar | Essentials only (9 lessons) |

No full visual redesign — extend existing sidebar + progress layout.

### Content authoring rules (VI)

| Element | Rule |
|---------|------|
| Headings & prose | Vietnamese |
| Chat phrases in exercises | **English** (in copy box) — agent routing is EN-optimized |
| VI lesson text | Explains what the EN phrase means before the copy box |

---

## 5. Agent skill updates

`ai-spector-course` skill and `references/course-guide.md`:

### Intent → lesson map (essentials)

| User asks about… | Slug | Suggested chat after lesson |
|------------------|------|----------------------------|
| Where to start, what is this | `01-welcome/01-what-is-ai-spector` | `open the course` |
| Install, setup, init | `02-get-started/01-setup-via-chat` | `setup ai-spector project` |
| How chat works | `03-chat-basics/01-how-chat-works` | `help me approve` |
| Approve confusion | `03-chat-basics/02-four-kinds-of-approve` | `help me approve` |
| Add one feature | `04-changes/01-add-or-change-requirement` | `I want to add …` |
| Generate SRS | `05-generate/01-generate-srs` | `generate the SRS` |
| Document sign-off | `06-review/01-document-review` | `review documents` |
| Comments | `06-review/02-resolve-comments` | `resolve comments` |
| Resume / workspace | `07-everyday/01-tasks-and-workspace` | `active tasks` |

### Locale behavior

- On `open the course` / `learn ai-spector`: serve course, default EN; if user writes in Vietnamese, deep-link `/course/vi/…`.
- Summarize lesson in chat — do not paste full markdown.
- After exercise: link **next lesson URL**, not task skills (unless bridging e.g. setup lesson → user already completed exercise).

---

## 6. Migration from current course

### Legacy content

Move existing `website/docs/*.md` (flat 7-section tree) to `website/docs/legacy/` **without locale prefix** — preserved for reference and phase 2 rewrite source.

### URL compatibility

| Old URL | New behavior |
|---------|--------------|
| `/course/04-generate/01-generate-srs` | 302 → `/course/en/05-generate/01-generate-srs` (closest essentials match) |
| `/course/02-chat-basics/01-how-chat-works` | 302 → `/course/en/03-chat-basics/01-how-chat-works` |
| Unmapped legacy slugs | 302 → `/course/en/index` with query `?migrated=1` |

Redirect map maintained in `src/core/course/redirects.ts` (new file, slug → slug table).

### Dev symlink

If `docs/course` symlinks to `website/docs`, update to `website/docs/en` or document that overrides use `docs/course/en/`.

### Tests & CI

- `catalog.test.ts`: expect 9 lessons per locale (+ section READMEs)
- Add `locale.test.ts`: VI root resolution, fallback banner
- Add redirect tests for top 5 legacy slugs

---

## 7. Phase 2 — Advanced module (later)

Ship after essentials validated with real users. Not linked in sidebar until ready.

### Planned advanced lessons (rewrite from legacy)

| Section | Lessons (from legacy + new) |
|---------|---------------------------|
| Graph & sources | Analyze, validate, index, explore |
| Generate (extended) | Basic design, detail design, spec approval |
| Prototype | Translations, HTML mockup, external URL map |
| Review (extended) | Client web review handover |
| Advanced | Custom templates, semantic search |
| Adopt | Migrate existing docs (new) |

### Phase 2 structure

```text
website/docs/
  en/
    01-essentials/ … (or keep flat 01–07 as now)
    08-advanced/
      …
  vi/
    08-advanced/
      …
```

Sidebar: essentials complete → “Continue to Advanced” unlocks when phase 2 ships.

### Phase 2 success criteria

1. Advanced lessons use same chat-first template and bilingual rules.
2. Legacy `website/docs/legacy/` can be deleted after all topics rewritten.
3. Total advanced count ~10–12 lessons.

---

## 8. Error handling & edge cases

| Scenario | Handling |
|----------|----------|
| Course files missing | Existing `CourseNotFoundError` message; update paths to mention `{locale}/` |
| VI lesson missing | Show EN + banner |
| User on lesson 5 without project setup | Lesson 2 troubleshooting: “say `setup ai-spector project` first” |
| MCP not configured | Lesson 2 *Behind the scenes*: dev can use CLI; exercises still work via agent fallback |
| Port 4177 busy | Existing skill guidance — retry or close other instance |
| Exercise fails in chat | Lesson “If something goes wrong” table; agent routes to `ai-spector-check` or setup skill |
| User mixes VI chat with EN | Agent may mis-route — VI lessons explicitly say “paste the English phrase below” |

---

## 9. Testing plan

### Manual

1. Complete all 9 lessons EN — each exercise succeeds in a fresh project.
2. Complete lessons 1, 3, 4, 7 in VI — UI strings Vietnamese; copy boxes English.
3. Toggle EN ↔ VI on lesson 6 — same slug, content switches.
4. Hit legacy URL `/course/04-generate/01-generate-srs` — lands on correct EN lesson.
5. Non-technical reviewer: can finish lesson 7 without using terminal.

### Automated

- Catalog loads 9 lessons × 2 locales
- `parseCourseRequest` parses `/course/vi/06-review/01-document-review`
- Redirect table covers legacy slugs
- HTML shell contains locale switcher and exercise callout class
- `buildCoursePageHtml` shows `Lesson N of 9`

---

## 10. Implementation order

| Step | Work |
|------|------|
| 1 | Locale infrastructure (`locale.ts`, `catalog.ts`, `serve.ts`, redirects) |
| 2 | Move legacy content; scaffold `en/` + `vi/` trees |
| 3 | Write EN essentials (9 lessons) |
| 4 | UI: switcher, exercise callout, section labels |
| 5 | Translate VI essentials |
| 6 | Update agent skills + course-guide |
| 7 | Tests + manual QA |
| 8 | Phase 2 planning (separate spec when essentials ship) |

---

## 11. Open questions (resolved)

| Question | Resolution |
|----------|------------|
| Linear vs role tracks | Linear |
| End outcome | Day-to-day chat for role |
| Lesson format | Read + try |
| Technical depth | Chat-first; agent does work |
| Language | Bilingual EN + VI |
| Scope | Essentials first, advanced later |
| Bilingual approach | Parallel locale trees (recommended) |
| VI chat phrases | EN phrases in copy boxes only |

---

## 12. References

- Current course: `website/docs/`
- Course server: `src/core/course/`
- Workflow truth source: `scaffold/cursor/WORKFLOW.md`
- Agent skill: `scaffold/cursor/skills/ai-spector-course/`
- Prior spec format: `docs/superpowers/specs/2026-06-17-resolve-task-superpowers-design.md`
