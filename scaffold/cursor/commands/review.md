# Review documents

Formal **document sign-off** — not comment threads, extracted specs, or task plans.

## Start here

1. Activate skill **`ai-spector-review`**
2. Read `.cursor/skills/ai-spector-review/references/runbook.md`

## Agent steps (MCP preferred)

| Phase | Action |
|-------|--------|
| 0 | `review_check({})` — find changed documents |
| 1 | `review_queue({ track: "internal" })` — show table; **wait for user to pick** |
| 2 | `review_status({ logicalPath, showDiff: true })` + read the doc file |
| 3 | `graph_impact` on the document path |
| 4 | Write structured review in chat (summary, diff, impact, recommendation) |
| 4b | `review_session_ack_review({ logicalPath })` |
| 5 | Show decision menu; **wait for user reply** |
| 6 | On **Approve** only → `review_approve({ logicalPath, by })` |

## Optional shortcuts

- **`/review srs/01-overview`** — skip queue; go straight to that document
- **`/review approve …`** — still run phases 2–4 before approving

## Not this command

| You mean | Use instead |
|----------|-------------|
| Resolve comment C-012 | `/resolve-comments` or "resolve C-012" |
| Approve SPEC-003 | "approve SPEC-003" (spec queue) |
| Yes to a plan table | "yes, go ahead" after plan (task approval) |

Routing details: [skills/_skill-router.md](../skills/_skill-router.md)
