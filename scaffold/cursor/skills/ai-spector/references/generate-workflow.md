# Document generation workflow

Used by SRS and basic design skills.

**References (load when needed):**
- Graph queries / merge / ingest → [generate-graph.md](./generate-graph.md)
- Context compaction / sub-agents → [context-management.md](./context-management.md)
- CLI failures → [cli-failures.md](./cli-failures.md)

## Language check (before first write)

Read `.ai-spector/docflow.config.json` at the project root. Check the `languages` array:

- **Multiple languages configured** → generate primary language first, then translate to secondary languages from the primary output. Never generate secondary languages independently from the graph — always translate from the finished primary file.
- **Single language configured** → generate only for that language under `docs/srs/{lang.code}/` (e.g. `docs/srs/en/`).
- **`languages` missing** → fall back to reading `.ai-spector/.docflow/config/language.json`. If `documentLanguage` is empty or missing, load [language-picker.md](./language-picker.md) and run the picker. Write output to `docs/srs/en/` (primary).

Output path rule: always `docs/{docType}/{lang.code}/{filename}` — never directly under `docs/srs/` without a language subfolder.

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
| **3 — Words** | "API list and screens" | Scope table → user confirms → generate. No write before yes. |

Case 3: build scope table (DAG id, output path, seed, reason, deps) → ask → stop until confirmed.

## Plan (once per invocation)

1. Select targets (case 1/2/3).
2. Topological sort + dependency closure.
3. Map DAG nodes → seeds via `dag.*.graph-seeds.json`.
4. Classify disk per **primary language** file: `good` | `missing_content` | `missing_file`.
5. For secondary languages: classify as `stale` if the primary file is newer than the translation, `missing` if the translation file does not exist, `good` if translation is up to date. **Do not skip stale translations** — they must be regenerated.
6. Assign waves; present wave table (include secondary language status columns if multi-language).

## Wave checklist

```
- [ ] Targets for this wave identified (parallel OK within wave only)
- [ ] Per target: delegate graph queries to sub-agent; receive ≤400-word summary
- [ ] Load matching srs-context/ or bd-context/ section for this doc type
- [ ] Read template from .ai-spector/templates/ — never invent structure
- [ ] Write primary language file from summary + template
- [ ] [PAUSE — translation prompt] (see below)
- [ ] Merge projection patch (rendersTo + dependsOn) for the wave
- [ ] npx ai-spector graph validate
- [ ] npx ai-spector index (basic design: every wave; SRS: see runbook)
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
- **Reply 3** → note which files have stale translations (so the user can run `ai-spector-lang-status` later), then continue the checklist without translating.

### When to skip the prompt

Skip the prompt (proceed directly to translation) only when the user has **already pre-approved** translations in this session with a phrase like:
- "generate everything in all languages"
- "update all translations automatically"
- "yes to all translations"

If pre-approved, translate immediately after each primary write without asking again for the rest of the session.

## Guardrails

- Parallel only within a wave.
- Sub-agent per target — never reuse a previous target's summary.
- No raw graph JSON in main context.
- No speculative reads — projectionPaths only.
- Case 3 requires explicit yes before any write.
- On CLI failure → load [cli-failures.md](./cli-failures.md).

## Finish

1. `npx ai-spector graph validate`
2. `npx ai-spector index` if not already run after last wave
3. Suggest summary command when runbook lists one
