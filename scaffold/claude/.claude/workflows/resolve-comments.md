# Resolve comments

**Workflow trigger:** activate **`ai-spector-resolve-comments`**.

Read `.claude/skills/ai-spector-resolve-comments/skill.md` and `references/runbook.md`.

## Steps

1. `comments_inbox` — show table; user picks thread(s)
2. Plan changes in chat
3. Apply edits — **one commit** must include both doc and `comments/` meta

## Not this command

| You mean | Use instead |
|----------|-------------|
| Formal document sign-off | `workflow: review` |
| Mark thread done without doc edit | `comments_resolve` after review |
