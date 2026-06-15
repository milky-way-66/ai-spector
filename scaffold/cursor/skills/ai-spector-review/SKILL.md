---
name: ai-spector-review
description: >-
  Formal document sign-off workflow (MCP review_approve). NOT for comment threads
  (comments_resolve / ai-spector-resolve-comments), extracted specs (spec_approve /
  SPEC-NNN), or task plans (task_approve_plan). Use for /review, review queue,
  approve doc by logical path (srs/01-overview), pending client approval, what
  changed since last sign-off. Agent must read the doc, check graph impact, write
  a review summary, then wait for user decision before review_approve.
paths:
  - ".ai-spector/.docflow/review-queue/**"
  - "docs/**"
---

# AI Spector — Document Review

## Subagent worker

**workflowId:** `doc-review` · **Brief:** [../../subagents/doc-review.md](../../subagents/doc-review.md)

Orchestrator spawns this worker. Workers do not call `workflow_route` or read `_skill-router.md`.

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
- [ ] review_session_ack_review → unlock approve gate
- [ ] wait for user        → approve / request changes / dismiss
- [ ] review approve / reject (if approved)
- [ ] git commit .ai-spector/.docflow/review-queue/ (if team-shared)
```

## Natural language triggers

"review documents", "approve the SRS", "what needs review", "review queue",
"pending client approval", "what changed since last approval",
"review srs/01-overview", "is this doc ready to approve" → this skill.
