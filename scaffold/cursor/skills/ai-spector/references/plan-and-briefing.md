# Context briefing + plan gate (stages 3–4, always mandatory)

Every generate run — full, explicit paths, or described scope — passes both
gates before any file is written. There is no auto-confirm.

## Stage 3 — Context briefing

Prerequisite: Clarify stage finished with **zero blocking readiness gaps**
([context-readiness.md](./context-readiness.md)). Include the readiness summary
(blocking met / assumptions / domain search) at the top.

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
Plan — generate SRS (en)

| Output                      | DAG node          | Criteria (blocking) | ISO refs | Sources used                   | Key points to cover                     |
|-----------------------------|-------------------|---------------------|----------|--------------------------------|-----------------------------------------|
| docs/srs/en/1-introduction.md | srs.introduction | §1-001, §1-002, G-001 | 9.6.1, 9.6.2, 9.6.3 | overview.md, Q-002(answered) | Purpose, scope, definitions |
| docs/srs/en/03-use-cases.md | srs.use-cases     | §3-001, §3-002      | 9.6.5, 9.6.10 | auth-notes.md, Q-001(answered) | Google+email login; guest checkout; …   |
| docs/srs/en/04-features.md  | srs.features-list | §4-001              | 9.6.5, 9.6.12 | feature-backlog.md             | F-01 cart, F-02 wishlist, …             |

Clarifications resolved this run: Q-001, Q-003
Accepted assumptions in effect: Q-007 — payment retry = 3 attempts
Standards: ISO-29148 (from docflow.config) — criteria from doc-types/srs/readiness-criteria.json

Proceed? (yes / edit scope / revisit clarifications)
```

When storing the approved plan via `task_update` / `task_approve_plan`, include
`criteriaIds` and `isoRefs` on each `GeneratePlanRow` for audit.

Rules:
- **No file written before an explicit `yes`.**
- **Criteria + ISO refs** map each output to readiness criteria — user sees what standards coverage is planned.
- "Sources used" makes the source→document mapping explicit.
- "Key points" is the per-document content outline from graph + context store.
- Include wave assignments (and secondary-language status columns when
  multi-language).
- "edit scope" → rebuild plan; "revisit clarifications" → back to clarify.
- Log the confirmed plan to `.ai-spector/.docflow/logs/plan-<docType>-<ts>.json`
  for audit and future check-back.
