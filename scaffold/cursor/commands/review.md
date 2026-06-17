# Review documents

**Routing override:** activate **`ai-spector-review`** immediately.

Formal **document sign-off** (`review_approve`) — not comment threads, extracted specs, or task plans.

Read `.cursor/skills/ai-spector-review/SKILL.md` and `references/runbook.md` before any tool call.

## Phases (MCP preferred)

| Phase | Action |
|-------|--------|
| 0 | `review_check({})` |
| 1 | `review_queue` — show table; **wait for user to pick** |
| 2 | `review_status` + read doc + readiness checklist |
| 3 | `graph_impact` on document path |
| 4 | Write structured review in chat |
| 4b | `review_session_ack_review` |
| 5 | Decision menu — **wait for user** |
| 6 | On **Approve** only → `review_approve` |

## Shortcuts

- **`/review srs/01-overview`** — skip queue; review that logical path directly

## Not this command

| You mean | Use instead |
|----------|-------------|
| Resolve comment C-012 | `/resolve-comments` |
| Approve SPEC-003 | `spec_approve` |
| Yes to a plan table | `task_approve_plan` |

Routing: [skills/_skill-router.md](../skills/_skill-router.md)
