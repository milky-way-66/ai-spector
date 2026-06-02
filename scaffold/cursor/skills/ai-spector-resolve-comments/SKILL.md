---
name: ai-spector-resolve-comments
description: >-
  Resolves git-backed review comment threads under comments/: inbox listing, impact plan, doc edits,
  and meta_data.json updates with amend commits. Use when the user asks to resolve comments, address
  review feedback, open threads, C-001 picks, or meta_data.json on SRS/basic design. Do not use for
  greenfield generation without review threads.
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

“resolve comments”, “address C-001”, “review thread on srs” → this skill.
