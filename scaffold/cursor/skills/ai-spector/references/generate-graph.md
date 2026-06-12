# Graph-first generation (shared)

Used by **SRS** and **basic design** generation skills.

| Orchestration (scope, confirm, wave checklist, finish) | [generate-workflow.md](./generate-workflow.md) |
| Per-command DAG + intent tables | each skill's `references/runbook.md` |

**Principle:** Accuracy over speed. The graph is the planner, context loader, and registry of what was written.

**Parallelism:** Allowed **only inside a DAG wave**. Never across waves.

## Edge presets (use these in queries — don't copy-paste long lists)

| Preset name | Edges | Use for |
|-------------|-------|---------|
| `CONTEXT` | `listedIn,definedIn,describedIn,satisfies,dependsOn,rendersTo,partOf,contains` | Target neighborhood — what exists and where it lives |
| `DEPS` | `rendersTo,dependsOn,listedIn,satisfies,partOf,contains` | Dependency context — what upstream docs look like |
| `IMPACT` | `satisfies,tracesTo,dependsOn,references,relatesTo` | What a change would affect |

## Agent rules

1. **Plan from DAG** — build waves from `dag.*.json`; map each DAG node → graph seed via `dag.*.graph-seeds.json`.
2. **Context before write** — for **every** target run the CONTEXT query; read `projectionPaths`. No invented UC/F text.
3. **Merge once per wave, not per file** — write all files in a wave, then do one batch merge + one validate. Do not merge after every file.
4. **No shortcuts** — no glob `docs/srs/**`, no skipping validate, no batching targets that have a DAG dependency on each other.

## CLI workflow

### A. Gate (once per command)

```bash
npx ai-spector graph validate
```

### B. Plan — waves

Assign each DAG node to wave `0`, `1`, `2`, …:

- **Wave 0:** nodes with empty `dependsOn`
- **Wave k:** nodes whose `dependsOn` are all in waves `< k`

**Same wave = parallel OK.** Example: after `srs.feature-details`, both `srs.data-requirements` and `srs.external-interfaces` are in the same wave → generate both in one batch.

Present plan as:

| Wave | DAG ids (parallel OK) | Seeds | Blocked until |
|------|----------------------|-------|---------------|
| 0 | … | … | — |
| 1 | … | … | wave 0 merged + validate |

### C. Before writing each target

**Dependency context** (once per wave, for each DAG `dependsOn`):

```bash
npx ai-spector graph query <depSeedId> --direction both --depth 2 --edges DEPS --json
```

**Target neighborhood:**

```bash
npx ai-spector graph query <targetSeedId> --direction both --depth 4 --edges CONTEXT --json
```

**When regenerating** (unsure what changed):

```bash
npx ai-spector graph impact <targetSeedId> --change content_change --json
```

### D. Write

- Read template from `.ai-spector/templates/` (DAG `template` field). If missing → stop and ask user to run `npx ai-spector init`.
- **Before filling the template**, load the matching context section for this doc type:
  - SRS targets → `srs-context/<section>.md` (see SRS runbook for the table)
  - Basic design targets → `bd-context/<doc-type>.md` (see BD runbook for the table)
  - Prototype screens → [prototype-graph-context.md](../../ai-spector-generate-prototype/references/prototype-graph-context.md)
- Fill for this target only; keep all required headings; replace placeholders with graph-backed content.
- Cross-check every UC/F reference against `nodes` from query JSON.
- Add section anchors `<!-- section:sec.... -->` where templates expect them.
- **Never invent** field names, endpoint paths, table names, actor roles, or business rules not present in the query results.

### E. Ingest (once per wave — not per file)

After **all files in a wave** are written, write a single patch covering the whole wave:

```json
{
  "version": 1,
  "nodes": [],
  "edges": [
    { "type": "rendersTo", "from": "doc.srs.3-use-cases", "to": "docs/srs/en/3-use-cases.md" },
    { "type": "dependsOn", "from": "doc.srs.3-use-cases", "to": "doc.srs.1-introduction" }
  ]
}
```

```bash
npx ai-spector graph merge .ai-spector/.docflow/extract/projection-patch.json
npx ai-spector graph validate
```

Then — for SRS and basic-design waves — run index before starting the next wave:

```bash
npx ai-spector index
```

**Exception:** if a file within the wave is a dependency for another file in the **same** wave (unusual — check the DAG), merge that file's `rendersTo` before writing the dependent. For standard DAGs this never happens within a wave.

### F. Per-domain detail files (breakout wave)

**Every breakout file requires its own graph query.** This applies to builtin SRS per-UC/feature files and to custom pack breakout templates equally.

#### Required per-item workflow (one item at a time)

```
1. npx ai-spector graph query <itemId> --direction both --depth 4 --edges CONTEXT --json
2. Read projectionPaths from result — these are the only allowed source files
3. Load the breakout template (.ai-spector/packs/<name>/templates/<template> or .ai-spector/templates/)
4. Write the output file with specific, verifiable content from graph context
5. Repeat for next item
```

After **all items in the wave** are written, do one batch merge + validate + index:
```bash
npx ai-spector graph merge .ai-spector/.docflow/extract/projection-patch.json
npx ai-spector graph validate
npx ai-spector index
```

**"Batch" means batch the wave-end merge — not the file generation.** Each file must be written from its own graph query result.

#### ⛔ Anti-pattern — script generation

```js
// WRONG — never do this
for (const item of knowledge.functionalRequirements) {
  writeFile(`req-${item.id}.md`, fillTemplate(item));
}
```

A script over `knowledge.json` bypasses the graph. The files it produces pass `graph validate` and `index`, but contain boilerplate acceptance criteria, wrong language, and no domain context. **Treat any script-generated breakout file as a stub that must be regenerated per the workflow above.**

#### Large sets (10+ items)

Use sub-agents — one sub-agent per item or 3–5 items per agent. Do not attempt all items in one agent context. Load [context-management.md](./context-management.md) for the sub-agent pattern.

#### Builtin SRS (useCase / feature)

- Seed = domain id (`UC-01`, `F-01`), not only chapter document.
- Query with `--depth 4` + CONTEXT edges; include inbound `satisfies`.

#### Basic design (perEndpoint / perScreen)

- **perEndpoint:** read `docs/basic-design/api-list.md` §3; one file per row under `docs/basic-design/api/<slug>.md`.
- **perScreen:** read `docs/basic-design/list-screens.md` §4; one file per screen under `docs/basic-design/screens/<slug>.md`.
- Ingest `doc.bd.api-*` / `doc.bd.screen-*` with `contains` from list chapter in the wave-end merge.

## Accuracy checklist

- [ ] `graph query` run for target and every DAG dependency with existing files
- [ ] All UC/F ids in markdown exist as graph nodes
- [ ] Wave-end `rendersTo` + `dependsOn` merged in one patch
- [ ] `graph validate` passes before next wave
- [ ] No placeholder lorem / empty tables unless marked TBD in `gaps.json`

## On CLI failure

[cli-failures.md](./cli-failures.md) — pause; offer fix / workaround / pause; do not generate from memory.
