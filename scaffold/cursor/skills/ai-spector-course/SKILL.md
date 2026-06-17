---
name: ai-spector-course
description: >-
  Opens and guides users through the AI Spector interactive course. Use when the user asks to
  learn ai-spector, open the course, see tutorials, walkthrough, onboarding, "how do I use this",
  "show me how", "where do I start", "teach me", or wants help understanding workflow steps
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
   npx ai-spector course serve --open
   ```

   Default URL: `http://127.0.0.1:4177/course/en/index`

2. **Pick the best lesson** from [references/course-guide.md](references/course-guide.md). Link directly:

   `http://127.0.0.1:4177/course/{locale}/<slug>`

   Use `vi` locale when the user writes in Vietnamese.

   Example slugs: `02-get-started/01-setup-via-chat`, `03-chat-basics/01-how-chat-works`.

3. **Read the matching markdown** under `website/docs/en/` or `website/docs/vi/` and summarize — do not paste the whole lesson.

4. **After exercise:** link the **next lesson URL**. Route to task skills only when the user asks to run the task, not automatically.

## Boundaries

| User wants | Route to |
|------------|----------|
| Actually run setup | `ai-spector-setup` |
| Run analyze / generate / review | matching task skill |
| Only browse / learn | this skill |

## Course source files

| Item | Path |
|------|------|
| EN course | `website/docs/en/` |
| VI course | `website/docs/vi/` |
| Project override | `docs/course/en/` or `docs/course/vi/` |

Essentials: **9 lessons**. Advanced module ships later. |
