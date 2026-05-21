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

**Does not replace `/analyze` for semantic extract** — `knowledge.json` is still produced by Graphify MCP during `/analyze`. This command re-merges existing knowledge and rebuilds structure/indexes.

## Required Behavior (agent runs CLI)

```bash
ai-spector index
```

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
