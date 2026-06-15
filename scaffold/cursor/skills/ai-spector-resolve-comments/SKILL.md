---
name: ai-spector-resolve-comments
description: >-
  Resolves git-backed comment threads under comments/ (comments_resolve). NOT formal
  document sign-off — use ai-spector-review and review_approve for that. Use when
  the user asks to resolve comments, address feedback, open threads, C-001 picks,
  or meta_data.json on SRS/basic design. Do not use for approve doc / review queue.
paths:
  - "comments/**"
---

# AI Spector — Resolve comments

**Core:** [../ai-spector/SKILL.md](../ai-spector/SKILL.md)

## Required reading

[references/runbook.md](references/runbook.md) — follow phases in order.

## Checklist

```
- [ ] git pull
- [ ] comments inbox --json → show idePresentation.markdown only
- [ ] user picks C-00N → comments plan
- [ ] edit docs → commit doc + resolve meta (amend)
```

## Natural language

“resolve comments”, “address C-001”, “resolve thread C-012”, “comment inbox”, “feedback on srs/01” → this skill.

**Not** formal document sign-off — “approve srs/01-overview”, “review queue”, “pending client approval” → `ai-spector-review`.
