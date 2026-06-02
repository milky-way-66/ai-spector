---
name: ai-spector-generate-prototype
description: >-
  Generates static HTML/CSS/JS screen prototypes from basic-design screen specs and bundled UI themes.
  Use when the user asks for HTML prototype, screen mockups, prototype/src files, or to pick a theme
  (vercel, stripe, etc.). Do not use for markdown SRS/basic/detail design only, or graph operations
  without HTML output.
paths:
  - "prototype/**"
---

# AI Spector — Generate prototype

**Core:** [../ai-spector/SKILL.md](../ai-spector/SKILL.md)

## Required reading

[references/runbook.md](references/runbook.md) — theme setup, manifest, HTML rules.

## Checklist

```
- [ ] list-screens + screen detail docs exist
- [ ] prototype setup --theme <name>
- [ ] one .html per screen; prototypeStem from manifest
- [ ] prototype manifest && prototype validate --strict
```

## Natural language

“HTML prototype”, “mockup screens”, “prototype with stripe theme” → this skill.

Constraints: `prototype/CLAUDE.md` in the project repo.
