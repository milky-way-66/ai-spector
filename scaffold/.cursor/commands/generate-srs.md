# /generate-srs

Generate SRS markdown **from the traceability graph** — carefully, in DAG order, ingesting each file back into the graph.

**User runs this command;** the agent runs CLI. Shared graph-first rules: [**_generate-graph.md**](./_generate-graph.md).

## Philosophy

- **Accuracy over speed** — full graph context before every write; ingest before the next wave.
- **Graph in, graph out** — query neighbors + dependencies before; `rendersTo` + `dependsOn` after.
- **Parallel when safe** — targets in the **same DAG wave** (no `dependsOn` between them) may be generated in one batch; never skip query/ingest per file.

## Usage — three ways to choose targets

| Case | User says | Agent behavior |
|------|-----------|----------------|
| **1 — All (default)** | `/generate-srs` | Plan **every** DAG node (respect `good` / skip unless regen requested). Full wave walk. |
| **2 — Explicit files** | `/generate-srs docs/srs/3-use-cases.md` or `/generate-srs file1.md file2.md` | Map paths → DAG nodes → seeds. Add **DAG dependencies** not on disk yet. Batch only within same wave. |
| **3 — Request in words** | `/generate-srs general use case chapter and features` | Resolve intent → proposed file list → **confirm with user** → then same as case 2. **Do not generate until user approves.** |

Arguments after the command are either **file paths** (case 2) or a **free-text request** (case 3). If mixed, treat paths as explicit and text as request.

## Case 3 — resolve request and confirm (mandatory)

1. Parse the user’s words against `dag.srs.json`, `dag.srs.graph-seeds.json`, and graph domain nodes (`useCase`, `feature`).
2. Build a **proposed scope** table:

| # | DAG id | Output path | Seed | Reason matched | Also generate deps? |
|---|--------|-------------|------|----------------|---------------------|
| 1 | `srs.use-cases` | `docs/srs/3-use-cases.md` | `doc.srs.3-use-cases` | “use case chapter” | yes — `srs.introduction`, `srs.overall-description` if missing |

3. Include **dependency closure**: any DAG `dependsOn` ancestor that is `missing_file` / `missing_content` must be listed (generated first in earlier waves) unless user says to skip deps.
4. Ask explicitly:

```text
I plan to generate the following (N files, waves X–Y). Dependencies marked “prerequisite” run first.
Reply **yes** to proceed, **no** to cancel, or edit the list (e.g. “skip introduction”, “add 5-data-requirements”).
```

5. **Stop** if the user does not confirm. Do not write SRS files on assumption.
6. If the request is ambiguous (e.g. “features” = list only vs all F-xx detail files), ask one clarifying question **before** the confirmation table.

### Intent → DAG hints (not exhaustive)

| User phrase (examples) | Typical DAG / outputs |
|------------------------|------------------------|
| introduction, purpose, scope | `srs.introduction` |
| overall, actors, users, §2 | `srs.overall-description` |
| use case(s), UC, §3, chapter 3 | `srs.use-cases` (+ optional `UC-xx` detail if “all UC details”) |
| feature list, §4.2, system features | `srs.features-list` |
| feature detail, per feature, F-xx | `srs.feature-details` (`F-01`, … from graph) |
| data, entities, §5 | `srs.data-requirements` |
| interfaces, API, §6 | `srs.external-interfaces` |
| NFR, quality, §7 | `srs.quality-attributes` |
| i18n, localization, §8 | `srs.internationalization` |
| legal, compliance, §9 | `srs.other-requirements` |
| “everything” / no filter | Case 1 — full DAG |

## Prerequisites

`workflow.dependencies.json` → `generate-srs`. Requires merged graph (`/analyze`), passing **`ai-spector graph validate`**.

Config:

- `dag.srs.json` — generation order + `dependsOn`
- `dag.srs.graph-seeds.json` — DAG id → `doc.srs.*` graph seed
- `completeness-rules.srs.json` — quality checks

## Required behavior

### 1. Gate

```bash
ai-spector graph validate
```

Stop if errors — [_cli-failures.md](./_cli-failures.md).

### 2. Plan (graph + DAG)

1. **Select targets** using Usage case 1, 2, or 3 above. For case 3, run § “confirm” first.
2. Topological sort **selected** nodes plus any required dependency ancestors.
3. Map each node with `dag.srs.graph-seeds.json` → `targetSeedId` (`doc.srs.*` or `UC-xx` / `F-xx` for per-domain).
4. Classify disk: `good` | `missing_content` | `missing_file` — do not overwrite `good` unless user asked to regenerate (explicit path or confirmed scope).
5. Group into **waves** (see _generate-graph.md § Waves). Present final wave table (cases 1–2: brief; case 3: already confirmed).

### 3. Per wave, then per target

For **each wave** in order:

1. All targets in this wave may run **in parallel** only if they do not depend on each other (true by wave definition).
2. For **each** target in the wave (parallel or serial):

#### 3a. Load context (CLI)

Per [_generate-graph.md](./_generate-graph.md):

- `graph query` each **DAG dependency** that should already exist (depth 2, include `rendersTo`).
- `graph query` **target** seed (depth **4**, full generate edge set).
- `graph impact <targetSeedId> --json` when replacing or ambiguous scope.

Read **only** paths from `projectionPaths` plus targeted `docs/data-source/**` for gaps.

#### 3b. Write one file

- Use template from `node_modules/ai-spector/templates/srs/` (or monorepo `../templates/srs/`).
- Content must match graph: UC list from `listedIn` on `useCase` nodes; features from `feature` + `satisfies`.
- No fabricated requirements.

#### 3c. Ingest into graph (mandatory before next wave)

After each file **or** once per wave (combine all edges in one patch):

```bash
ai-spector graph merge .ai-spector/.docflow/extract/projection-patch.json
ai-spector graph validate
```

Do not start the **next wave** until validate passes.

Patch must include at minimum:

- `rendersTo` — `from`: document id, `to`: actual file path
- `dependsOn` — `from`: downstream doc id, `to`: each upstream doc id from DAG (same generation wave)

Example for `srs.use-cases` → `doc.srs.3-use-cases`:

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

**Forbidden:** finishing without `rendersTo` on all generated documents; skipping merge between **waves**; batching targets from different waves (e.g. use-cases + features-list together).

#### 3d. Log

Append to `.ai-spector/.docflow/logs/generate-srs.log` (create if needed): timestamp, seed, path, validate OK.

### 4. Finish

- Final `ai-spector graph validate`.
- Optional: `/visualize-graph` for user review.
- Suggest `/index-docs srs` only after graph ingest is complete.

## Waves (reference)

| Wave | DAG examples | Seed type |
|------|----------------|-----------|
| 0 | `srs.introduction`, `srs.overall-description` | `doc.srs.*` |
| 1 | `srs.use-cases` | `doc.srs.3-use-cases` + domain queries for §3.2 |
| 2 | `srs.features-list` | `doc.srs.4-system-features` |
| 3 | `srs.feature-details` | `F-xx` per file |
| 4 | data, interfaces, NFR chapters | `doc.srs.5-*` … with deps via `dependsOn` queries |

## Guardrails

- **Parallel only within a wave** — never across waves; never when A `dependsOn` B in the DAG.
- **Every target** gets its own `graph query` + dependency queries before write (parallel OK).
- **Every wave** ends with `graph merge` + `graph validate` before the next wave.
- On `graph query` / `merge` / `validate` failure → stop per _cli-failures.md.
- Prefer graph `nodes`/`edges` over `knowledge.json` for generation text.

## If blocked

[_cli-failures.md](./_cli-failures.md). User re-runs **`/generate-srs`** after fixes.

Common fix: run `/analyze` if domain nodes missing; run ingest merge if downstream query returns empty `rendersTo` for dependencies.
