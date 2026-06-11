# Resolve Task — conversational runbook

Plan-first workflow for incremental doc/graph changes. The agent **never edits or runs impact** until the user approves a written plan.

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

**Actions:** Read the message. Acknowledge you will use the resolve-task workflow.

**Forbidden:** Every tool — no `graph_impact`, no `index`, no file edits, no bulk `docs/**` reads.

**Then:** Go to Phase 2. Do not skip.

---

## Phase 2 — Clarify (mandatory)

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

## Phase 3 — Discover (optional, read-only)

Use **only** when you need to find where content belongs.

| Allowed | Forbidden |
|---------|-----------|
| `docs_search({ query })` | `graph_impact` |
| `graph_query_fuzzy({ query })` | `index`, `graph_merge` |
| `graph_query({ seedId })` | Edit, Write |
| `Read` a single file for structure (headings) | Bulk-read docs for drafting |

Stop when you can name concrete `scope` paths. Go to Phase 4.

---

## Phase 4 — Build and show the plan

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

## Phase 5 — Wait for approval

Proceed only on explicit approval: "yes", "approve", "go ahead", "looks good", "execute".

If the user changes the plan → update GoalSpec/TaskPlan → show again → wait again.

---

## Phase 6 — Execute

Run **only** approved steps, in order.

### Direct edit steps
Use Edit / Write. Report each file changed.

### MCP / CLI steps
Use `resolve_task` for batched index/graph steps, or call MCP tools individually per the plan:

```json
{
  "intent": "I want to add login with Google feature",
  "goalSpec": {
    "trigger": "I want to add login with Google feature",
    "domain": "docs",
    "scope": ["docs/srs/en/04-features/f-12-google-login.md"],
    "criteria": ["Google OAuth requirements documented", "graph reindexed"]
  },
  "plan": {
    "goal": {
      "trigger": "I want to add login with Google feature",
      "domain": "docs",
      "scope": ["docs/srs/en/04-features/f-12-google-login.md"],
      "criteria": ["Google OAuth requirements documented", "graph reindexed"]
    },
    "steps": [
      { "id": "s2", "description": "Check traceability impact", "tool": "graph_impact", "args": { "change": "content_change" } },
      { "id": "s3", "description": "Re-index project", "tool": "index", "args": {} },
      { "id": "s4", "description": "Merge knowledge", "tool": "graph_merge", "args": {} }
    ]
  }
}
```

CLI fallback: `npx ai-spector resolve-task plan.json`

**Note:** Edit steps (s1) are done outside `resolve_task` — the tool only runs registered executors (`index`, `graph_merge`, `graph_impact`, `graph_report`).

### If a step is blocked
Report the blocker. Ask: skip, retry, or stop?

---

## Phase 7 — Report state update

```
✓ Task task-abc123 — COMPLETE
  domain: docs  risk: low

Steps:
  ✓ [s1] Added docs/srs/en/04-features/f-12-google-login.md
  ✓ [s2] graph_impact — 2 review, 0 regenerate
  ✓ [s3] Re-index project
  ✓ [s4] Merge knowledge

State update:
  1 file(s) changed
  graph reindexed
```

Ask if anything else needs adjustment.

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
| `npx ai-spector resolve-task plan.json` | Execute approved plan JSON |
| `npx ai-spector resolve-task plan.json --dry-run` | Validate without writing |
| `npx ai-spector resolve-task plan.json --json` | Machine-readable output |

MCP: `resolve_task` (schema: `ResolveTaskSchema`)

---

## If blocked

See [cli-failures.md](../../ai-spector/references/cli-failures.md).

| Issue | Fix |
|-------|-----|
| `No executor registered for tool "X"` | Use: `index`, `graph_merge`, `graph_report`, `graph_impact` |
| Plan JSON parse error | Validate JSON before running |
| Reindex fails | `npx ai-spector setup --check` |
