# Resolve Task — conversational runbook

Tiered plan-first workflow for incremental doc/graph changes. The agent **never edits or runs impact** until the user approves a written plan.

**Tier routing:** [tier-router.md](./tier-router.md) — propose Fast/Standard/Full after Phase 1.

| Tier | Extended runbook |
|------|------------------|
| Fast | This file (Phases 2–7 below) |
| Standard | [resolve-standard.md](./resolve-standard.md) |
| Full | [resolve-full.md](./resolve-full.md) |
| Execute / verify | [resolve-execute.md](./resolve-execute.md) |

---

## Routing — when this runbook applies

| User intent | Skill |
|-------------|-------|
| Add / update / change one feature, section, or requirement | **resolve-task** (this runbook) |
| "I want to…", "we need to…", "create a task" | **resolve-task** |
| Generate full SRS chapter or DAG wave from graph | `ai-spector-generate-srs` |
| Generate screen list, API list, basic design wave | `ai-spector-generate-basic-design` |

**Example:** "I want to add login with Google feature" → **resolve-task**, not generate-srs.

---

## Phase 1 — Receive intent

User sends a free-form message.

**Actions:**
1. `task_list({ status: ["active", "paused"] })` — if a **resolve** task exists, offer **resume** (`task_resume`) or start new.
2. Otherwise `task_create({ kind: "resolve", workflow: "resolve", trigger: "<user message>" })`.
3. Acknowledge resolve-task workflow and go to **tier proposal** ([tier-router.md](./tier-router.md)).

**Forbidden:** Every tool — no `graph_impact`, no `index`, no file edits.

---

## Phase 2 — Tier (mandatory for new tasks)

Propose Fast/Standard/Full with rationale. User confirms.

```json
task_update({
  snapshot: { resolveTier: "fast", tierConfirmedAt: "<ISO>" },
  step: { id: "tier", patch: { status: "done" } }
})
```

Fast: skip `check`, `design`, `briefing` with `status: "skipped"`.

Standard/Full: follow extended runbooks before plan.

---

## Phase 3 — Clarify (mandatory)

Ask what you need to fill **all four** `GoalSpec` fields. Batch ≤3 questions in one message.

| Field | What to clarify |
|-------|----------------|
| `domain` | docs / prototype / graph / template / lang / comments? |
| `scope` | Which file(s) or section(s)? |
| `criteria` | What does "done" look like? |
| `notes` | Constraints, related features, languages? |

**Rules:**
- **Always ask at least one question** unless the user already gave domain + exact file path(s) + acceptance criteria in the same message.
- "Add login with Google" is **not** enough — clarify SRS vs prototype, which section, and done criteria.
- Do not propose file content yet. Do not run impact.

**Example (login with Google):**

> I'll handle this through the **resolve-task** workflow — plan first, execute after you approve.
>
> To build the right plan:
> 1. Should this go in **SRS** (e.g. features / external interfaces) or also **basic design / prototype**?
> 2. Is there an existing auth section to extend, or a new feature id (e.g. F-xx)?
> 3. What does done look like — e.g. requirements written + graph reindexed?

---

## Phase 4 — Discover (optional, read-only)

Use **only** when you need to find where content belongs.

| Allowed | Forbidden |
|---------|-----------|
| `docs_search({ query })` | `graph_impact` |
| `graph_query_fuzzy({ query })` | `index`, `graph_merge` |
| `graph_query({ seedId })` | Edit, Write |
| `Read` a single file for structure (headings) | Bulk-read docs for drafting |

Stop when you can name concrete `scope` paths. Go to Phase 4.

---

## Phase 5 — Build and show the plan

Construct `GoalSpec` + `TaskPlan`. **Show both in chat.** Do not execute.

### GoalSpec (show this)

```
Domain : docs
Scope  : docs/srs/en/04-features/f-12-google-login.md  (example)
Criteria:
  - Google OAuth login requirements documented
  - Linked to existing auth use case if applicable
  - graph reindexed after edit
Notes  : match style of existing F-xx feature files
```

### TaskPlan (show this)

| # | Step | Tool |
|---|------|------|
| s1 | Add F-xx Google login feature doc (or extend existing section) | direct edit |
| s2 | Check traceability impact | `graph_impact` |
| s3 | Re-index project | `index` |
| s4 | Merge knowledge → graph | `graph_merge` |

**Risk:** show `low` / `medium` / `high` as an **estimate** from scope size, or write "computed at step s2 after approval". Do **not** call `graph_impact` during planning.

### Approval gate

End with:

> **Approve this plan?** Reply **yes** to execute, or tell me what to change.

**Forbidden:** Any step in the table until the user confirms.

---

## Phase 6 — Wait for approval

Proceed only on explicit approval: "yes", "approve", "go ahead", "looks good", "execute".

**Persist before execute:**
1. `task_update` — set `goal` and `plan: { kind: "resolve", plan: <TaskPlan> }`.
2. `task_approve_plan` — unlocks the execute step (writes audit log).

If the user changes the plan → update GoalSpec/TaskPlan → `task_update` → show again → wait again.

---

## Phase 7 — Execute

See [resolve-execute.md](./resolve-execute.md). Prefer `resolve_task({ taskId })` for MCP steps; edit steps via Edit/Write.

CLI: `npx ai-spector resolve-task --task-id <id>`

---

## Phase 8 — Verify and report

`workspace_check` on changed paths (all tiers). Standard/Full: `readiness_output_checklist`. Then `task_complete` — see [resolve-execute.md](./resolve-execute.md).

---

## Guardrails (non-negotiable)

1. **No edits before approval** — including "let me draft it for you to review".
2. **No `graph_impact` before approval** — impact is an execute-step, not a planning shortcut.
3. **No `index` / `graph_merge` / `resolve_task` before approval**.
4. **Do not route to generate-srs** for single-feature adds — stay in this workflow.
5. **One approval gate** — clear yes, then execute all steps.

---

## CLI reference

| Command | Purpose |
|---------|---------|
| `npx ai-spector resolve-task --task-id <id>` | Execute from task file (preferred) |
| `npx ai-spector resolve-task plan.json` | Execute inline plan JSON |
| `npx ai-spector resolve-task --task-id <id> --dry-run` | Validate without writing |
| `npx ai-spector task create/list/get/update/approve` | Task state (see `ai-spector-task`) |

MCP: `resolve_task({ taskId })` or inline plan · `task_*` tools for state

---

## If blocked

See [cli-failures.md](../../ai-spector/references/cli-failures.md).

| Issue | Fix |
|-------|-----|
| `No executor registered for tool "X"` | Use: `index`, `graph_merge`, `graph_report`, `graph_impact` |
| Plan JSON parse error | Validate JSON before running |
| Reindex fails | `npx ai-spector setup --check` |
