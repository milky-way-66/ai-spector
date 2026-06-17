---
name: ai-spector-resolve-prototype-comments
description: >-
  Resolves prototype HTML review comments in batch (B-00N screen batches or cross-screen
  picks). Gated workflow: clarify → propose approaches → execution plan → explicit yes →
  edit HTML → batch-resolve meta. NOT document comments (ai-spector-resolve-comments)
  or formal sign-off (ai-spector-review). Use for "resolve prototype comments",
  "resolve all comments on login screen", B-001 batch picks.
---

# AI Spector — Resolve prototype comments

**Core:** [../ai-spector/skill.md](../ai-spector/skill.md)

## Required reading

[references/runbook.md](references/runbook.md) — follow phases in order. **No file state** — plan lives in chat; user **yes** is the gate.

## Checklist

```
- [ ] git pull
- [ ] comments facets or inbox --type prototype --group screen
- [ ] user picks B-00N / screen / cross-screen picks
- [ ] comments batch-plan → clarify → 2–3 approaches → execution plan
- [ ] wait explicit yes
- [ ] edit prototype HTML → commit → comments batch-resolve
```

## Natural language

"resolve prototype comments", "resolve all comments on login screen", "batch B-001", "fix prototype feedback on login and home" → this skill.

**Not** document line comments → `ai-spector-resolve-comments`. **Not** approve doc → `ai-spector-review`.
