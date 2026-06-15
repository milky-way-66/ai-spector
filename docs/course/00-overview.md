# AI Spector — Course Overview

Documentation workflow in **Cursor** or **Claude Code**: traceability graph, SRS, basic design, prototypes. **Describe what you need in chat.**

Browse: `npx ai-spector course serve --open`

---

## Structure

**7 sections, 13 lessons** — each lesson ~10–15 min, one coherent task. No micro-steps for things you do in a single sitting.

| Section | Lessons |
|---------|---------|
| [Get started](01-get-started/README.md) | Prerequisites & init · Setup & skills |
| [Chat basics](02-chat-basics/README.md) | How chat works · Workspace & tasks |
| [Graph & sources](03-graph/README.md) | Sources & analyze · Validate & explore |
| [Generate documents](04-generate/README.md) | Generate SRS · Basic design |
| [Design & prototype](05-prototype/README.md) | Translations *(opt)* · Build prototype |
| [Review & changes](06-review/README.md) | Review, comments & incremental edits |
| [Advanced](07-advanced/README.md) | Custom templates · Search & editors |

---

## Pipeline

```text
docs/data-source/ → analyze → validate → generate SRS (gated) → basic design
  → prototype → review documents
```

Every **generate** run: workspace check → clarify → plan approval → waves → spec review.

---

## Next

[Get started](01-get-started/README.md)
