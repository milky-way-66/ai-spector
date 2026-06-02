# Graph tasks — extended notes

## Analyze vs index

| Task | Purpose |
|------|---------|
| **Analyze** | Full semantic extract → `knowledge.json`, merge, validate |
| **Index** | Refresh structure, merge existing knowledge, Graphify on changed paths, doc indexes |

Run **index** after SRS generation or manual doc edits.

## Impact empty args

**Impact** with no description uses git diff to propose regen seeds — see [impact.md](./impact.md).

## Graphify optional

If `uv`/Graphify unavailable: `ai-spector index --skip-graphify` (non-blocking for doc merges).
