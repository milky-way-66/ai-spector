# Task state runbook

File-backed workflow progress lives in `.ai-spector/.docflow/tasks/`.

## Session start (any generate or resolve skill)

```
1. task_list({ status: ["active", "paused", "blocked"] })
2. If match → show summary → offer task_resume OR start new (task_create with force:true)
3. task_get(taskId) → read currentStepId, nextAction, planApprovedAt, blockers
4. Never skip gates already marked done in steps[]
```

## Create

```json
// Generate SRS
{ "kind": "generate", "workflow": "generate-srs", "trigger": "generate SRS", "docType": "srs" }

// Incremental change
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

## Complete / abandon

```
task_complete({ taskId, summary: "..." })
task_abandon({ taskId, reason: "..." })
```
