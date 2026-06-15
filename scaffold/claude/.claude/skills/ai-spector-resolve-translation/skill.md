---
name: ai-spector-resolve-translation
description: >-
  Processes pending translation queue jobs: read origin and per-document changes, merge multi-lang
  edits when needed, translate or backport whole files, then index to resolve jobs. Use when the user
  asks to resolve translations, sync stale languages, update JP/VI from EN, process the translation
  queue, or backport secondary language edits. Do not use for checking status only — use
  ai-spector-lang-status.
---

# AI Spector — Resolve translations

**Core:** [../ai-spector/skill.md](../ai-spector/skill.md)  
**Status only:** [../ai-spector-lang-status/skill.md](../ai-spector-lang-status/skill.md)

## Required reading

[references/runbook.md](references/runbook.md) — follow phases in order.

## Checklist

```
- [ ] docflow.config.json → languages[]
- [ ] lang queue pending --json (optional --lang <code>)
- [ ] per job: read changes/{docType}--{path}.json if merged or fine-grained merge needed
- [ ] write target file(s) — whole file, translation rules enforced
- [ ] npx ai-spector index → jobs move to resolved
```

## Natural language

“resolve translations”, “sync JP translations”, “process translation queue”, “update stale VI”, “backport JP changes to EN” → this skill.
