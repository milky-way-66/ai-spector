# Document generation workflow

Used by SRS and basic design skills.

**References (load when needed):**
- Graph queries / merge / ingest → [generate-graph.md](./generate-graph.md)
- Context compaction / sub-agents → [context-management.md](./context-management.md)
- CLI failures → [cli-failures.md](./cli-failures.md)

## Language check (before first write)

Read `.ai-spector/.docflow/config/language.json`. If `documentLanguage` is empty or missing, load [language-picker.md](./language-picker.md) and run the picker. All content in the chosen language; IDs, paths, code never translated.

## Context hygiene (always)

1. Only read files listed in `projectionPaths` — no `docs/**` glob.
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
4. Classify disk: `good` | `missing_content` | `missing_file`.
5. Assign waves; present wave table.

## Wave checklist

```
- [ ] Targets for this wave identified (parallel OK within wave only)
- [ ] Per target: delegate graph queries to sub-agent; receive ≤400-word summary
- [ ] Load matching srs-context/ or bd-context/ section for this doc type
- [ ] Read template from .ai-spector/templates/ — never invent structure
- [ ] Write file from summary + template
- [ ] Merge projection patch (rendersTo + dependsOn) for the wave
- [ ] ai-spector graph validate
- [ ] ai-spector index (basic design: every wave; SRS: see runbook)
- [ ] /compact with plan summary before next wave
```

Per target: Delegate → Receive summary → Write → Log path/status → Ingest.

## Guardrails

- Parallel only within a wave.
- Sub-agent per target — never reuse a previous target's summary.
- No raw graph JSON in main context.
- No speculative reads — projectionPaths only.
- Case 3 requires explicit yes before any write.
- On CLI failure → load [cli-failures.md](./cli-failures.md).

## Finish

1. `ai-spector graph validate`
2. `ai-spector index` if not already run after last wave
3. Suggest summary command when runbook lists one
