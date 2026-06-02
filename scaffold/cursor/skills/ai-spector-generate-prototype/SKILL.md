---
name: ai-spector-generate-prototype
description: >-
  Generates static HTML/CSS/JS screen prototypes from basic-design screen specs and bundled UI themes.
  Use when the user asks for HTML prototype, screen mockups, or prototype/src files. Asks user to
  choose a theme if none is stored; uses stored preference on subsequent runs. Do not use for
  markdown SRS/basic/detail design only, or graph operations without HTML output.
paths:
  - "prototype/**"
---

# AI Spector — Generate prototype

**Core:** [../ai-spector/SKILL.md](../ai-spector/SKILL.md)

## Required reading

[references/runbook.md](references/runbook.md) — theme resolution (no upfront picker), manifest, HTML rules.

## Checklist

```
- [ ] list-screens + screen detail docs exist
- [ ] theme resolved (request → theme.json → manifest → prototype.config.json → **ask user if none stored**)
- [ ] prototype setup (with --theme when needed; persists when user named a theme)
- [ ] one .html per screen; prototypeStem from manifest
- [ ] prototype manifest && prototype validate --strict
```

## Natural language

“HTML prototype”, “mockup screens”, “prototype with stripe theme” → this skill.

Constraints: `prototype/CLAUDE.md` in the project repo.
