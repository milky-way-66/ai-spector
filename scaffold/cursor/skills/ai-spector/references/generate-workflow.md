# Document generation workflow

Used by SRS, basic design, and detail design skills.

**References (load when needed):**
- Workspace check → [workspace-check.md](./workspace-check.md)
- Context readiness assessment → [context-readiness.md](./context-readiness.md)
- Clarify gaps before generating → [clarify.md](./clarify.md)
- Incremental scope (same task) → [incremental-continuation.md](./incremental-continuation.md)
- Context store (clarification persistence) → [context-store.md](./context-store.md)
- Context briefing + plan gate → [plan-and-briefing.md](./plan-and-briefing.md)
- Output compliance (agent semantic review) → [output-compliance.md](./output-compliance.md)
- Extract specs after generating → [extract-specs.md](./extract-specs.md)
- Graph queries / merge / ingest → [generate-graph.md](./generate-graph.md)
- Context compaction / sub-agents → [context-management.md](./context-management.md)
- CLI failures → [cli-failures.md](./cli-failures.md)

## Task state (every generate run) — HARD GATE

Persist progress in `.ai-spector/.docflow/tasks/` — do not rely on chat memory.
**Step 0 runs before CHECK.** `workspace_check` TASK-002/TASK-003 surface missing task state.

```
0. task_list({ status: ["active", "paused"], bootstrap: { kind, workflow, docType, trigger } })
   → activeForSlot: task_resume | bootstrapped: new task id
1. After each gate: task_update (phase, step status, openContextIds) — check/clarify/briefing/plan must reach `done`
3. After plan table approved: task_update(plan) → task_approve_plan (expands wave-1…wave-N steps)
4. After each DAG wave (before task_record_wave):
   → readiness_scan({ paths: artifacts, updateLastScan: false }) — structural findings
   → readiness_output_checklist({ paths: artifacts }) — rubric for agent semantic review
   → Agent: read files, score met/partial/missing, show user ([output-compliance.md](./output-compliance.md))
   → workspace_check({ paths: artifacts })
   → task_record_wave({ taskId, waveId, status: "done", artifacts: [paths] })
5. After extract offered (snapshot.extractOffered): task_complete when user is done (or task_pause if user defers)
```

**Incremental continuation** (user adds chapters mid-session): see
[incremental-continuation.md](./incremental-continuation.md) — extend plan →
`task_approve_plan` before `task_record_wave` for new waves.

Pause anytime: `task_pause`. Resume: `task_resume` (validates drift before continuing).
Status without opening JSON: `npx ai-spector task status` or MCP `task_status`.

## Gated flow (every generate run, mandatory)

```
1. CHECK     readiness_config + workspace_check — fix errors before continuing
2. CLARIFY   readiness_assess → present FULL criteria table (ID, ISO, status) →
             task_update snapshot.readinessReportShown → FULL gap set → context store
3. BRIEFING  per file: criteria covered + sources + assumptions → user confirms
4. PLAN      table: output × DAG × criteria × ISO refs × sources × key points → explicit "yes"
5. GENERATE  DAG waves — after each wave: readiness_scan → readiness_output_checklist → agent compliance table → index → task_record_wave
6. EXTRACT   spec_record offer → snapshot.extractOffered → task_complete (or task_pause)
```

Stages 1–4 are **gates**: no file is written until the plan is confirmed. There is
no auto-confirm and no question cap — every gap is answered or explicitly accepted
as an assumption by the user before stage 5 (details: [clarify.md](./clarify.md),
[plan-and-briefing.md](./plan-and-briefing.md)).

## Language check (before first write)

Read **`.docops/docops.config.json`** first (contract source of truth). Use `primaryLanguage` and
`languages[]` from docops. Legacy `.ai-spector/docflow.config.json` may still exist for engine paths
and packs — **do not** use its `languages[]` when docops is present.

- **Multiple languages configured** → **ask which language(s) this run generates** in the decisions table ([plan-and-briefing.md](./plan-and-briefing.md)). Default suggestion: docops `primaryLanguage`. Then generate primary first, translate secondaries from the finished primary file.
- **Single language configured** → confirm that language in the plan header; generate only for it.
- **`languages` missing in docops** → fall back to [language-picker.md](./language-picker.md).

**Output path rule:**

| Active pack | Output path |
|-------------|-------------|
| Builtin (SRS) | `docs/srs/{lang.code}/{filename}` |
| Builtin (basic design) | `docs/basic-design/{lang.code}/{filename}` |
| Builtin (detail design) | `docs/detail-design/{lang.code}/{filename}` |
| Custom pack | Path from `doc-types/srs/dag.json` node (`output` or `outputPattern`). If the path includes `{lang}`, substitute `lang.code`. If it does not include `{lang}`, write to the path as-is (no language subfolder added automatically). |

For custom packs: **never rewrite the output path** to add a language subfolder that the manifest didn't define. Respect the path exactly as written in `doc-types/srs/dag.json`.

### Multi-language generation order (mandatory)

```
Step 1 — Generate primary language file from graph + template (same as single-language flow)
Step 2 — For each secondary language:
           Read the finished primary file from disk
           Translate prose to target language
           Write to docs/{docType}/{lang.code}/{filename}
           IDs, paths, code blocks, table keys — never translated
```

Never call the graph or templates again for secondary languages — the primary file is the single source of truth for content. Translation sub-agents receive only the primary file content, the target language label, and the enforcement rules below.

### Translation enforcement rules

1. All prose (headings, body, table cell values, bullet text, notes) → target language.
2. ID tokens stay verbatim: UC-01, F-03, `POST /checkout`, S-01, file paths, CLI commands, code blocks.
3. No mixed-language output — fix before writing if a draft mixes languages.
4. Structural template labels are translated (e.g. "## Overview" → "## 概要" in Japanese).

## Context hygiene (always)

1. Only read files listed in `projectionPaths` — no `docs/**` glob. **Exception:** during translation (step 2 of multi-language generation), you must read the finished primary language file from disk — this is the only allowed `docs/**` read outside of projectionPaths, and only for the specific file being translated.
2. Raw graph JSON stays in the sub-agent, not main context.
3. After writing a file, record path + status only; discard content.
4. For runs of 5+ files: compact after every wave + every 5 per-domain files. Load [context-management.md](./context-management.md) for the sub-agent pattern.

## Scope

| Case | User input | Behavior |
|---|---|---|
| **1 — All** | "generate all SRS" | Every DAG node. Skip `good` files unless user asked to regenerate. |
| **2 — Explicit** | file paths in chat | Map → DAG nodes → dependency closure. Same wave only. |
| **3 — Words** | "API list and screens" | Scope table → user confirms scope → continue gates. |

Scope only narrows *what* gets generated. Regardless of case, the clarify gate,
context briefing, and plan confirmation are **always mandatory** — case 1 and 2
do not skip them.

## Plan (once per invocation)

1. Select targets (case 1/2/3).
2. Run clarify ([clarify.md](./clarify.md)) — readiness report + resolve the full gap set first.
3. Topological sort + dependency closure.
4. Map DAG nodes → seeds via `dag.*.graph-seeds.json`.
5. Classify disk per **primary language** file: `good` | `missing_content` | `missing_file`.
6. For secondary languages: classify as `stale` if the primary file is newer than the translation, `missing` if the translation file does not exist, `good` if translation is up to date. **Do not skip stale translations** — they must be regenerated.
7. Present the **context briefing**, then the **plan table** with wave assignments
   ([plan-and-briefing.md](./plan-and-briefing.md)) and stop until the user says yes.

## Wave checklist

```
- [ ] Targets for this wave identified (parallel OK within wave only)
- [ ] Per target: delegate graph queries to sub-agent; receive ≤400-word summary
- [ ] Load matching srs-context/, bd-context/, or dd-context/ section for this doc type
- [ ] Read template from .ai-spector/templates/ — never invent structure
- [ ] Write primary language file from summary + template
- [ ] `readiness_scan({ paths: [written paths], updateLastScan: false })` — structural findings (headings, placeholders)
- [ ] `readiness_output_checklist({ paths })` → read files → **Output compliance** table for user (met/partial/missing per criterion)
- [ ] `workspace_check({ paths: ["docs/{docType}/{primaryLang}/{filename}"] })` — STRUCT-004 must pass (move file if misplaced)
- [ ] [PAUSE — translation prompt] (see below)
- [ ] Merge projection patch (rendersTo + dependsOn) for the wave
- [ ] npx ai-spector graph validate
- [ ] npx ai-spector index (basic design and detail design: every wave; SRS: see runbook)
- [ ] `task_record_wave` with artifact paths for this wave
- [ ] /compact with plan summary before next wave
```

Per target: Delegate → Receive summary → Write primary → Translation prompt → Translate if approved → Log path/status → Ingest.

## Translation prompt (mandatory pause after each primary file write)

After writing or updating **any primary language file**, and when secondary languages are configured in `docflow.config.json`, you **must** stop and ask:

```
I've updated `docs/{docType}/{primaryLang.code}/{filename}`.

This project also has translations configured: {secondaryLangs joined by ", "}.
Do you want me to update the translation(s) now?

  1. Yes, update all translations now
  2. Yes, but only: [user can name specific languages]
  3. No, I'll handle translations separately
```

**Wait for the user's reply before proceeding.**

- **Reply 1 or 2** → for each approved secondary language: read the finished primary file, translate prose, write to `docs/{docType}/{lang.code}/{filename}`. Then continue the checklist.
- **Reply 3** → defer translation; after `npx ai-spector index`, pending jobs are tracked in `.ai-spector/.docflow/translation-queue/pending.json`. User can check with `ai-spector-lang-status` and sync later with `ai-spector-resolve-translation`.

### When to skip the prompt

Skip the prompt (proceed directly to translation) only when the user has **already pre-approved** translations in this session with a phrase like:
- "generate everything in all languages"
- "update all translations automatically"
- "yes to all translations"

If pre-approved, translate immediately after each primary write without asking again for the rest of the session.

## Translation queue (automatic)

After any language file write, `npx ai-spector index` reconciles the translation queue:
- File-level jobs in `pending.json` / `resolved.json` / `failed.json` (whole document per job)
- Direct edits to secondary language files create **inbound** jobs
- Query: `npx ai-spector lang queue pending --json`

## Guardrails

- Parallel only within a wave.
- Sub-agent per target — never reuse a previous target's summary.
- No raw graph JSON in main context.
- No speculative reads — projectionPaths only.
- **Every** run requires briefing + plan confirmation before any write — no exceptions.
- Never silently swap context after the briefing was confirmed — re-run clarify/plan instead.
- On CLI failure → load [cli-failures.md](./cli-failures.md).

## After manual doc edits

When any doc under `docs/` is edited outside generate skills, follow `.cursor/rules/ai-spector-after-doc-edit.mdc`:

1. `npx ai-spector graph impact --git --json` (or `--file`) — MCP: `graph_impact({ git: true, change: "content_change" })`
2. `npx ai-spector index` (refreshes translation queue)

## Finish

1. `npx ai-spector graph validate`
2. `npx ai-spector index` if not already run after last wave
3. **Extract key specs** from the generated documents and offer to queue them for
   review — [extract-specs.md](./extract-specs.md). Approved specs merge to the
   graph; nothing is ever written to `docs/data-source/`.
4. `task_update({ patch: { snapshot: { extractOffered: true }, step: { id: "extract", patch: { status: "done" } } } })`
   — **required** before `task_complete` (MCP enforces extract gate).
5. `task_complete` or `task_pause` if user defers review
6. Suggest summary command when runbook lists one
