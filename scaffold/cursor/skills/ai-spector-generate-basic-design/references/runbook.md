# Generate basic design

Generate basic design markdown **from the traceability graph** and upstream SRS.

**User runs this command;** the agent runs CLI.

| Shared workflow | Document |
|-----------------|----------|
| Scope cases, waves, merge, finish, guardrails | [generate-workflow.md](../../ai-spector/references/generate-workflow.md) |
| Graph query, ingest, perEndpoint/perScreen | [generate-graph.md](../../ai-spector/references/generate-graph.md) |
| **Graph → template section mapping** | **[bd-context/](./bd-context/) — load the matching section file before writing each doc type** |

**Upstream:** SRS on disk (minimum per `workflow.dependencies.json`). Do not invent APIs/screens not grounded in graph + SRS.

## Intent → DAG hints

| User phrase (examples) | Typical DAG / outputs |
|------------------------|------------------------|
| database, DB, ERD, data model | `bd.db-design` → `db-design.md` |
| API list, endpoints overview | `bd.list-api` → `api-list.md` |
| API detail, per endpoint, REST | `bd.detail-api` → `docs/basic-design/api/` (one file per §3 row) |
| screen list, UI list | `bd.list-screen` → `list-screens.md` |
| screen detail, wireframe, per screen | `bd.detail-screen` → `docs/basic-design/screens/` (one per Screen Index row) |
| one endpoint, POST /checkout | that row → `api/<slug>.md` |
| one screen, login, dashboard | that row → `screens/<slug>.md` |
| everything, full basic design | Full DAG — case 1 |

## Config

- `dag.basic-design.json`
- `dag.basic-design.graph-seeds.json` — seeds + `documentNodes` for ingest
- `completeness-rules.basic-design.json`
- `workflow.dependencies.json` → `generate-basic-design`
- `.ai-spector/docflow.config.json` → `languages[]` — output language(s) and folders

Templates: `.ai-spector/templates/basic_design/`

## Output paths

Always write to `docs/basic-design/{lang.code}/{filename}`. Examples:

```
docs/basic-design/en/db-design.md
docs/basic-design/jp/db-design.md
docs/basic-design/en/api/post-checkout.md
docs/basic-design/jp/api/post-checkout.md
```

Never write directly to `docs/basic-design/{filename}` — the language subfolder is always required.

**Multi-language order:** generate the primary language file first (from graph + template). Then translate that file to each secondary language. Secondary languages are never generated independently from the graph — they are always translated from the finished primary file.

## Waves (reference)

| Wave | DAG nodes (parallel within wave) | After wave |
|------|----------------------------------|------------|
| 0 | `bd.db-design`, `bd.list-api`, `bd.list-screen` | merge → validate → **`npx ai-spector index`** |
| 1 | `bd.detail-api` (+ one file per api-list §3 row) | merge → validate → **`npx ai-spector index`** |
| 2 | `bd.detail-screen` (+ one file per Screen Index row) | merge → validate → **`npx ai-spector index`** |

**Reindex every wave (mandatory):** `graph merge` does not parse markdown bodies. Without index after wave 0, wave 1 cannot expand endpoint rows; without index after wave 1, wave 2 cannot expand Screen Index rows.

## Graph context (required before writing each file)

After running queries ([generate-graph.md](../../ai-spector/references/generate-graph.md) § C), load the matching file from `bd-context/` for the doc type being written:

| Writing | Load |
|---|---|
| DB design | `bd-context/db-design.md` |
| API list | `bd-context/api-list.md` |
| API detail (per endpoint) | `bd-context/api-detail.md` |
| Screen list | `bd-context/screen-list.md` |
| Screen detail (per screen) | `bd-context/screen-detail.md` |

Every endpoint, table, and screen must trace to graph nodes. No invented structure.

## Basic-design-specific write rules

- **List chapters first** — names from `api-list.md` / `list-screens.md` tables; not one file per `F-xx`.
- **API detail** — `detail-api-template.md` per `METHOD /path`.
- **Screen detail** — `detail-screen-template.md` per screen; list file is `list-screens.md` (not under `screens/`).

## Basic-design ingest example

Include `documentNodes` when first creating chapter docs:

```json
{
  "version": 1,
  "nodes": [
    { "id": "doc.bd.list-api", "type": "document", "output": "docs/basic-design/api-list.md", "template": "basic_design/list-api-template.md" }
  ],
  "edges": [
    { "type": "rendersTo", "from": "doc.bd.list-api", "to": "docs/basic-design/api-list.md" },
    { "type": "dependsOn", "from": "doc.bd.list-api", "to": "doc.srs.6-external-interfaces" },
    { "type": "dependsOn", "from": "doc.bd.detail-api", "to": "doc.bd.list-api" }
  ]
}
```

Per-endpoint / per-screen: `doc.bd.api-*` / `doc.bd.screen-*` → path; `contains` from list chapter; optional `tracesTo` from cited `F-xx`.

Execution checklist: [generate-workflow.md](../../ai-spector/references/generate-workflow.md).

## Finish

- Last wave already ran validate + index → final validate only; else run both again.
- Suggest **`/summary basic-design`** when workflow lists it.

Log: `.ai-spector/.docflow/logs/generate-basic-design.log`.

## If blocked

Often: `/generate-srs` for missing SRS deps, then re-run **`/generate-basic-design`**.
