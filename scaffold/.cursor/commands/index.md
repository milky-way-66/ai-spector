# /index

Rebuild **graph**, re-merge **knowledge** staging, refresh **Graphify storage**, and update **document indexes** when project files changed outside the normal `/analyze` flow.

**Not** the same as **`/summary`**, which only builds human-readable summaries under `.ai-spector/index/`.

## Usage

- `/index` — full CLI refresh (agent runs commands below)
- User may run: `npx ai-spector index` with flags (see README)

## When to use

- User edited `docs/data-source/`, `docs/srs/`, or templates manually
- Graph validate fails due to stale structure
- `.ai-spector/index/*.md` is out of date vs `docs/srs/` or `docs/basic-design/`

**Partial semantic refresh without `/analyze`:** After `/generate-srs`, index parses **UC/F/actor ids from markdown bodies** under `docs/srs/` and `docs/basic-design/` into the traceability graph. Per-domain detail files get **`doc.srs.uc-UC-01` / `doc.srs.f-F-01` document nodes**, **`section` nodes** with **`title`** + snippet **`description`** from real headings/body text, **`definedIn`** / **`describedIn`** from each UC/F to those sections, and **`contains`** from the list chapter to each detail doc. Domain **`title`** / **`description`** are refreshed from detail fields (`**Use Case Name:**`, `**Brief Description:**`, feature purpose)—not only list-table stubs. Index runs **Graphify `update` on changed sources** (`docs/data-source`, `docs/srs`, `docs/basic-design`).

**Still requires `/analyze` for:** full Graphify MCP extract → `knowledge.json` (NFRs, data model, rich descriptions). Index re-merges existing `knowledge.json` when present; warns if SRS changed but knowledge is stale.

## Required Behavior (agent runs CLI)

```bash
ai-spector index
```

After **`/generate-srs`** (recommended):

```bash
ai-spector index
```

Index steps (default): registry/bootstrap → knowledge merge → **SRS/docs body extract** → Graphify (changed paths only) → **data-source provenance (`derivedFrom`)** → validate → doc indexes.

**Provenance:** UC/F/requirement/actor nodes get **`derivedFrom`** edges to `docs/data-source/**` paths (from `knowledge.json` **`sourceRef`** / `sourceRefs` / `derivedFrom`, SRS detail **`Source:`** lines, or inline `docs/data-source/…` mentions) and optionally **`graphify:<nodeId>`** when Graphify `graph.json` matches a single symbol in that file. No evidence → no edge.

Flags:

| Flag | Effect |
|------|--------|
| `--force-graphify` | Re-index all Graphify sources even when content hash unchanged |
| `--skip-doc-semantics` | Skip UC/F parsing from `docs/srs` and `docs/basic-design` |
| `--skip-merge` | Skip `knowledge.json` merge |
| `--skip-graphify` | Skip Graphify CLI entirely |

On Graphify missing or CI without `uv`:

```bash
ai-spector index --skip-graphify
```

Structure + merge only:

```bash
ai-spector index --graph-only
```

Doc indexes only:

```bash
ai-spector index --docs-only
```

## Stop on failure

Follow [_cli-failures.md](./_cli-failures.md). Do not hand-edit `traceability.graph.json` to “fix” validate errors.

## Success

- Summary shows ✓ for requested steps
- `ai-spector graph validate` passes (unless `--skip-validate`)
- Suggest `/visualize-graph` or `/validate-graph` if user wants to inspect
