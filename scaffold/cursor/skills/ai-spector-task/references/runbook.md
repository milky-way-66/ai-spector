# Task state runbook

File-backed workflow progress lives in `.ai-spector/.docflow/tasks/`.

## Session start (any generate or resolve skill)

**Preferred — single MCP call** (`bootstrap` creates or returns `activeForSlot`):

```json
// Generate SRS
task_list({
  "status": ["active", "paused", "blocked"],
  "bootstrap": {
    "kind": "generate",
    "workflow": "generate-srs",
    "trigger": "generate SRS introduction",
    "docType": "srs"
  }
})
```

- `bootstrapped` → new task created; continue from `currentStepId`
- `activeForSlot` → offer `task_resume(taskId)`; do **not** create again

CLI equivalent:

```bash
npx ai-spector task list -k generate -w generate-srs --doc-type srs \
  --bootstrap-trigger "generate SRS introduction"
```

Quick slot view: `task_status({})` or `npx ai-spector task status`.

## Create (manual fallback)

```json
{ "kind": "generate", "workflow": "generate-srs", "trigger": "generate SRS", "docType": "srs" }
{ "kind": "resolve", "workflow": "resolve", "trigger": "add login with Google" }
```

One active task per slot (`generate:srs`, `generate:basic-design`, `resolve`). Use `force: true` to replace.

## Update gates

After each workflow phase, `task_update` with a patch:

```json
{
  "taskId": "task-abc123",
  "patch": {
    "phase": "clarify",
    "phaseStatus": "in_progress",
    "step": { "id": "clarify", "patch": { "status": "in-progress" } }
  }
}
```

## Approve plan

```
task_update({ plan: { kind: "generate"|"resolve", plan: <...> } })
task_approve_plan({ taskId })
```

Generate tasks: approval expands `wave-1` … `wave-N` from `plan.waves`.

## Record generate wave

After writing files for a wave:

```
task_record_wave({
  taskId,
  waveId: "wave-1",
  status: "done",
  artifacts: ["docs/srs/en/03-use-cases.md"]
})
```

## Resume

```
task_resume({ taskId })
```

Returns `canContinue`, `drift`, `staleContextIds`. User must confirm when drift or stale context is present.

## Incremental scope (same conversation)

When user asks for more chapters while a generate task is active, read
`ai-spector/references/incremental-continuation.md`:

1. Offer A (extend plan) / B (complete + new task) / C (pause).
2. Path A: `task_update(plan)` with new rows/waves → `task_approve_plan` → then generate.
3. Never `task_record_wave(wave-N)` before plan expands wave steps.
4. End session with `task_complete` or `task_pause`.

## Complete / abandon

```
task_complete({ taskId, summary: "..." })
task_abandon({ taskId, reason: "..." })
```
