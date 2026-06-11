---
name: ai-spector-review
description: >-
  Document review and approval workflow: check for changed documents, approve
  documents for internal review, view the review queue with diffs, dismiss
  trivial changes. Use when the user asks to review, approve, or check document
  status, mentions "pending review", "needs review", "client approval", "review
  queue", or "what changed since last approval". Do not use for comment threads
  — use ai-spector-resolve-comments for those.
paths:
  - "reviews/**"
---

# AI Spector — Document Review

**Core:** [../ai-spector/SKILL.md](../ai-spector/SKILL.md)

## Required reading

[references/runbook.md](references/runbook.md) — follow phases in order.

## Checklist

```
- [ ] review check (detect changed documents)
- [ ] review queue --track internal (show what needs review)
- [ ] user picks document → review status <path> (show diff)
- [ ] user confirms → review approve <path> --by <name>
```

## Natural language

"review documents", "approve the SRS", "what needs review", "check review status",
"review queue", "pending client approval", "what changed since last approval" → this skill.
