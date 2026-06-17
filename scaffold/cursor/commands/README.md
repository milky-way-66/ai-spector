# Slash commands (routing override)

Natural language usually works — Cursor matches skill `description` and [skills/_skill-router.md](../skills/_skill-router.md).

When routing picks the **wrong workflow**, use a slash command. **The command wins** over skill matching for that turn.

**Claude Code** has no slash commands — use **`workflow: <name>`** instead (e.g. `workflow: generate-detail-design`). Same runbooks live under `.claude/workflows/` after `npx ai-spector init --target claude` or `sync-claude`.

| Command | Skill | Use when |
|---------|-------|----------|
| `/generate-srs` | `ai-spector-generate-srs` | Full SRS from graph (gated generate) |
| `/generate-basic-design` | `ai-spector-generate-basic-design` | Screen/API basic design (gated generate) |
| `/generate-detail-design` | `ai-spector-generate-detail-design` | Detail design from graph — **not** resolve-task |
| `/resolve-task` | `ai-spector-resolve-task` | Incremental add/update ("add login", "update section") |
| `/review` | `ai-spector-review` | Document sign-off (`review_approve`) |
| `/task` | `ai-spector-task` | Resume or list active generation/resolve tasks |
| `/check` | `ai-spector-check` | Workspace structure, pre-commit blockers, clarifications |
| `/graph` | `ai-spector-graph` | Analyze data source, index, validate graph |
| `/resolve-comments` | `ai-spector-resolve-comments` | Comment inbox → plan → commit |
| `/adopt` | `ai-spector-adopt` | Migrate legacy docs into ai-spector layout |

Still unsure? Say **"help me approve"** or ask the agent to call **`workflow_route({ message })`**.

Pipeline overview: [../WORKFLOW.md](../WORKFLOW.md)
