---
name: ai-spector-generate-prototype
description: >-
  Generates static HTML/CSS/JS screen prototypes from basic-design screen specs and bundled UI themes.
  Use when the user asks for HTML prototype, screen mockups, or prototype/src files. When no theme is
  stored, recommends 3 best-fit themes from project context, opens preview samples in the browser,
  and waits for the user to choose before setup. Uses stored preference on subsequent runs. Do not use
  for markdown SRS/basic/detail design only, or graph operations without HTML output.
paths:
  - "prototype/**"
---

# AI Spector — Generate prototype

**Core:** [../ai-spector/SKILL.md](../ai-spector/SKILL.md)

## Required reading

- [references/runbook.md](references/runbook.md) — manifest, HTML rules, theme resolution
- [references/auth-picker.md](references/auth-picker.md) — **when no basic auth stored**: ask username/password, create htpasswd
- [references/theme-picker.md](references/theme-picker.md) — **when no theme stored**: recommend 3, preview, confirm

## Checklist

```
- [ ] language confirmed (language-picker.md — check before writing any screen text content)
- [ ] list-screens + screen detail docs exist
- [ ] basic auth resolved (config basicAuth + prototype/htpasswd → **auth picker if none**)
- [ ] theme resolved (request → theme.json → manifest → config → **theme picker if none**)
- [ ] if picker: 3 recommendations + previews opened + user confirmed before setup
- [ ] prototype setup (with --theme when needed; persists when user named a theme)
- [ ] one .html per screen; prototypeStem from manifest
- [ ] prototype manifest && prototype validate --strict
```

## Natural language

“HTML prototype”, “mockup screens”, “prototype with stripe theme” → this skill.

“Help me pick a theme”, “what theme fits my app?”, “show me theme options” → [theme-picker.md](references/theme-picker.md) (even before generating).

Constraints: `prototype/CLAUDE.md` in the project repo.
