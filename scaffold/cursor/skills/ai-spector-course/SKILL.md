---
name: ai-spector-course
description: >-
  Opens and guides users through the AI Spector interactive course. Use when the user asks to
  learn ai-spector, open the course, see tutorials, walkthrough, onboarding, "how do I use this",
  "show me how", "where do I start", "teach me", "mở khóa học", "khóa học tiếng Việt",
  "hướng dẫn tôi dùng ai-spector", or wants help understanding workflow steps
  without running a task yet. Do NOT use for setup execution (→ ai-spector-setup) or running
  analyze/generate/review tasks — route those to task skills after pointing at the right lesson.
---

# AI Spector — Course guide

**Read first:** [references/course-guide.md](references/course-guide.md)

## When this skill activates

Natural language: *"open the course"*, *"learn ai-spector"*, *"show me the tutorial"*, *"how does chat work"*, *"walk me through setup"*, *"where is the course"*, *"help me get started"* (learning intent, not bootstrap).

## Agent workflow

1. **Open the course in the browser** (if not already running):

   ```bash
   npx ai-spector course serve --open              # English
   npx ai-spector course serve --open --lang vi    # Vietnamese
   ```

   Default URLs: `http://127.0.0.1:4177/course/index` (en) · `http://127.0.0.1:4177/course/vi/index` (vi).

2. **Pick the best lesson** from [references/course-guide.md](references/course-guide.md) based on the user's question. Link directly:

   `http://127.0.0.1:4177/course/<slug>`

   Example slugs: `01-get-started/01-prerequisites-and-init`, `02-chat-basics/01-how-chat-works`.

3. **Read the matching markdown** under `website/docs/` (or `docs/course/` via symlink) and summarize the key steps in chat — do not paste the whole lesson.

4. **Offer the next action** — e.g. after setup lesson → `"setup ai-spector project"`; after chat lesson → `"analyze my data source"`.

## Boundaries

| User wants | Route to |
|------------|----------|
| Actually run setup | `ai-spector-setup` |
| Run analyze / generate / review | matching task skill |
| Only browse / learn | this skill |

## Course source files

| Item | Path |
|------|------|
| Course index | `website/docs/README.md` · Vietnamese: `website/docs/vi/README.md` |
| Course home | `website/docs/README.md` |
| Lessons | `website/docs/<section>/` |

`docs/course/` is a symlink to `website/docs/` for npm and CLI. If missing locally, the bundled package still ships course files.
