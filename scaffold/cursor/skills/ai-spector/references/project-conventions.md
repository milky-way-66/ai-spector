# AI Spector project conventions

## CLI (agents)

Always invoke **`npx ai-spector <subcommand>`** in the terminal. Do not use bare `ai-spector` — projects may lack a global install.

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
| HTML prototype | `prototype/src/` |

## Review checklists (custom)

Drop JSON files under `.ai-spector/.docflow/config/review-checklists/<docType>/`.
Merged into document review automatically. Guide: `ai-spector-review/references/custom-checklists.md`.

## Document language

Stored in `.ai-spector/.docflow/config/workspace/language.json` (`documentLanguage` field).

- **Before the first write** in any session, check this file. If `documentLanguage` is `null` or missing, run the language-picker flow ([language-picker.md](./language-picker.md)) — ask the user, persist the answer, then continue.
- **All generated content** (headings, body, tables, labels) must be in `documentLanguage`. Identifiers (UC-01, F-02, API paths, code) are never translated.
- Change with: edit `language.json` directly; already-generated files are not auto-updated.

## Generation discipline (all layers)

1. **Check document language** ([language-picker.md](./language-picker.md)) before any write.
2. Read template from `.ai-spector/templates/` — never invent section structure.
3. Query graph before writing (`npx ai-spector graph query`).
4. Merge projection patches after each wave (`graph merge`).
5. Validate when the command doc requires it.
