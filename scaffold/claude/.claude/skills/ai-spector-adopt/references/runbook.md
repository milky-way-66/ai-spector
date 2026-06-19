# Project Adopt Runbook (gated)

Three-factor: **Human + AI + MCP/CLI**. Follow adopt **task steps** in order.

**Artifact directory:** `.ai-spector/.docflow/adopt/` (`scan-result.json`, `plan.json`, `adopt-setup.json`, `context.json`, `history.jsonl`)

| Step | Gate | MCP / action |
|------|------|----------------|
| `check` | workspace + user confirms candidate | `workspace_check`, `task_create` (kind `adopt`) |
| `clarify` | no blocking scan questions | `adopt_scan`, `adopt_context_record` |
| `plan` | mapping table approved | `adopt_plan` → user yes → `task_approve_adopt_plan` |
| `apply` | plan approved on task + disk | `adopt_apply` (`dryRun` optional) |
| `bootstrap` | apply done | `adopt_bootstrap` (index) |
| `validate` | `ready: true` | `adopt_validate({ sync: true })` |
| `complete` | migration.complete | `adopt_setup_mark migration.complete`, `task_complete` |

**Forbidden:** `task_approve_plan` (use `task_approve_adopt_plan`); `adopt_apply` before plan approval; `adopt_plan --approve` without adopt task (use `task_approve_adopt_plan`); template-import nested in adopt task — pause adopt → `/template-import` → new adopt task.

**Custom pack:** scan classifies `custom` + no installed pack → pause adopt task → `ai-spector-template-import` → start **new** adopt task after install.

---

## check

Confirm this is an **adopt candidate** (init done, docs misplaced — not greenfield setup).

```bash
npx ai-spector check --json
# MCP: workspace_check({})
```

Read `errors[]` / `warnings[]` — STRUCT-003/004 and similar layout failures are expected
before adopt.

Tell the user briefly:
- Init appears done (`.ai-spector/` present)
- Which doc paths look non-canonical (flat `docs/srs/*.md`, custom folders, prototype outside `prototype/`)

Ask **one** confirmation:

> "This project looks like a migration candidate — existing SRS/BD/prototype in non-standard
> paths. Should we run **adopt scan** to classify and build a move plan?"

**Stop until the user confirms.** Do not run Phase 1 on a project that still needs
`ai-spector-setup` (no init / no `.ai-spector/`).

If classification later shows **custom pack required** and no pack is installed → stop adopt;
route to **`ai-spector-template-import`**. Resume adopt after pack install.

---

## Phase 1 — Scan (Gate 1)

```bash
npx ai-spector adopt scan --json
# MCP: adopt_scan({})
```

Read `scan-result.json` (or JSON output). Summarize for the user:
- Detected layout (SRS, basic design, prototype, languages)
- File inventory counts
- Classification confidence highlights

### Blocking questions (`questionsForUser`)

If the scan returns blocking questions, ask **one at a time** (never batch Gate 1 blockers).

For each answer:

```bash
npx ai-spector adopt context-record <id> "<answer>"
# MCP: adopt_context_record({ id: "<id>", answer: "<answer>" })
```

Then re-run scan until `questionsForUser` has no unresolved blocking items:

```bash
npx ai-spector adopt scan --json
# MCP: adopt_scan({})
```

**Gate 1 complete** when scan finishes with no blocking questions.

---

## Phase 2 — Plan (Gate 2)

```bash
npx ai-spector adopt plan --json
# MCP: adopt_plan({})
```

Show the **mapping table** from the plan (source → destination, confidence, notes).
Highlight low-confidence rows; let the user edit mappings in chat.

If the user edits `plan.json` manually or you update rows:

```bash
npx ai-spector adopt plan --sync --json
# MCP: adopt_plan({ sync: true })
```

Ask explicitly:

> "Review the mapping table above. Any changes? When ready, say **approve plan** to proceed."

**Do not run Phase 3 until the user explicitly approves.**

On approval:

```bash
npx ai-spector adopt plan --approve [--by <email>]
# MCP: adopt_plan({ approve: true, by: "<email>" })
```

This sets `plan.status` to `"approved"` (Gate 2).

---

## Phase 3 — Apply

Optional preview first:

```bash
npx ai-spector adopt apply --dry-run
# MCP: adopt_apply({ dryRun: true })
```

Show dry-run moves. Confirm with the user, then execute:

```bash
npx ai-spector adopt apply
# MCP: adopt_apply({})
```

**Guardrail:** Never run `adopt apply` before Gate 2 plan approval (`plan.status === "approved"`).

On success, `plan.status` becomes `"applied"`. Show summary from CLI output and
`history.jsonl` if helpful.

On failure: show **full CLI output**; do not invent results. Apply may roll back moves —
report what the CLI says.

---

## Phase 4 — Bootstrap (Gate 3)

Before running bootstrap, confirm options with the user (index, optional analyze,
prototype manifest, review registry defaults). Gate 3 is human confirmation of bootstrap.

```bash
npx ai-spector adopt bootstrap --json
# MCP: adopt_bootstrap({})
# Optional: adopt_bootstrap({ skipAnalyze: true })
```

Summarize bootstrap steps completed (config patches, index, analyze, prototype, review
registry, adopt tasks).

**Guardrail:** Requires `plan.status === "applied"`. Do not bootstrap before apply succeeds.

---

## Phase 5 — Validate

Loop until blocking gaps are resolved or the user accepts remaining warnings.

```bash
npx ai-spector adopt validate --json --sync
# MCP: adopt_validate({ sync: true })
```

Present `ready`, `gaps[]`, and any `questionsForUser`. For each **blocking** gap:
- Explain what failed (workspace check, graph validate, STRUCT rules, etc.)
- Work with the user to fix (path edits, manual index, resolve-task follow-ups)
- Re-run validate

When `gaps` includes **`derive.srs-missing`** (basic + detail design exist, SRS missing), tell the user:

> Migration complete. SRS is missing but basic + detail design are indexed. Say **"generate SRS from basic design"** to backfill (extract pass first).

Route to **`ai-spector-generate-srs`** with `sourceMode: derive-downstream` — not a new adopt phase.

```bash
npx ai-spector adopt validate --json --sync
# MCP: adopt_validate({ sync: true })
```

**Gate 4 precondition:** `adopt_validate` reports `ready: true` with no blocking gaps.

---

## Phase 6 — Complete (Gate 4)

Only after Phase 5 reports `ready: true`:

Ask:

> "Migration validation passed. Say **migration complete** to mark adopt finished and unlock
> the full pipeline."

On explicit user confirmation:

```bash
npx ai-spector adopt setup-mark migration.complete
# MCP: adopt_setup_mark({ itemId: "migration.complete" })
```

**Guardrail:** Never run `setup-mark migration.complete` while blocking validate gaps remain.
The CLI rejects it when `adopt_validate` is not ready.

Tell the user what unlocks next: `resolve-task`, document review, generate regen, translations.

---

## Resume after abort

If the user stopped mid-flow, artifacts remain under `.ai-spector/.docflow/adopt/`.
Resume from the last completed phase ("continue adopt") — do not restart from Phase 0 unless
the user asks to re-scan.

---

## Guardrails

| Rule | Detail |
|------|--------|
| Never apply before approve | `adopt apply` only after Gate 2 (`adopt plan --approve`) |
| Never setup-mark without validate ready | `migration.complete` requires `adopt_validate` `ready: true` |
| Not template-import | Custom classification + no pack → `ai-spector-template-import`, then resume adopt |
| One blocking question at a time | Gate 1: `adopt_context_record` → re-scan |
| CLI failures | Show full output; never invent scan/plan/apply results |
| Not generate/resolve gates | `task_approve_plan` is for generate/resolve plans — not adopt plan approval |
| Not document sign-off | `review_approve` is for doc sign-off — not adopt migration complete |

---

## MCP tool reference

| Phase | MCP tool |
|-------|----------|
| 0 | `workspace_check` |
| 1 | `adopt_scan`, `adopt_context_record` |
| 2 | `adopt_plan` (`approve: true` on Gate 2) |
| 3 | `adopt_apply` (`dryRun: true` optional) |
| 4 | `adopt_bootstrap` |
| 5 | `adopt_validate` (`sync: true`) |
| 6 | `adopt_setup_mark` (`itemId: "migration.complete"`) |
