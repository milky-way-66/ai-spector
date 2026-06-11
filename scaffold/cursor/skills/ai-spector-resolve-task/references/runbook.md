# Resolve Task — conversational runbook

Chat-first workflow for any multi-step doc/graph change. User describes intent in plain language; agent clarifies, plans, gets approval, then executes.

---

## Phase 1 — Receive intent

User sends a free-form message. **Do not act yet.** Just read and move to Phase 2.

Examples:
- "create a task to add authentication to the SRS"
- "add an authentication requirement to the SRS"
- "change the prototype theme to dark"
- "we need a new API section in basic design"

---

## Phase 2 — Clarify (≤ 3 questions)

Ask only what is needed to fill `GoalSpec`. Stop when you can answer all four fields.

| Field | What to clarify |
|-------|----------------|
| `domain` | Which area: docs / prototype / graph / template / lang? |
| `scope` | Which specific files or sections change? |
| `criteria` | What does "done" look like? |
| `notes` | Any constraints, tone, related nodes? |

**Rules:**
- Ask at most 3 questions per round; batch them in one message.
- If the intent is already specific enough, skip to Phase 3.
- Do not propose edits or generate content yet.

**Example clarification message:**
> To make sure I plan this correctly:
> 1. Should this go in the main SRS (`docs/srs/`) or a language variant?
> 2. Is there an existing section to extend, or does this need a new one?
> 3. What does "done" look like — e.g. the section exists + graph reindexed?

---

## Phase 3 — Build and show the plan

Once you have enough to fill `GoalSpec`, construct the plan and **show it in chat** before doing anything.

### GoalSpec format (show this)

```
Domain : docs
Scope  : docs/srs/02-features.md
Criteria:
  - FR-AUTH section present with at least 3 requirements
  - graph reindexed successfully
Notes  : keep consistent with existing FR-PAY section style
```

### TaskPlan format (show this)

| # | Step | Tool |
|---|------|------|
| s1 | Edit docs/srs/02-features.md — add FR-AUTH section | (direct edit) |
| s2 | Re-index project | `index` |
| s3 | Merge knowledge | `graph_merge` |

**Risk level:** low / medium / high / critical (from impact analysis)

**Then ask:** "Does this plan look right? Reply **yes** to execute, or tell me what to change."

Do not proceed until the user confirms.

---

## Phase 4 — Execute

After approval, run each step in order.

### Steps that are direct edits
Use the Edit / Write tools directly. Report each file changed.

### Steps that call MCP tools
Use the `resolve_task` MCP tool with the approved plan:

```json
{
  "intent": "<original user message>",
  "goalSpec": {
    "trigger": "<original user message>",
    "domain": "docs",
    "scope": ["docs/srs/02-features.md"],
    "criteria": ["FR-AUTH section present", "graph reindexed"]
  },
  "plan": {
    "goal": { "...same as goalSpec..." },
    "steps": [
      { "id": "s2", "description": "Re-index project", "tool": "index", "args": {} },
      { "id": "s3", "description": "Merge knowledge",  "tool": "graph_merge", "args": {} }
    ]
  }
}
```

Or via CLI if MCP is unavailable:

```bash
# write plan.json, then:
npx ai-spector resolve-task plan.json
```

### If a step is blocked
Report the blocker in chat. Ask the user: "Step **sN** is blocked: `<reason>`. Should I skip it, retry, or stop?"

---

## Phase 5 — Report state update

After execution, show a summary:

```
✓ Task task-abc123 — COMPLETE
  domain: docs  risk: low

Steps:
  ✓ [s1] Edit docs/srs/02-features.md
  ✓ [s2] Re-index project
  ✓ [s3] Merge knowledge

State update:
  reindexed: 1 file(s)
  graph diff: +2 -0 ~1
  3 file(s) changed across 3 steps
```

Then ask if there is anything else to adjust.

---

## Replanning

If the user changes their mind after seeing the plan (Phase 3), go back to Phase 2 — update `GoalSpec` + `TaskPlan` and show the revised plan again.

If a step fails mid-execution, either:
- Replan without that step and continue, or
- Stop and report the full blocker to the user

---

## Guardrails

- **Never start editing** before the user approves the plan.
- **Never skip the clarify phase** — even one ambiguous word can target the wrong file.
- **Never run `resolve_task` with an unapproved plan.**
- Ask for approval once, clearly. Don't loop approval prompts.

---

## CLI reference

| Command | Purpose |
|---------|---------|
| `npx ai-spector resolve-task plan.json` | Execute a pre-built plan JSON |
| `npx ai-spector resolve-task plan.json --dry-run` | Validate without writing |
| `npx ai-spector resolve-task plan.json --json` | Machine-readable output |

MCP tool: `resolve_task` (schema: `ResolveTaskSchema`)

---

## If blocked

See [cli-failures.md](../../ai-spector/references/cli-failures.md).

| Issue | Fix |
|-------|-----|
| `No executor registered for tool "X"` | Use a supported tool: `index`, `graph_merge`, `graph_report`, `graph_impact` |
| Plan JSON parse error | Validate JSON with `node -e "JSON.parse(require('fs').readFileSync('plan.json','utf8'))"` |
| Reindex fails | Check `npx ai-spector setup --check` first |
