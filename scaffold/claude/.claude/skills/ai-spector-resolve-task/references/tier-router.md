# Resolve task — tier router

After Phase 1 (receive intent), **propose a tier** before clarify/plan gates.

## Heuristics

| Tier | Signals |
|------|---------|
| **Fast** | 1 file, no new feature/API/screen IDs, typo or small edit |
| **Standard** | 2–5 files, extend existing section or requirement |
| **Full** | New F-xx / API-xx / screen ID, cross-layer (SRS+BD+prototype), high graph risk |

## Proposal template

```
Proposed tier: **Standard**
- Scope: 2 SRS files + reindex
- Rationale: extends existing F-12, no new feature id

Confirm tier: Fast / Standard / Full?
```

## Persist

After user confirms, prefer **`task_confirm_tier`**:

```json
task_confirm_tier({ taskId, tier: "standard" })
```

Or `task_update` with snapshot fields:

```json
task_update({
  snapshot: { resolveTier: "standard", tierConfirmedAt: "<ISO>" },
  step: { id: "tier", patch: { status: "done", completedAt: "<ISO>" } }
})
```

## Fast tier — skip steps

Mark `check`, `design`, `briefing` as **skipped** (not done):

```json
task_update({ step: { id: "check", patch: { status: "skipped" } } })
```

## Escalation

User may upgrade tier before `task_approve_plan`. Reset incomplete gate snapshots and re-run missing stages.

## Downgrade

Only before plan approval.

## Next

| Tier | Runbook |
|------|---------|
| Fast | [runbook.md](./runbook.md) Phases 2–7 |
| Standard | [resolve-standard.md](./resolve-standard.md) |
| Full | [resolve-full.md](./resolve-full.md) |
