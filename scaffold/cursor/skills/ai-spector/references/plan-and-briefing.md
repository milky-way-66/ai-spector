# Context briefing + plan gate (stages 3–4, always mandatory)

Every generate run — full, explicit paths, or described scope — passes both
gates before any file is written. There is no auto-confirm.

## Decisions table (before briefing — user must confirm)

Surface these **before** the per-file briefing. Do not infer or auto-fill.

| Decision | Rule |
|----------|------|
| **Language** | State which `lang.code` this run generates. If `languages[]` has multiple entries, **ask** which language(s) — do not assume the first entry or a value from `.docops/docops.config.json` alone. |
| **SRS scope** | Full DAG includes `srs.use-case-detail` (one file per UC under `03-use-cases/`). List index only if user defers per-UC detail — say so explicitly. |
| **BD scope** | Full basic design includes list files **and** `bd.detail-api` + `bd.detail-screen` waves. If bundling BD into an SRS session, still list screen/API detail rows in the plan (approve or defer). |
| **Scaffold / config** | If copying or refreshing `.ai-spector/.docflow/config/doc-types/*`, say what will change before writing. |
| **Commit / push** | Never commit or push without explicit user request; call out unstaged config changes (e.g. `docops.config.json`). |

Only after the user confirms this table (or corrects it) → run the context briefing.

## Stage 3 — Context briefing

Prerequisite: Clarify stage finished with **zero blocking readiness gaps**
([context-readiness.md](./context-readiness.md)). Include the readiness summary
(blocking met / assumptions / domain search) at the top.

**Forbidden:** setting `briefingConfirmedAt` or marking briefing **done** before the user explicitly confirms the briefing in chat.

State **exactly what context and information will shape each document** so the
user can see and approve the inputs. Per target document, list:

| What | Example |
|------|---------|
| **Graph context** | Nodes/queries pulled (actors, `UC-xx`, `F-xx`, seeds) — and which resolved to empty |
| **Data-source files** | Exact `docs/data-source/` files informing this doc |
| **Context-store answers** | Which answered `Q-xxx` clarifications apply |
| **Open assumptions** | User-accepted assumptions in effect, flagged for correction |
| **Template** | Which template pack/section structure governs the output |
| **NOT using** | Notable available context deliberately excluded, and why |
| **Criteria (blocking)** | Criterion ids from `readiness_assess` this output will satisfy (e.g. `§1-001`, `G-003`) |
| **ISO refs** | `iso29148` refs for those criteria (e.g. `9.6.2`, `9.6.4`) — shows standards traceability |

The user confirms or corrects the briefing **first**. If they correct an input,
re-run clarify/plan — never silently swap context after confirmation.

Populate **Criteria** and **ISO refs** from the readiness report (`readiness_assess`
`criteria[]` filtered by `dagNode` / scope). This makes the standards alignment
visible before any file is written.

## Stage 4 — Plan table

After the briefing is confirmed, show the plan and wait for an explicit yes:

```
Plan — generate SRS (en)   ← language must match confirmed decision, not assumed

| Wave | Output | DAG node | Criteria (blocking) | ISO refs | Sources used | Key points |
|------|--------|----------|---------------------|----------|--------------|------------|
| 1 | docs/srs/en/1-introduction.md | srs.introduction | §1-001, §1-002, G-001 | 9.6.1, 9.6.2 | overview.md, Q-002 | Purpose, scope, definitions |
| 2 | docs/srs/en/3-use-cases.md | srs.use-cases | §3-001, §3-002 | 9.6.5, 9.6.10 | auth-notes.md, Q-001 | UC inventory + diagram |
| 3 | docs/srs/en/03-use-cases/uc-01-manage-trip-lifecycle.md … uc-11-*.md (11 files) | srs.use-case-detail | UC-001…UC-004 per UC | 9.6.10, 9.6.12 | graph UC-01…UC-11 | Main flow, actors, extensions per UC |
| 4 | docs/srs/en/4-system-features.md | srs.features-list | §4-001 | 9.6.5, 9.6.12 | feature-backlog.md | F-01 … F-0N list |
| 5 | docs/srs/en/04-system-features/f-*.md | srs.feature-details | F-001… per feature | 9.6.12 | graph F-xx | One row per feature file |

Basic design (if in scope — separate plan or explicit rows):

| Wave | Output | DAG node | Notes |
|------|--------|----------|-------|
| 0 | docs/basic-design/en/list-screens.md, api-list.md, db-design.md | bd.list-screen, bd.list-api, bd.db-design | Lists |
| 1 | docs/basic-design/en/screens/s-*.md (N files) | bd.detail-screen | **Defer?** yes/no |
| 1 | docs/basic-design/en/api/*.md (M files) | bd.detail-api | **Defer?** yes/no |

Clarifications resolved this run: Q-001, Q-003
Accepted assumptions in effect: Q-007 — payment retry = 3 attempts
Standards: ISO-29148 (from docflow.config) — criteria from doc-types/srs/readiness-criteria.json

Proceed? (yes / edit scope / revisit clarifications)
```

When storing the approved plan via `task_update` / `task_approve_plan`, include
`criteriaIds` and `isoRefs` on each `GeneratePlanRow` for audit.

Rules:
- **No file written before an explicit `yes`.**
- **Per-domain waves** (`srs.use-case-detail`, `srs.feature-details`, `bd.detail-screen`, `bd.detail-api`) must appear in the plan — either as concrete file counts or as an explicit **deferred** line the user approved.
- **Criteria + ISO refs** map each output to readiness criteria — user sees what standards coverage is planned.
- "Sources used" makes the source→document mapping explicit.
- "Key points" is the per-document content outline from graph + context store.
- Include wave assignments (and secondary-language status columns when
  multi-language).
- "edit scope" → rebuild plan; "revisit clarifications" → back to clarify.
- Log the confirmed plan to `.ai-spector/.docflow/logs/plan-<docType>-<ts>.json`
  for audit and future check-back.
