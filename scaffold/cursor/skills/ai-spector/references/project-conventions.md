# AI Spector project conventions

## Init and upgrades

```bash
npx ai-spector init          # first time
npx ai-spector sync-cursor   # refresh commands/skills after package upgrade
```

Missing templates → `npx ai-spector init --force`.

## Document layers

| Layer | Directory |
|-------|-----------|
| Source input | `docs/data-source/` |
| SRS | `docs/srs/` |
| Basic design | `docs/basic-design/` |
| Detail design | `docs/detail-design/` |
| HTML prototype | `prototype/src/` |

## Generation discipline (all layers)

1. Read template from `.ai-spector/templates/` — never invent section structure.
2. Query graph before writing (`ai-spector graph query`).
3. Merge projection patches after each wave (`graph merge`).
4. Validate when the command doc requires it.
