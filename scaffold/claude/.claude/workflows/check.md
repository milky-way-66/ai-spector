# Check workspace

**Workflow trigger:** activate **`ai-spector-check`**.

Read `.claude/skills/ai-spector-check/skill.md`.

## Steps

1. `workspace_check({})` — show findings table
2. Optional: `context_list` for stale clarifications
3. Offer `workspace_check({ fix: true })` only when user agrees

Does **not** start generate or resolve workflows.
