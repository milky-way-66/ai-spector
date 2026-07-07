# Remove adopt workflow — self-service project migration

**Date:** 2026-07-07  
**Status:** Approved  
**Product:** ai-spector

## Problem

The gated `adopt` workflow (scan → plan → apply → bootstrap → validate) does not scale to real projects: too many layout edge cases, brittle gates, and overlap with docops contract migration without replacing user judgment about where docs live.

## Decision

**Hard remove** adopt CLI, MCP tools, task kind, and ADOPT-001 rule.

**Replace with** self-service migration:

1. `docops check --prompt` — contract gaps + agent fix list
2. `docops layout` (new, read-only) — disk vs config inventory + suggestions (no file moves)
3. `.docops/guide/MIGRATION.md` + new `PROJECT_LAYOUT.md` — user/agent guides paths and templates
4. User edits `docops.config.json` (`docTypes.*.path`, languages, templates) to match their repo

## Hard rules (user-facing)

- Prefer **pointing `docTypes.path` at existing folders** over moving markdown
- `docops migrate --repair` fills contract gaps only (no overwrite)
- No automated `git mv` of doc content

## Lifecycle

`legacy-aligned` step unchanged: probe `layout === docops` + `writerReady` (no adopt setup gate).

## Out of scope

- Automated file relocation
- Adopt work sessions / plan approval
- Deprecation period (hard remove in next release)
