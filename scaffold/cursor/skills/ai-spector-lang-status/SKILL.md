---
name: ai-spector-lang-status
description: >-
  Shows which translated documents are potentially stale compared to the primary language version.
  Use when the user asks about translation status, which docs need updating after a change, or
  "what's stale in JP/VI". Do not use for generating or editing documents.
paths:
  - "docs/srs/**"
  - "docs/basic-design/**"
  - ".ai-spector/docflow.config.json"
---

# Language Status Check

## Steps

1. Read `.ai-spector/docflow.config.json`. Extract `languages[]`.
   - If only one language, reply: "Only one language configured — nothing to compare."

2. Identify the primary language (first entry in `languages[]`).

3. For each secondary language, compare files under `docs/srs/{lang.code}/` and `docs/basic-design/{lang.code}/` against the primary language folder.

4. For each doc type, build a status table:

```
Document                   EN (primary)   JP         VI
srs/01-introduction.md     2026-06-01     MISSING    OK
srs/02-actors.md           2026-06-01     OK         STALE
basic-design/db-design.md  2026-06-01     STALE      MISSING
```
(Actual paths: `docs/{docType}/{lang.code}/{filename}`, e.g. `docs/srs/jp/01-introduction.md`)

Status rules (based on file mtime from `git log -1 --format=%cI -- <path>`):
- **OK** — file exists and its last-modified date is ≥ the primary language file's date (translation is up to date with the primary).
- **STALE** — file exists but the primary language file was modified after the translation was last written (primary drifted; translation needs re-translation).
- **MISSING** — file does not exist in the language folder.

5. Run `npx ai-spector graph impact --json` if the user wants graph-level stale translation nodes (requires an origin node ID).

## Output format

Print the status table per doc type (SRS, Basic Design).
After the table, list actionable items:
- Files that are MISSING: "Generate: `docs/srs/jp/02-actors.md`"
- Files that are STALE: "Update: `docs/basic-design/vi/db-design.md` (primary changed 2026-06-01, translation last updated 2026-05-10)"

## After any primary file edit (outside of generate skills)

If the user edits a primary language file directly (not via a generate skill), and secondary languages are configured, ask:

```
You've edited `docs/{docType}/{primaryLang.code}/{filename}`.
Do you want me to update the translation(s) now?

  1. Yes, update all translations now
  2. Yes, but only: [specific languages]
  3. No — I'll handle it later
```

Wait for reply. On yes: read the updated primary file and re-translate to each approved secondary language. On no: note the file as stale so the user can run `ai-spector-lang-status` later.

## Updating stale translations

If the user says "update stale JP" or "regenerate missing VI docs":
- For **STALE** files: read the current primary language file from disk and re-translate it to the target language. Do not re-query the graph — the primary file is the source of truth.
- For **MISSING** files: check if the primary language file exists. If yes, translate it. If no, switch to `ai-spector-generate-srs` or `ai-spector-generate-basic-design` to generate the primary first, then translate.
- Apply the same translation enforcement rules from `generate-workflow.md` (IDs never translated, all prose in target language).
