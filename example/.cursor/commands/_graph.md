# Graph CLI (for agents)

**Users do not run these commands.** Slash commands (`/analyze`, `/generate-srs`, …) invoke the CLI. User workflow: [_workflow.md](./_workflow.md).

Run from project root. Use `npx ai-spector` if the binary is not on PATH.

## Commands the agent calls

```bash
ai-spector analyze
ai-spector graph merge --from-knowledge
ai-spector graph validate
ai-spector graph visualize [--open]
ai-spector graph query <nodeId> [options]
ai-spector graph impact <nodeId> [options]
```

## `graph query` — context for generation

```bash
ai-spector graph query <seedId> --json
ai-spector graph query UC-01 --edges listedIn,definedIn,satisfies,references --depth 3 --json
```

**JSON output** — use in `/generate-*`:

```json
{
  "seed": "UC-01",
  "nodes": [{ "id": "UC-01", "type": "useCase" }],
  "edges": [{ "type": "listedIn", "from": "UC-01", "to": "sec.srs.3.2" }],
  "projectionPaths": ["docs/srs/3-use-cases.md"]
}
```

**Agent rule:** Open **only** `projectionPaths` plus needed `docs/data-source/**`. Do not glob `docs/srs/**`.

| Task | Example seed | `--depth` |
|------|----------------|-----------|
| SRS chapter | `document` or chapter `section` id | 2–3 |
| UC detail | `UC-01` | 3 |
| Feature | `F-01` | 3 |

## `graph impact` — scope regen

```bash
ai-spector graph impact <nodeId> --change content_change --json
```

Buckets: `regenerate`, `review`, `downstream`. For each regenerate id, run `graph query <id> --json` before editing.

## `graph merge` — called from `/analyze`

```bash
ai-spector graph merge --from-knowledge
```

Do not ask the user to merge manually after `/analyze`.

## Fallback

Only if `graph query` returns no domain nodes and empty `projectionPaths`:

- `.ai-spector/.docflow/analysis/knowledge.json`
- `.ai-spector/index/*.md`

Then suggest **`/analyze`**.
