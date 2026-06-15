# Graph tasks — extended notes

## Analyze vs index

| Task | Purpose |
|------|---------|
| **Analyze** | Full semantic extract → `knowledge.json`, merge, validate |
| **Index** | Refresh structure, merge existing knowledge, doc body extract, doc indexes |

Run **index** after SRS generation or manual doc edits.

## Impact empty args

**Impact** with no description uses git diff to propose regen seeds — see [impact.md](./impact.md).

