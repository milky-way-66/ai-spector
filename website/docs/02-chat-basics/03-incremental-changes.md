# Incremental changes

**Section:** [Chat basics](README.md) · **Course:** [Home](../README.md)  
**Time:** ~10 min · **Before:** [Workspace & tasks](02-workspace-and-tasks.md)

**Goal:** Add or update one feature or section without regenerating the whole SRS.

---

## When to use this

| Situation | Use | Not this |
|-----------|-----|----------|
| Add login with Google, update one API section | **resolve-task** | `generate the SRS` |
| Write a full chapter from the graph | generate-srs | resolve-task |
| Sign off a finished document | ai-spector-review | resolve-task |

Skill: **`ai-spector-resolve-task`**

---

## Start

```
I want to add login with Google
```

or *"update the auth section"*, *"add requirement for password reset"*.

The agent creates a **task** — no edits yet.

---

## What you should see

1. **Clarifying questions** — scope, target docs, constraints (answers stored for later).
2. **GoalSpec + TaskPlan table** — what will change, which files, graph impact planned.
3. Agent **waits** for your explicit **yes** — reply `yes, go ahead` or `task_approve_plan`.
4. After approval: targeted edits under `docs/` or `prototype/`, then `index` if needed.
5. Task marked complete when done.

**On disk:** changed doc files only — not a full `docs/srs/` rewrite.

---

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| Agent jumps to full SRS generate | Say *"this is one feature only"* — route to resolve-task |
| Edits before you said yes | Stop agent; plan approval (`task_approve_plan`) was skipped |
| Wrong section updated | Clarify logical path: *"update srs/03-features not overview"* |

---

## Next section

[Graph & sources](../03-graph/README.md)
