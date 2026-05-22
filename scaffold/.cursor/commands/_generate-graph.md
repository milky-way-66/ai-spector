# Graph-first generation (shared)

Used by **`/generate-srs`**, **`/generate-basic-design`**, **`/generate-detail-design`**.

Each command has its own `dag.*.json`, `dag.*.graph-seeds.json`, and § Case 3 intent tables in its command file.

**Principle:** Accuracy over speed. The graph is the planner, context loader, and registry of what was written.

**Parallelism:** Allowed **only inside a DAG wave** — targets that do not depend on each other (and whose dependencies are already ingested). Never parallelize across waves.

## Agent rules (non-negotiable)

1. **Plan from DAG + graph** — build **waves** from `dag.*.json` (see § Waves); map each node to a graph seed via `dag.*.graph-seeds.json`.
2. **Context before write** — for **every** target (batch or single), run CLI queries below; read `projectionPaths` and domain `nodes`/`edges`. No invented UC/F text.
3. **Dependencies before write** — for each target’s `dependsOn`, `graph query` dependency seeds and **read existing markdown** when `rendersTo` exists.
4. **Ingest before next wave** — after each file (or after a whole wave), merge `rendersTo` + `dependsOn` (see § Ingest), then `graph validate`. The next wave must see upstream `rendersTo` edges.
5. **No shortcuts** — no glob `docs/srs/**`, no skipping validate/query, no index-first generation, no batching targets that have a DAG dependency on each other.

## CLI workflow per target

### A. Gate (once per command)

```bash
ai-spector graph validate
```

### B. Plan

- Load `dag.srs.json` (or matching DAG).
- Load `dag.srs.graph-seeds.json` for `document` seeds.
- Build **waves** (below).
- Skip `good` files unless user asked to regenerate; use `graph impact` when replacing content.

#### Waves (when batch is allowed)

Assign each DAG node to wave `0`, `1`, `2`, …:

- **Wave 0:** nodes with empty `dependsOn`.
- **Wave k:** nodes whose `dependsOn` are all in waves `< k` (not in the same wave).

**Same wave = safe to generate in parallel** (no target in the wave depends on another target in that wave).

**Example** (`dag.srs.json`): after `srs.feature-details`, both `srs.data-requirements` and `srs.external-interfaces` are in the **same wave** (each depends on feature-details only, not on each other) → may generate both in one batch.

**Forbidden batch:** `srs.use-cases` + `srs.features-list` (features-list depends on use-cases).

**User asks for specific files** (case 2): map paths → DAG nodes; include dependency closure; batch only within same wave.

**User describes scope in words** (case 3): map intent → proposed DAG nodes + paths → **get user confirmation** before any `graph query` / write (see `generate-srs.md` § Case 3).

Present plan as:

| Wave | DAG ids (parallel OK within row) | Seeds | Blocked until |
|------|----------------------------------|-------|---------------|
| 0 | … | … | — |
| 1 | … | … | wave 0 merged + validate |

### C. Before writing file `T`

**1. Dependency context** (each DAG `dependsOn` id → graph seed):

```bash
ai-spector graph query <depSeedId> --direction both --depth 2 --edges rendersTo,dependsOn,listedIn,satisfies,definedIn,partOf,contains --json
```

Open existing `projectionPaths` from the JSON (already-generated SRS chapters).

**2. Target neighborhood** (domain + structure):

```bash
ai-spector graph query <targetSeedId> --direction both --depth 4 --edges listedIn,definedIn,describedIn,satisfies,dependsOn,references,rendersTo,partOf,contains --json
```

**3. Impact scope** (when regenerating or unsure):

```bash
ai-spector graph impact <targetSeedId> --change content_change --json
```

Respect `regenerate` / `review` buckets; do not rewrite unrelated chapters.

**4. Data-source supplement** — only for gaps after graph query succeeds; cite paths in the doc.

### D. Write

- **Read the template** from `.ai-spector/templates/` (path = DAG `template` value, e.g. `srs/3-use-cases.md`, `basic_design/list-api-template.md`). If missing, stop and ask the user to run `npx ai-spector init`.
- Fill that template for the target only — keep all required headings/sections; replace placeholders with graph-backed content.
- Cross-check every UC/F reference against `nodes` from query JSON.
- Add section anchors `<!-- section:sec.... -->` where templates expect them.

### E. Ingest (mandatory — per file or per wave)

After **each file**, or once at **end of a parallel wave** (single patch listing all files in that wave):

Write `.ai-spector/.docflow/extract/projection-patch.json`:

```json
{
  "version": 1,
  "nodes": [],
  "edges": [
    { "type": "rendersTo", "from": "doc.srs.3-use-cases", "to": "docs/srs/3-use-cases.md" },
    { "type": "dependsOn", "from": "doc.srs.3-use-cases", "to": "doc.srs.1-introduction" },
    { "type": "dependsOn", "from": "doc.srs.3-use-cases", "to": "doc.srs.2-overall-description" }
  ]
}
```

Then:

```bash
ai-spector graph merge .ai-spector/.docflow/extract/projection-patch.json
ai-spector graph validate
```

- `rendersTo`: `from` = graph `document` (or section) id, `to` = repo-relative markdown path.
- `dependsOn`: mirror DAG edges between **document** ids (downstream queries use these for context).
- Per-domain files (`UC-01`, `F-01`): also link `definedIn` from domain node to detail sections if applicable.

**Wave rule:** finish all writes in wave `k`, merge **all** `rendersTo` / `dependsOn` for that wave, `graph validate`, then start wave `k+1`.

Alternative repair: **`/sync-graph`** — not a substitute for merge between waves.

### F. Per-domain detail files

For `mode: perFeature` / `perDomain` DAG nodes:

- Seed = domain id (`UC-01`, `F-01`), not only chapter document.
- Query with `--depth 4`; include inbound `satisfies` / `dependsOn`.
- `rendersTo` from resolved output path (e.g. `docs/srs/03-use-cases/uc-01-....md`).

## Accuracy checklist (before marking target done)

- [ ] `graph query` run for target and every DAG dependency with existing files
- [ ] All UC/F ids in markdown exist as graph nodes
- [ ] `rendersTo` + `dependsOn` merged for this file
- [ ] `graph validate` passes
- [ ] No placeholder lorem / empty tables unless marked TBD in `gaps.json`

## On CLI failure

[_cli-failures.md](./_cli-failures.md) — stop; do not generate from memory.
