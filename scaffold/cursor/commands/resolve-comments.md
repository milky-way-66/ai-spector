# Resolve comment threads

Git-backed **comment threads** — not formal document sign-off, specs, or task plans.

## Orchestrator

Spawn **`resolve-comments`** worker — brief: [../subagents/resolve-comments.md](../subagents/resolve-comments.md)

## Worker steps (MCP preferred)

| Phase | Action |
|-------|--------|
| 0 | `git pull` |
| 1 | `comments_inbox` — show table; **wait for user to pick C-NNN** |
| 2 | `comments_plan` for chosen thread |
| 3 | Edit docs → **one commit: doc + comment meta** (amend) |
| 4 | `comments_resolve` |

## Optional shortcuts

- **`/resolve-comments C-012`** — start with that thread id

## Not this command

| You mean | Use instead |
|----------|-------------|
| Approve srs/01-overview | `/review` |
| Approve SPEC-003 | "approve SPEC-003" |
| Yes to plan table | "yes, go ahead" (task approval) |

Routing: [skills/_skill-router.md](../skills/_skill-router.md) · Subagents: [subagents/README.md](../subagents/README.md)
