# Generate detail design

Generate detail design markdown **from the traceability graph**, SRS, and basic design upstream.

> **Generate workflow — not resolve-task.** Use CHECK → CLARIFY → BRIEFING → PLAN → GENERATE.
> Do **not** use `task_confirm_tier` or resolve-tier gates. For single-section edits use `ai-spector-resolve-task`.

**User runs this command;** the agent runs MCP/CLI.

## Mandatory gates (before any `docs/detail-design/` write)

Follow [generate-workflow.md](../../ai-spector/references/generate-workflow.md) in order:

| Step | MCP tools | Snapshot / step |
|------|-----------|-----------------|
| 0 | `task_list` bootstrap `generate-detail-design` | task file |
| 1 CHECK | `workspace_check` | `workspaceCheckAt`, step `check` done |
| 2 CLARIFY | `readiness_assess({ docType: "detail-design" })`, `context_list` | `readinessReportShown`, step `clarify` done |
| 3 BRIEFING | per-file briefing in chat | `briefingConfirmedAt`, step `briefing` done |
| 4 PLAN | plan table → user **yes** | `planPresentedAt`, `task_approve_plan` |
| 5 GENERATE | `task_record_wave` per wave | wave steps |
| 6 EXTRACT | `spec_record` offer | `extractOffered`, `task_complete` |

| Shared workflow | Document |
|-----------------|----------|
| Scope cases, waves, merge, finish, guardrails | [generate-workflow.md](../../ai-spector/references/generate-workflow.md) |
| Graph query, ingest | [generate-graph.md](../../ai-spector/references/generate-graph.md) |

**Upstream:** SRS minimum + basic design when outputs exist (see `workflow.dependencies.json` → `generate-detail-design`). Do not invent features not grounded in graph + upstream docs.

## Intent → DAG hints

| User phrase (examples) | Typical DAG / outputs |
|------------------------|------------------------|
| architecture, security patterns, error handling | `dd.common.*` → `docs/detail-design/{lang}/common/` |
| feature list | `dd.feature-list` → `feature-list.md` |
| feature detail, per feature, checkout flow | `dd.feature-details` → `docs/detail-design/{lang}/features/` (one per feature) |
| full detail design | Full DAG — common wave → list → per-feature |

## Config

- `.ai-spector/.docflow/config/doc-types/detail-design/dag.json`
- `workflow.dependencies.json` → `generate-detail-design`
- Templates: `.ai-spector/templates/detail_design/`

## Output paths

Always write to `docs/detail-design/{lang.code}/{path}`. Never skip the language subfolder.

## Waves (reference)

| Wave | DAG nodes | After wave |
|------|-----------|------------|
| 0 | All `dd.common.*` (parallel) | merge → validate → **`index`** |
| 1 | `dd.feature-list` | merge → validate → **`index`** |
| 2 | `dd.feature-details` (per feature) | merge → validate → **`index`** |

**Reindex every wave (mandatory):** wave 2 expands rows from the indexed feature list.

## Checklist

```
- [ ] task_list bootstrap generate-detail-design
- [ ] workspace_check + context_list
- [ ] Clarify → briefing → plan → task_approve_plan
- [ ] Each wave: write → readiness_scan → output compliance → task_record_wave → index
- [ ] Offer spec extraction when done
```
