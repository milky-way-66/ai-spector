# Work 10 — Multi-language Documentation

**Course:** [Index](README.md) · [Overview](00-overview.md) · [Previous](09-index-the-project.md)

**Goal:** Maintain SRS and basic design in more than one language — primary language generated from the graph, secondary languages kept in sync via translation.

**Before you start:** Work 02 (Initialize a Project) — at least one language configured. Work 08 (Generate SRS) — primary-language documents should exist before translating.

---

## Core config file — `docflow.config.json`

Path: **`.ai-spector/docflow.config.json`**

This is the **project config** ai-spector reads on every command. Multi-language settings live here — not in separate language files.

```json
{
  "version": 1,
  "languages": [
    { "code": "en", "label": "English" },
    { "code": "vi", "label": "Vietnamese" }
  ],
  "paths": {
    "graph": ".ai-spector/graph/traceability.graph.json",
    "registry": ".ai-spector/registry/section-registry.json",
    "templates": ".ai-spector/templates"
  },
  "packs": {
    "srs": "builtin",
    "basicDesign": "builtin"
  }
}
```

| Field | Multi-language role |
|-------|---------------------|
| `languages[]` | **Primary control.** First entry = primary language (generation + translation source). Rest = secondary targets. |
| `languages[].code` | BCP-47 code (`en`, `vi`, `jp`, …) — matches folder names `docs/srs/{code}/`. |
| `languages[].label` | Display name only; not used for paths. |
| `paths.graph` | Graph gets `translationOf` edges when you `lang add`. |
| `paths.registry` | Section registry spans all languages after index. |
| `paths.templates` | Builtin template root — unchanged by language setup. |
| `packs.srs` / `packs.basicDesign` | Independent of language — see [Work 17](17-custom-template-packs.md). Each can be `"builtin"` or a custom pack name; both work alongside multiple languages. |

**Not in this file:** translated file paths (derived from doc type + `languages[].code`), translation queue state (`.ai-spector/.docflow/translation-queue/`), or per-document output patterns (custom packs → pack `manifest.json`).

Inspect or edit manually:

```bash
cat .ai-spector/docflow.config.json
```

`npx ai-spector lang add <code>` updates `languages[]` for you — you rarely edit by hand.

---

## How it works

| Concept | Rule |
|---------|------|
| **Primary language** | First entry in `languages[]` in `.ai-spector/docflow.config.json` (e.g. `en`) |
| **Secondary languages** | All other entries (e.g. `vi`, `jp`) |
| **Folder layout** | `docs/srs/{lang}/…` and `docs/basic-design/{lang}/…` — one tree per language code |
| **Generation** | Agent generates **primary only** from the graph and data source |
| **Secondary docs** | **Translated** from the finished primary file — never generated independently from the graph |
| **IDs stay fixed** | `UC-01`, `F-03`, API paths, code blocks are **not** translated |

Primary SRS files live under `docs/srs/en/`. Vietnamese copies go under `docs/srs/vi/` with the same relative paths. Folder names always match `languages[].code` from `docflow.config.json`.

---

## At init (Work 02)

The init wizard asks which languages to set up. You can pick several up front (e.g. `en,vi`) or start with one and add more later.

If you only chose English at init, add Vietnamese (or Japanese, etc.) in the steps below.

---

## Add a language

### In chat

```
add Vietnamese language to the project
```

```
add language vi
```

The agent runs `npx ai-spector lang add vi`, which:

1. Appends `{ "code": "vi", "label": "Vietnamese" }` to **`languages[]`** in `.ai-spector/docflow.config.json`
2. Creates `docs/srs/vi/` and `docs/basic-design/vi/`
3. Registers `translationOf` edges in the graph for existing documents
4. Enqueues translation jobs for primary files that have no secondary copy yet

### CLI (optional)

```bash
npx ai-spector lang add vi --label Vietnamese
```

---

## Translate secondary languages

After primary documents exist (Work 08+), sync translations:

### 1. Re-index (updates the translation queue)

```
refresh the index
```

`npx ai-spector index` compares file hashes across language folders. When the primary file changes, it creates a **pending** translation job.

### 2. Resolve translations

```
resolve translations
```

```
sync Vietnamese translations
```

```
process translation queue for vi
```

The agent (skill `ai-spector-resolve-translation`):

1. Lists pending jobs from `.ai-spector/.docflow/translation-queue/pending.json`
2. Reads the **whole** primary-language source file
3. Writes translated files to each target language path
4. Re-runs index so jobs move to `resolved.json`

### 3. Check status

```
translation status
```

```
which translations are pending?
```

---

## Day-to-day workflow

```text
Edit primary doc (en)  →  refresh index  →  resolve translations
```

If you edit a **secondary** file directly, the queue can create an **inbound** job to backport changes to primary, then propagate to other languages. When in doubt, ask the agent:

```
what's the translation status?
```

---

## Translation rules (what the agent follows)

1. Translate all prose — headings, body, tables, bullets, notes.
2. Keep identifiers verbatim — `UC-01`, `POST /api/...`, file paths, CLI commands, code.
3. One language per file — no mixed English/Vietnamese in the same document.
4. Whole-file sync — translate the entire file, not arbitrary partial patches (unless you ask for a specific section).

Queue state lives under:

```
.ai-spector/.docflow/translation-queue/
├── pending.json
├── resolved.json
├── failed.json
└── changes/          ← per-document edit history for merge conflicts
```

---

## Check

1. `.ai-spector/docflow.config.json` has 2+ entries in `languages[]`.
2. `docs/srs/vi/` (or your code) contains translated files mirroring primary paths.
3. After `resolve translations` and `refresh index`:

```bash
npx ai-spector lang queue pending --json
```

Pending list should be empty (or only jobs you intentionally deferred).

4. Graph validate passes:

```
validate the graph
```

---

## Troubleshooting

**Secondary folder is empty after `lang add`**

Expected — files appear after `resolve translations`, not at add time.

**`resolve translations` does nothing**

- Confirm primary files exist under `docs/srs/en/` (or your primary code).
- Run `refresh the index` first to enqueue jobs.
- Check skills: `ai-spector-resolve-translation` must be enabled (Work 04).

**Impact analysis shows `staleTranslations`**

Primary changed but secondary was not re-translated. Run:

```
resolve translations
```

Do **not** re-generate SRS from the graph for secondary languages.

**Merge conflict in the queue**

Two languages edited the same lines differently. The agent should stop and ask you. Or inspect:

```
.ai-spector/.docflow/translation-queue/changes/
```

**Pre-commit hook warns about pending translations**

Finish or defer jobs before commit, or run `resolve translations` after your edits.

---

## Next

Go to [Work 11 — Generate Basic Design](11-generate-basic-design.md).

Skip this work if you only need one language — go straight to Work 11 after Work 09.
