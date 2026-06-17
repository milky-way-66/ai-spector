# Resolve task — Full tier

For new feature IDs, cross-layer changes, or high-impact increments.

## Gate order

```
tier → design spec → check → clarify (+ readiness) → briefing → plan file → approve → execute → verify → report
```

## 1. Design spec (before check)

Collaborative design in chat (brainstorming-style). Save to:

`docs/superpowers/specs/YYYY-MM-DD-<topic>-design.md`

User must approve spec explicitly. Prefer **`task_approve_design_spec`**:

```json
task_approve_design_spec({
  taskId,
  designSpecPath: "docs/superpowers/specs/2026-06-17-<topic>-design.md"
})
```

Or `task_update` with `designSpecPath` + `designSpecApprovedAt`.

## 2–5. Standard gates

Follow [resolve-standard.md](./resolve-standard.md) from workspace_check through implementation plan.

Implementation plan must trace back to design spec sections.

## 6–8. Execute / verify / report

See [resolve-execute.md](./resolve-execute.md). Full tier verify includes spec self-review against `designSpecPath`.
