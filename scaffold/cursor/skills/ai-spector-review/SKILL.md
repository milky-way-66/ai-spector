---
name: ai-spector-review
description: >-
  Document review and approval workflow: the agent reads changed documents,
  understands what changed, checks graph impact, gives a written review
  summary with a recommendation, then asks the user to approve, request
  changes, or dismiss. Use when the user asks to review documents, approve
  a document, check what changed since last approval, view the review queue,
  or mentions "pending review", "needs review", "client approval", or
  "what changed". Do not use for comment threads — use
  ai-spector-resolve-comments for those.
paths:
  - "reviews/**"
---

# AI Spector — Document Review

**Core:** [../ai-spector/SKILL.md](../ai-spector/SKILL.md)

## Required reading

[references/runbook.md](references/runbook.md) — follow phases in order.

## What makes this skill different from mechanical approve

The agent does not just show a diff and ask "approve?".  
It **reads the document**, **understands the change in context**, **checks graph impact**, and **writes a review** before asking the user to decide.

## Checklist

```
- [ ] review check         → find changed documents
- [ ] review queue         → show pending table, wait for user pick
- [ ] read document        → understand current content, not just diff
- [ ] graph_impact         → check downstream blast radius
- [ ] write review summary → what changed, why it matters, concerns, recommendation
- [ ] wait for user        → approve / request changes / dismiss
- [ ] review approve / reject (if approved)
- [ ] git commit reviews/
```

## Natural language triggers

"review documents", "approve the SRS", "what needs review", "review queue",
"pending client approval", "what changed since last approval",
"review srs/01-overview", "is this doc ready to approve" → this skill.
