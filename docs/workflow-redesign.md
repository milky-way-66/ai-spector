# Workflow Redesign — Human-in-the-Loop Generation

> Status: **Design proposal** (for review, not yet implemented)
> Date: 2026-06-12
> Author: design pass with Claude

## 1. Goals

Redesign the ai-spector generation workflow around three principles:

1. **Improve context by asking & clarifying** — before generating any document,
   detect missing/ambiguous information, ask the user, and **store the answers**
   so they can be re-checked later.
2. **Plan and confirm before doing** — every generation run produces an explicit
   plan (which sources, which key points, which outputs) that the user confirms
   before a single file is written.
3. **Valid-check by script** — a structural check of the workspace runs as an
   **MCP tool with CLI fallback**, usable both by the **pre-commit hook** and by
   the **agent**, warning the user when the workspace layout/config drifts.

The redesign keeps the existing architecture (core/operations return typed
results, interfaces adapt them — see `CLAUDE.md` rules 1–6).

---

## 2. Current state (baseline)

```
init → docs/data-source/ → analyze → graph merge/validate
     → generate SRS (DAG waves) → index → basic design → detail design → prototype
```

What already supports the goals (partial):

| Goal | Today |
|------|-------|
| Human-in-loop | Scope-confirm for "described" requests (case 3), translation pause, `resolve-task` is plan-first |
| Valid check | `graph validate` (schema + structure), `prototype validate` — **artifacts only**, not workspace structure |
| Plan/confirm | Only for vague requests; plan doesn't surface sources + key points |
| Clarify + store | **None** — generation reads the graph directly; no clarification gate, no context store |

Gaps this redesign closes: **(a)** no workspace structural check, **(b)** no
clarify-before-generate with persistence, **(c)** plan/confirm is inconsistent
and doesn't show source→document mapping.

---

## 3. New workflow

```
init
  └─ check  ───────────────► (valid-check; warns & blocks if structure wrong)
docs/data-source/
  └─ analyze
generate <doc>
  ├─ 1. CHECK     workspace valid-check (auto, fast)
  ├─ 2. CLARIFY   detect gaps → ask user → store answers in context store
  ├─ 3. PLAN      build plan (sources + key points + outputs) → user confirms
  ├─ 4. GENERATE  DAG waves (existing engine)
  └─ 5. EXTRACT   pull key specs from output → ask user to persist
                  → on yes: merge to graph + write back to docs/data-source/
```

Each generate invocation runs the 5 stages in order. Stages 1–3 are gates: no
file is written until the plan is confirmed.

---

## 4. Stage 1 — Valid check (`check`)

### 4.1 Surface

- **MCP tool** `workspace_check({ fix?: boolean })` — primary path for the agent.
- **CLI** `npx ai-spector check [--json] [--fix]` — fallback + pre-commit + CI.
- **Pre-commit hook** calls the CLI in non-interactive mode; non-zero exit on
  any `error`-severity finding blocks the commit.

Both surfaces wrap one core function so behavior is identical:

```ts
// src/core/operations/check.ts
export interface CheckFinding {
  ruleId: string;                 // e.g. "STRUCT-001"
  severity: "error" | "warning";
  message: string;
  path?: string;                  // offending file/dir
  fix?: string;                   // suggested remediation (human text)
  autoFixable?: boolean;
}
export interface CheckResult {
  ok: boolean;                    // false if any error-severity finding
  findings: CheckFinding[];
  checkedAt: string;              // ISO timestamp
}
export async function runCheck(opts: CheckOptions): Promise<CheckResult>;
```

Formatter in `src/interfaces/cli/format/`, MCP handler in
`src/interfaces/mcp/tools/`, schema in `schemas.ts`, registered in `server.ts`
(per CLAUDE.md "Adding a New Command").

### 4.2 What it checks (rule set, configurable)

Driven by `.ai-spector/.docflow/config/workspace.rules.json` so projects can
extend it:

| Rule | Severity | Checks |
|------|----------|--------|
| STRUCT-001 | error | Required dirs exist: `docs/data-source/`, `docs/srs/`, `.ai-spector/.docflow/config/` |
| STRUCT-002 | error | `.ai-spector/docflow.config.json` present and parseable |
| STRUCT-003 | warning | Each configured language has its output subfolder (`docs/srs/{lang}/`, `docs/basic-design/{lang}/`) |
| STRUCT-004 | error | Builtin SRS/BD docs must live under `docs/{type}/{lang}/` (not `docs/srs/{filename}` root) |
| CFG-001 | error | `languages[]` non-empty; codes match `language.json` |
| CFG-002 | warning | All `dag.*.json` referenced by configured doc types exist |
| TMPL-001 | warning | `.ai-spector/templates/<pack>/` exists for the active template pack |
| CTX-001 | warning | Context store dir exists and entries are schema-valid (see §6) |
| GRAPH-001 | warning | `graph.json` parses (defers deep validation to `graph validate`) |

`--fix` / `fix: true` resolves only `autoFixable` findings (create missing
dirs, scaffold empty config) and reports the rest.

> Scope boundary: `check` validates **structure/config**. It does **not**
> replace `graph validate` (graph semantics) or `prototype validate`. The agent
> runbook chains them: `check` → `graph validate` when graph is involved.

---

## 5. Stage 2 — Clarify

### 5.1 Trigger

Before planning a generate run, the agent computes a **gap set** for the target
doc type from three sources:

1. **Completeness rules** — existing `completeness-rules.<doc>.json` already
   encode required sections/fields. Reframe "missing field" as "open question".
2. **Graph coverage** — DAG seed nodes that resolve to empty (e.g. no actors for
   §2, no `F-xx` for feature details) become clarifying questions.
3. **Prior context store** — open questions previously recorded but unanswered
   (§6) are re-surfaced.

### 5.2 Asking

The agent must resolve the **entire** gap set before generation starts — there
is no question cap and nothing is silently deferred (decision §11.4). Each gap
ends in one of two states: **answered** by the user, or **explicitly accepted as
an assumption** by the user. Generation is blocked until every gap is in one of
those two states.

Questions are grouped logically for readability and each answer is stored
immediately (§6) before moving on, so an interrupted session keeps progress.
Questions already answered in a prior session are **not re-asked** unless the
underlying source changed (staleness, §6.3).

### 5.3 Why store

Persistence is what lets a later run "check back": re-run generation months
later and the agent knows which assumptions were user-confirmed vs. inferred,
and which sources have since changed.

---

## 6. Context store

### 6.1 Location & shape

`/.ai-spector/.docflow/context/<docType>.json` (one file per doc type; mirrors
how `review-queue/` and `translation-queue/` are organized).

```jsonc
{
  "version": 1,
  "docType": "srs",
  "entries": [
    {
      "id": "Q-001",
      "question": "Which auth providers must login support?",
      "answer": "Google + email/password. No SSO in v1.",
      "status": "answered",          // open | answered | stale
      "scope": "srs.use-cases",      // DAG node / section this informs
      "source": "user",             // user | inferred | data-source
      "sourceRefs": ["docs/data-source/auth-notes.md"],
      "answeredAt": "2026-06-12T...",
      "answeredBy": "khang"
    }
  ]
}
```

### 6.2 Surfaces

- MCP: `context_list({ docType, status? })`, `context_record({ docType, entry })`,
  `context_resolve({ docType, id, answer })`.
- CLI mirrors: `npx ai-spector context list|record|resolve`.
- Core op `src/core/operations/context.ts` returning typed results.

### 6.4 Extracted-spec store (separate from data-source)

Stage-5 extracted specs live in their **own** store, kept distinct from both the
clarify context store and `docs/data-source/`:

`/.ai-spector/.docflow/extracted/<docType>.json` — pending/approved specs with a
`status` (`pending` | `approved` | `rejected`) that drives the spec review queue
(§8). Approved specs are merged to the graph; rejected ones are dropped.
`docs/data-source/` stays purely human-authored input — derived specs never go
there.

### 6.3 Staleness

When `index`/`analyze` detects a `sourceRefs` file changed after `answeredAt`,
the entry flips to `stale`. `check` rule CTX-001 surfaces stale entries; the next
generate run re-asks only the stale questions.

---

## 7. Stage 3 — Plan & confirm (universal)

Replaces the inconsistent "case 3 only" confirmation with a **mandatory plan for
every generate run**. The plan is a table the user approves before any write:

```
Plan — generate SRS (en)

| Output                         | DAG node          | Sources used                          | Key points to cover                          |
|--------------------------------|-------------------|---------------------------------------|----------------------------------------------|
| docs/srs/en/03-use-cases.md    | srs.use-cases     | auth-notes.md, Q-001(answered)        | Google+email login; guest checkout; ...      |
| docs/srs/en/04-features.md     | srs.features-list | feature-backlog.md                    | F-01 cart, F-02 wishlist, ...                |

Open questions resolved this run: Q-001, Q-003
Still open (will generate with assumption): Q-007 — payment retry policy

Proceed? (yes / edit scope / answer open questions first)
```

Rules:
- No file written before explicit `yes`.
- "Sources used" makes the source→document mapping explicit (your requirement:
  *which information we use, with source*).
- "Key points" is the per-document content outline pulled from graph + context
  store (your requirement: *key points of document we gonna use*).
- Plan is logged to `.ai-spector/.docflow/logs/plan-<docType>-<ts>.json` for
  audit / future check-back.

### 7.1 Context briefing (mandatory, before the plan table)

Before showing the plan, the agent must **state clearly what context and
information it is about to use** — the user has to be able to see and approve the
exact inputs feeding generation. This is a hard gate, not optional narration.

The briefing lists, per target document:

| What | Example |
|------|---------|
| **Graph context** | Which nodes/queries (actors, `UC-xx`, `F-xx`, seeds) will be pulled, and which resolved to empty |
| **Data-source files** | Exact files from `docs/data-source/` that inform this doc |
| **Context-store answers** | Which `Q-xxx` clarifications (answered) are being applied |
| **Open assumptions** | Anything unresolved the agent will assume, flagged for the user to correct |
| **Template** | Which template pack/section structure governs the output |
| **NOT using** | Notable available context being deliberately excluded, and why |

The user confirms (or corrects) the briefing first; only then does the agent show
the plan table (§7) and ask to proceed. If the user corrects an input, the agent
re-runs Clarify/Plan — it never silently swaps context after confirmation.

This guarantees the user always knows **what information, from where, is shaping
each document** before any generation happens.

---

## 8. Stage 5 — Extract & feed back

After a successful generate run:

1. **Extract key specs** from the written documents (decisions, constraints,
   identifiers, NFR thresholds) — reuse the `analyze` extraction machinery.
2. **Ask the user**: "I extracted these N key specs from the generated docs.
   Store them?" (show the list).
3. On **yes**, specs land in a **spec review queue** — they are **not** merged
   to the graph immediately. The user reviews/approves (mirrors the existing
   document-approval review system). Only on approval does `graph merge` add
   them as nodes/attributes.
4. Extracted specs are stored in their **own location, separate from
   `docs/data-source/`** — see §6.4. They are *never* written back into
   `docs/data-source/` (decision: mixing derived specs with primary input
   material is undesirable — keep provenance clean).

This makes generation **convergent**: each run hardens the shared context (graph
+ spec store) rather than starting from scratch, while keeping `docs/data-source/`
as pure human-authored input.

---

## 9. Component summary

| Component | New / changed | Location |
|-----------|---------------|----------|
| `runCheck` core op | new | `src/core/operations/check.ts` |
| `workspace_check` MCP tool + CLI `check` | new | `interfaces/mcp/tools/`, `cli.ts` |
| Pre-commit integration | changed | existing `hooks` install → add `check` |
| `workspace.rules.json` | new config | `scaffold/.ai-spector/.docflow/config/` |
| Context store ops + MCP/CLI | new | `src/core/operations/context.ts` |
| `context/<docType>.json` store | new | `.ai-spector/.docflow/context/` |
| Clarify + Plan gates | changed skills | `generate-workflow.md` + generate skills |
| Extract-&-feedback step | new skill section | `generate-workflow.md` Finish |
| Staleness wiring | changed | `analyze` / `index` ops |

## 10. Skill/doc changes (no code)

- `generate-workflow.md`: replace §Scope/§Plan with the 5-stage gate flow;
  make plan-confirm mandatory; add Clarify and Extract sections.
- Each `ai-spector-generate-*` skill: add "load context store" + "run check"
  to its "Load at start".
- New reference `clarify.md` and `context-store.md` under
  `cursor/skills/ai-spector/references/`.
- `WORKFLOW.md` / `_workflow.md`: update the pipeline diagram + tables.

## 11. Resolved decisions

1. **Extraction trust** → stage-5 specs go to a **review queue** first; merge to
   graph only on approval. Stored separately from `docs/data-source/` (§6.4, §8).
2. **Context granularity** → **one context file per doc type** (`context/<docType>.json`).
   Not per feature/UC; the `scope` field inside each entry pins it to a DAG
   node/section when finer targeting is needed.
3. **Plan gate** → **always mandatory**. No `autoConfirm` opt-out. Every generate
   run requires the context briefing (§7.1) + plan confirmation (§7) before any
   write, for every user.
4. **Clarify completeness (not batching cap)** → there is **no arbitrary question
   cap**. The Clarify stage's job is to **find all missing information that needs
   confirmation and resolve it before generation starts**. The agent computes the
   full gap set (§5.1), and generation does not begin until every gap is either
   answered or explicitly accepted as an assumption by the user. Questions are
   grouped logically for readability, but none are silently deferred — completeness
   of confirmed context is the gate, not a count.
```
