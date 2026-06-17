# Check workspace

**Routing override:** activate **`ai-spector-check`**.

Read `.cursor/skills/ai-spector-check/SKILL.md`.

## Steps

1. `workspace_check({})` — show findings table
2. Optional: `context_list` for stale clarifications
3. Offer `workspace_check({ fix: true })` only when user agrees

Does **not** start generate or resolve workflows.
