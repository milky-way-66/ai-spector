---
sidebar_position: 1
---

# AI Spector Course

Documentation workflow in **Cursor** or **Claude Code**: traceability graph, SRS, basic design, prototypes. **Describe what you need in chat.**

`npx ai-spector course serve --open` · Tiếng Việt: `--lang vi` → `/course/vi/`

**In chat:** *"open the course"* · *"learn ai-spector"* · *"mở khóa học ai-spector"*

---

## Structure

**7 sections, 13 lessons** — each lesson ~10–15 min, one coherent task.

| Section | Lessons | Covers |
|---------|---------|--------|
| [Get started](01-get-started/README.md) | 2 | Install, init, skills |
| [Chat basics](02-chat-basics/README.md) | 2 | Routing, workspace, tasks |
| [Graph & sources](03-graph/README.md) | 2 | Analyze, validate, index |
| [Generate documents](04-generate/README.md) | 2 | SRS (gated) + basic design |
| [Design & prototype](05-prototype/README.md) | 2 | Translations, UI mockup |
| [Review & changes](06-review/README.md) | 1 | Sign-off, comments, edits |
| [Advanced](07-advanced/README.md) | 2 | Templates, search, editors |

---

## Pipeline

```text
docs/data-source/ → analyze → validate → generate SRS (gated) → basic design
  → prototype → review documents
```

Every **generate** run: workspace check → clarify → plan approval → waves → spec review.

---

## Quick paths

| Goal | Follow |
|------|--------|
| First project | Get started → Chat → Graph → Generate |
| Standard delivery | + Prototype → Review |
| Multi-language | Add [Translations](05-prototype/01-translations.md) after SRS |
| Custom SRS | [Custom templates](07-advanced/01-custom-templates.md) before Graph |

---

## Next

[Get started](01-get-started/README.md)
