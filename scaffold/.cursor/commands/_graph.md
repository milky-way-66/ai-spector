# Traceability graph (shared)

Canonical store: **`.ai-spector/graph/traceability.graph.json`**

The IDE **must use CLI commands** — do not hand-roll BFS over JSON in the agent.

## CLI commands (required)

```bash
ai-spector graph validate
ai-spector graph merge [file] [--from-knowledge]
ai-spector graph query <nodeId> [options]
ai-spector graph impact <nodeId> [options]
```

Run from project root (or pass global `-r <root>`).

### `graph query` — find relevant context

```bash
ai-spector graph query <seedId> --json
ai-spector graph query sec.srs.3.2 --direction both --depth 3 --json
ai-spector graph query UC-01 --edges listedIn,definedIn,satisfies,references --depth 3 --json
```

**JSON output** (use this in `/generate-*`):

```json
{
  "seed": "UC-01",
  "nodes": [{ "id": "UC-01", "type": "useCase", ... }],
  "edges": [{ "type": "listedIn", "from": "UC-01", "to": "sec.srs.3.2" }],
  "projectionPaths": ["docs/srs/3-use-cases.md", "docs/srs/03-use-cases/uc-01-....md"]
}
```

**Agent rule:** Open **only** files in `projectionPaths` plus data-source paths referenced in returned node metadata. Do not glob `docs/srs/**`.

| Task | Example seed | `--depth` |
|------|----------------|-----------|
| SRS chapter | `document` id or chapter `section` id | 2–3 |
| UC detail | `UC-01` | 3 |
| Feature / basic design | `F-01` | 3 |

### `graph impact` — scope regen

```bash
ai-spector graph impact <nodeId> --change content_change --json
ai-spector graph impact sec.srs.uc-detail.l3.3.2-main-success-scenario -o .ai-spector/views/impact.json --json
```

Buckets: `regenerate`, `review`, `downstream`. Regenerate only listed ids; for each id run `graph query <id> --json` again.

### `graph merge` — commit domain knowledge

After `/analyze` writes `knowledge.json`:

```bash
ai-spector graph merge --from-knowledge
ai-spector graph merge .ai-spector/.docflow/extract/patch.json
ai-spector analyze --merge   # structure prep + merge if staging files exist
```

**Agent rule:** Do **not** manually edit `traceability.graph.json` for bulk UC/F/actor inserts. Write `knowledge.json` (or `extract/patch.json`) and run `graph merge`.

### `graph validate`

```bash
ai-spector graph validate
```

Run before `/generate-*` and after `graph merge`.

## Update graph after generation

When writing projection markdown:

1. Ensure `document` / domain nodes exist.
2. Add `rendersTo` edges where applicable.
3. Run `ai-spector graph validate`.

(`/sync-graph` — reconcile disk files until `graph sync` CLI exists.)

## Fallback

Only if `graph query` returns no domain nodes and empty `projectionPaths`:

- `.ai-spector/.docflow/analysis/knowledge.json`
- `.ai-spector/index/*.md`

Then re-run `/analyze` to merge into graph.
