# /generate-basic-design

Generate basic design markdown **from the traceability graph** and upstream SRS — same discipline as `/generate-srs`.

**User runs this command;** the agent runs CLI. Shared rules: [**_generate-graph.md**](./_generate-graph.md). On CLI failure: [_cli-failures.md](./_cli-failures.md).

## Philosophy

- **Accuracy over speed** — query graph + SRS/basic-design neighbors before each write; ingest before the next wave.
- **SRS is upstream context** — query `rendersTo` paths to `docs/srs/**` for dependencies; do not invent APIs/screens not grounded in graph + SRS.
- **Parallel when safe** — same DAG wave only (see `dag.basic-design.json`).

## Usage — three ways to choose targets

| Case | User says | Agent behavior |
|------|-----------|----------------|
| **1 — All (default)** | `/generate-basic-design` | Plan **every** node in `dag.basic-design.json` (+ per-domain expansions). |
| **2 — Explicit files** | `/generate-basic-design docs/basic-design/api-list.md` | Map paths → DAG nodes → seeds. Include DAG `dependsOn` prerequisites. Same-wave batch OK. |
| **3 — Request in words** | `/generate-basic-design API list and DB design for checkout` | Resolve intent → **proposed scope table** → user confirms → generate. **Do not write until approved.** |

Arguments are **file paths** (case 2) or **free-text** (case 3). Paths are under `docs/basic-design/` unless the user gives a repo-relative path.

## Case 3 — resolve request and confirm (mandatory)

1. Parse against `dag.basic-design.json`, `dag.basic-design.graph-seeds.json`, and graph (`feature`, `useCase`, SRS `document` nodes with `rendersTo`).
2. Proposed scope table:

| # | DAG id | Output | Query seed | Reason | Prerequisites |
|---|--------|--------|------------|--------|---------------|
| 1 | `bd.list-api` | `docs/basic-design/api-list.md` | `doc.srs.6-external-interfaces` | “API list” | SRS §6 if missing |
| 2 | `bd.detail-api` | `docs/basic-design/api/…` | `F-01`, … | “APIs for feature X” | `bd.list-api`, SRS features |

3. Include **dependency closure** from `dag.basic-design.json` and missing SRS files (minimum: introduction + features per `workflow.dependencies.json`).
4. Ask:

```text
I plan to generate the following basic design artifacts (N items, waves X–Y).
Reply **yes** to proceed, **no** to cancel, or edit the list.
```

5. **Stop** without user confirmation.
6. Clarify ambiguity early (e.g. “all API details” = every `F-xx` vs one feature; “screens” = list vs all screen detail files).

### Intent → DAG hints

| User phrase (examples) | Typical DAG / outputs |
|------------------------|------------------------|
| database, DB, ERD, data model | `bd.db-design` → `db-design.md` |
| API list, endpoints overview | `bd.list-api` → `api-list.md` |
| API detail, per endpoint, REST | `bd.detail-api` → `docs/basic-design/api/` (per feature / endpoint) |
| screen list, UI list | `bd.list-screen` → `screens/list-screens.md` |
| screen detail, wireframe, per screen | `bd.detail-screen` → `docs/basic-design/screens/` |
| one feature, F-01, checkout | `F-01` seeds for api/screen detail under that feature |
| everything, full basic design | Case 1 — full DAG |

## Prerequisites

`workflow.dependencies.json` → `generate-basic-design`. Requires:

- Merged graph (`/analyze`), **`ai-spector graph validate`**
- Minimum SRS on disk (see workflow checks)
- Recommended: `/index-docs srs` for summaries; refresh `/index-docs basic-design` after this command

Config:

- `dag.basic-design.json` — order + `dependsOn`
- `dag.basic-design.graph-seeds.json` — DAG id → SRS/graph query seed + `documentNodes` for ingest
- `completeness-rules.basic-design.json`

## Required behavior

### 1. Gate

```bash
ai-spector graph validate
```

### 2. Plan (graph + DAG)

1. **Select targets** (case 1 / 2 / 3; case 3 = confirm first).
2. Topological sort selected nodes + dependency ancestors (`bd.detail-api` after `bd.list-api`, etc.).
3. Map seeds via `dag.basic-design.graph-seeds.json`:
   - Chapter artifacts → `documentNodes` id for ingest + SRS seed for **query**
   - `perEndpoint` / `perScreen` → one target per `feature` (`F-xx`) from graph
4. Classify disk: `good` | `missing_content` | `missing_file`.
5. **Waves** — e.g. wave 0: `bd.db-design`, `bd.list-api`, `bd.list-screen` in parallel; wave 1: `bd.detail-api`; wave 2: `bd.detail-screen`.

### 3. Per wave, then per target

#### 3a. Load context (CLI)

- `graph query` each **DAG dependency** (SRS paths via `rendersTo`, prior basic-design `rendersTo`).
- `graph query` **target seed** (`doc.srs.*` or `F-xx`) — depth **4**, edges include `satisfies`, `tracesTo`, `references`, `rendersTo`, `dependsOn`.
- `graph impact` when regenerating.
- Read `projectionPaths` + relevant `docs/srs/**` and `docs/data-source/**` only as needed.

#### 3b. Write

- Templates: `node_modules/ai-spector/templates/basic_design/` (monorepo: `../templates/basic_design/`).
- Align API/screen names with graph `feature` titles and SRS feature detail files.

#### 3c. Ingest (mandatory before next wave)

Merge patch (include `documentNodes` from `dag.basic-design.graph-seeds.json` when first creating chapter-level docs):

```json
{
  "version": 1,
  "nodes": [
    { "id": "doc.bd.list-api", "type": "document", "output": "docs/basic-design/api-list.md", "template": "basic_design/list-api-template.md" }
  ],
  "edges": [
    { "type": "rendersTo", "from": "doc.bd.list-api", "to": "docs/basic-design/api-list.md" },
    { "type": "dependsOn", "from": "doc.bd.list-api", "to": "doc.srs.6-external-interfaces" },
    { "type": "dependsOn", "from": "doc.bd.detail-api", "to": "doc.bd.list-api" },
    { "type": "tracesTo", "from": "F-01", "to": "doc.bd.list-api" }
  ]
}
```

```bash
ai-spector graph merge .ai-spector/.docflow/extract/projection-patch.json
ai-spector graph validate
```

Per-domain file: `rendersTo` from `F-xx` or `doc.bd.*` to actual path; `tracesTo` / `references` to SRS or API list as appropriate.

#### 3d. Log

Append `.ai-spector/.docflow/logs/generate-basic-design.log`.

### 4. Finish

- Final `graph validate`.
- Suggest **`/index-docs basic-design`** (required by workflow before detail design).

## Waves (reference)

| Wave | DAG nodes (parallel within wave) |
|------|----------------------------------|
| 0 | `bd.db-design`, `bd.list-api`, `bd.list-screen` |
| 1 | `bd.detail-api` (+ per-feature API files) |
| 2 | `bd.detail-screen` (+ per-feature screen files) |

## Guardrails

- **Parallel only within a wave** — never `bd.detail-api` before `bd.list-api` is ingested.
- **Every target** gets `graph query` + dependency queries.
- **Case 3** requires explicit user **yes** before writes.
- Do not overwrite `good` without user intent.
- On CLI failure → [_cli-failures.md](./_cli-failures.md).

## If blocked

[_cli-failures.md](./_cli-failures.md). Often: run `/generate-srs` for missing SRS deps, then re-run **`/generate-basic-design`**.
