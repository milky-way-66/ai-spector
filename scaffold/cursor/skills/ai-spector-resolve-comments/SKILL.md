---
name: ai-spector-resolve-comments
description: >-
  AI Spector git-backed review comment resolve — list open threads, pick C-001, plan with impact,
  propose doc fix, commit doc + comment meta. Use for /resolve-comments, comments/ folder,
  meta_data.json, reviewer comments on SRS/basic design, or "resolve this comment thread".
---

# AI Spector — Resolve comments

**Core rules:** `.cursor/skills/ai-spector/SKILL.md`
**Full workflow:** `.cursor/commands/resolve-comments.md` (follow step-by-step)

## Quick flow

1. `git pull`
2. `ai-spector comments inbox --json` → show **`idePresentation.markdown`** only (thread table, pick ids)
3. User picks **C-00N** → `ai-spector comments plan C-00N --json` (impact + anchor)
4. Propose edit → user approves → apply to `docs/…`
5. Commit doc → `comments resolve` → amend commit with **doc + `comments/…/thread/`** → push

## CLI

| Step | Command |
|------|---------|
| Inbox | `ai-spector comments inbox --json` |
| Plan | `ai-spector comments plan C-001 --json` |
| Resolve meta | `ai-spector comments resolve <threadId> --file <logical_path> --expected-version <v>` |

## Natural language → this skill

| User says | Action |
|-----------|--------|
| "resolve comments", "fix review comments", "open comment threads" | Start inbox flow |
| "address C-001", "resolve thread on srs/…" | `plan` then edit + commit |
| "comments under comments/" | Git-only F-05 flow — no Writer API |

## Guardrails

- Inbox: thread table only — no raw JSON or thread uuids in chat
- Commit must include **changed doc file** and comment meta (amend pattern in `resolve-comments.md`)
- No resolve before doc fix is applied
