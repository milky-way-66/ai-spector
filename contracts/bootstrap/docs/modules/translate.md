# Translate — Docops Module Guide

## Native config (Writer)

Enable with `capabilities.translate: true` in `.docops/docops.config.json`.

| Field | Purpose |
|-------|---------|
| `languages[]` | All supported language codes and folder paths |
| `primaryLanguage` | Authoring language (e.g. `en`) |
| `internalLanguage` | Language for internal review (e.g. `vi`) |
| `clientLanguage` | Language for client-facing release (e.g. `jp`) |

Translated documents live at `docs/{layer}/{language.path}/*.md` for each entry in `languages`.

Writer shows translation workflow UI when `translate` is enabled. Missing target-language files are not errors.

## Custom adapter

A local translate workflow (ai-spector, CI, or agent) may:

1. Read source docs from `primaryLanguage` path
2. Write translations to other `languages[].path` folders
3. Commit per language on the same branch

Set `capabilities.translate: false` when translation is handled entirely outside Writer.
