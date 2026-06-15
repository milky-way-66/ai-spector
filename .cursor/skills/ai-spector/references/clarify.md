# Clarify (stage 2 — readiness assessment + resolve ALL gaps)

The clarify stage ensures the project has **enough information** to generate credible
documents before any file is written. It is **not** a quick chat — run the full
readiness workflow, then resolve every gap.

There is **no question cap** and nothing is silently deferred.

## Overview

```
1. READINESS  inventory context → score criteria → present readiness report
2. RESEARCH   optional web search for domain baselines (not project facts)
3. GAP SET    union of readiness gaps + graph empties + context store open/stale
4. RESOLVE    ask user → context_record / context_resolve every answer
5. RE-SCORE   repeat until zero blocking gaps
6. HANDOFF    summary → context briefing (stage 3)
```

Detailed readiness steps: [context-readiness.md](./context-readiness.md).

Incremental scope in same task: [incremental-continuation.md](./incremental-continuation.md).

## Step 1 — Readiness assessment (mandatory)

Before asking questions:

1. Derive **targets** from user request (scope case 1/2/3).
2. **Inventory** graph, `gaps.json`, data-source, context store, disk artifacts.
3. **`readiness_assess`** (MCP) — pass `docType`, `targets`, optional `profile` (`regulated` | `arc42`). CLI fallback: `readiness assess --json`.
4. **Present readiness report** from structured response (`summary`, `criteria`, `blockingGaps`) — do not score by hand.
5. `task_update` — mark `clarify` step `in-progress`.

If the user request expands scope on an active task (e.g. §3 after §1–§2), follow
[incremental-continuation.md](./incremental-continuation.md) **before** readiness.

### Optional web search

When criteria flag `webSearchWhen` or domain context is thin:

- Search for **what information classes** similar SRS chapters typically need
  (IEEE 29148 outline, industry checklists).
- Present findings as "domain baseline — please confirm what applies to your project."
- **Never** treat search results as confirmed project requirements.

## Step 2 — Compute the gap set

Union of four sources:

1. **Readiness criteria** — every criterion with status `missing` or `partial` where
   `severity: "blocking"` (and `should-ask` unless user waived depth).
2. **Completeness rules** — `doc-types/<docType>/completeness-rules.json` input-side gaps
   (reframe missing preconditions as questions).
3. **Graph coverage** — DAG seed nodes that resolve to empty (no actors for §2,
   no `UC-xx` for §3 list, no `F-xx` for §4…).
4. **Context store** — `context_list({ docType, status: "open" })` and
   `status: "stale"`. Answered entries are **not re-asked** unless stale.

Deduplicate: one question per gap; prefer readiness criterion `id` in question scope.

## Step 3 — Resolve every gap

Each gap must end in one of two states before stage 5 may run:

- **Answered** — the user gave an answer.
- **Accepted assumption** — the user explicitly approved the agent's stated assumption.

Generation is blocked until the whole gap set is in one of those states.

Rules:
- Show the **readiness report first**, then grouped questions (scope → stakeholders → per chapter).
- Minimum **3 question groups** when blocking gaps exist — never a single "anything else?"
- Store each answer **immediately** via `context_record` / `context_resolve`
  ([context-store.md](./context-store.md)).
- Stale entries: show old answer + what changed; `context_resolve` refreshes.
- Accepted assumptions: `source: "inferred"`, answer = assumption text.

After all blocking gaps resolved:

```
task_update({ patch: { step: { id: "clarify", patch: { status: "done" } } } })
```

## Output

Summary feeding the context briefing ([plan-and-briefing.md](./plan-and-briefing.md)):

```
Readiness: 12/15 blocking met (re-scored after answers)
Clarified this run: Q-004, Q-007 (answers stored)
Re-confirmed stale: Q-001
Accepted assumptions: Q-009 — payment retry = 3 attempts
Domain search: PCI scope — user confirmed not applicable v1
```
