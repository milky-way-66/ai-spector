# Workspace & tasks

**Section:** [Chat basics](README.md) · **Course:** [Home](../README.md)  
**Time:** ~10 min · **Before:** [How chat works](01-how-chat-works.md)

**Goal:** Audit project health and resume paused work.

---

## Check workspace

```
check my workspace
```

```
why did pre-commit block me
```

```
stale clarifications
```

CLI: `npx ai-spector setup --check`

Use after init, upgrades, or failed commits.

---

## What you should see (workspace check)

- Table of findings: rule, severity, message, fix hint.
- Optional `fix: true` for auto-fixable items.
- No edits to `docs/` — audit only.

---

## Tasks & resume

Generation runs are **tasks** with saved state (clarifications, plans, wave progress).

```
active tasks
```

```
resume my SRS
```

```
pause task
```

| Phrase | Means |
|--------|-------|
| *resume SRS* | Continue a **generation task** |
| *review documents* | **Document sign-off** (different workflow) |
| *continue* during active review | Resumes **review session**, not task — name the doc if unsure |

---

## What you should see (tasks)

- `task_list` shows task id, kind (generate / resolve), plan approved or not.
- `resume my SRS` continues from last wave or plan gate — not from scratch.
- Paused task persists under `.ai-spector/.docflow/tasks/`.

---

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| No active tasks | Start `generate the SRS` or resolve-task again |
| Resume does wrong thing | Check for active review session; say *"resume generation task"* |
| Pre-commit blocked | Run `check my workspace`; read hook output |

---

## Next

[Incremental changes](03-incremental-changes.md)
