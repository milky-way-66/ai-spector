# Document generation workflow (shared)

Used by **SRS**, **basic design**, and **detail design** generation skills.

| Topic | Document |
|-------|----------|
| Graph query, merge patch shape, waves algorithm | [generate-graph.md](./generate-graph.md) |
| CLI failure recovery (fix / workaround / pause) | [cli-failures.md](./cli-failures.md) |
| Layer-specific DAG, intent tables, waves | each skill’s `references/runbook.md` |

**Not used by** HTML prototype generation (`ai-spector-generate-prototype` runbook).

## Philosophy

- **Accuracy over speed** — full graph context before every write; ingest before the next wave.
- **Graph in, graph out** — query neighbors + dependencies before; `rendersTo` + `dependsOn` after ([generate-graph.md](./generate-graph.md) § E).
- **Parallel when safe** — only targets in the **same DAG wave** with dependencies already merged + validated (and **indexed** when the command doc requires it).

## Scope — three ways to choose targets

Each generate command defines its DAG and intent hints. The pattern is always:

| Case | User input | Agent behavior |
|------|------------|----------------|
| **1 — All** | “generate all SRS” / full layer | Plan every DAG node (+ per-domain expansions). Respect `good` on disk unless user asked to regenerate. |
| **2 — Explicit paths** | paths in chat (`docs/…/file.md`) | Map paths → DAG nodes → seeds. Include **dependency closure**. Batch only within the same wave. |
| **3 — Words** | “API list and screens” | Proposed scope table → **user confirms** → generate. **Do not write until approved.** |

Paths are repo-relative. Mixed args: treat paths as case 2, free text as case 3.

## Case 3 — confirm before write (mandatory)

1. Parse the request against that command’s `dag.*.json`, `dag.*.graph-seeds.json`, and graph domain nodes.
2. Build a **proposed scope** table (columns: DAG id, output path, seed, reason, prerequisites / deps).
3. Include **dependency closure** — ancestors that are `missing_file` / `missing_content` run in earlier waves unless the user skips deps.
4. Ask:

```text
I plan to generate the following (N items, waves X–Y). Prerequisites run first.
Reply **yes** to proceed, **no** to cancel, or edit the list.
```

5. **Stop** without explicit **yes**. Do not write on assumption.
6. If ambiguous (e.g. “features” = list vs all detail files), ask **one** clarifying question before the table.

Command-specific phrase → DAG mappings live in each `generate-*.md` (not here).

## Prerequisites (all DAG generate commands)

1. Merged graph — normally after **analyze** (data-source ingest).
2. Gate:

```bash
ai-spector graph validate
```

On errors, pause and follow recovery in [cli-failures.md](./cli-failures.md).

3. `workflow.dependencies.json` entry for that command (SRS minimum, etc.).

## Plan (once per invocation)

1. **Select targets** (case 1 / 2 / 3; case 3 = confirm first).
2. Topological sort selected nodes + required dependency ancestors.
3. Map each node via `dag.*.graph-seeds.json` → query seeds + ingest document ids.
4. Classify disk per output: `good` | `missing_content` | `missing_file` — do not overwrite `good` without user intent.
5. Assign **waves** ([generate-graph.md](./generate-graph.md) § Waves). Present wave table (brief for cases 1–2; case 3 table already confirmed).

## Per wave, then per target

For **each wave** in order:

### Wave checklist

```
- [ ] All targets in this wave identified (parallel OK within wave only)
- [ ] For each target: graph query deps + target (_generate-graph § C)
- [ ] Read template from .ai-spector/templates/ — never invent structure
- [ ] Write file(s)
- [ ] Merge projection patch (rendersTo + dependsOn) for this wave
- [ ] ai-spector graph validate — pass before next wave
- [ ] ai-spector index when command doc requires (basic design: every wave; SRS: see generate-srs.md)
```

### Per target (summary)

Details: [generate-graph.md](./generate-graph.md) § C–E.

1. **Query** — dependency seeds (depth 2) + target seed (depth 4); `graph impact` when regenerating.
2. **Read** — `projectionPaths` and cited `docs/data-source/**` only; no glob of entire `docs/`.
3. **Write** — from DAG template; graph-backed UC/F/API/screen names only.
4. **Ingest** — merge patch; validate before leaving the wave.

**Forbidden:** targets from different waves in one batch; next wave before merge + validate; skipping `rendersTo` on generated docs.

### Log (optional)

Append one line per target to `.ai-spector/.docflow/logs/generate-<layer>.log` (create dir if needed): timestamp, seed, path, validate OK.

## Finish (end of command)

1. `ai-spector graph validate`
2. `ai-spector index` if not already run after the last wave (required for SRS — see `generate-srs.md`)
3. Suggest the command doc’s summary command (`/summary srs`, `/summary basic-design`, …) when listed there
4. Optional: `/visualize-graph` for review

Index flags: `--skip-doc-semantics` to skip UC/F body parsing; `--graph-only` for structure + merge only.

## Guardrails

- **Parallel only within a wave** — never across waves; never when A `dependsOn` B in the DAG.
- **Every target** gets its own `graph query` + dependency queries before write.
- **Every wave** ends with merge + validate (and **index** when the command doc says so) before the next wave.
- **Case 3** requires explicit user **yes** before any write.
- On `graph query` / `merge` / `validate` / `index` failure → pause and recover per [cli-failures.md](./cli-failures.md).
- Prefer graph `nodes`/`edges` over stale `knowledge.json` for generation text.

## If blocked

[cli-failures.md](./cli-failures.md). Re-run the same task after fixes. Common upstream fix: **analyze** first, or generate SRS before basic design.
