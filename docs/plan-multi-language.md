# Multi-Language Document Feature Plan

## Overview

Allow projects to generate and maintain documentation (SRS, basic design, etc.) in multiple languages simultaneously. All languages derive from the same shared data source (the traceability graph + source bundles). Language-specific document nodes are linked in the graph so impact analysis propagates correctly across languages.

---

## Folder Layout

```
docs/
  srs/
    en/
      01-overview.md
      02-actors.md
      ...
    jp/
      01-overview.md
      ...
    vi/
      01-overview.md
      ...
  basic-design/
    en/
      ...
    jp/
      ...
```

Single-language projects still use `docs/srs/{lang}/` so future language additions require no restructuring.

---

## Configuration Changes

### `docflow.config.json`

Add a `languages` array to the project config. The first entry is the primary language.

```jsonc
{
  "version": 1,
  "languages": [
    { "code": "en", "label": "English" }
  ],
  "paths": {
    "graph": ".ai-spector/graph/traceability.graph.json",
    "registry": ".ai-spector/registry/section-registry.json",
    "templates": ".ai-spector/templates"
  }
}
```

### `DocflowConfig` type (`src/config/types.ts`)

```ts
export interface LanguageConfig {
  code: string;   // BCP-47 tag, e.g. "en", "jp", "vi"
  label: string;  // Human display name
}

export interface DocflowConfig {
  version: number;
  languages: LanguageConfig[];   // NEW — min 1 entry
  paths: DocflowProjectPaths;
}
```

---

## Graph Changes

### New node types / edge types

No new `NodeType` values are needed. A per-language document reuses the existing `"document"` node type.

New **edge type** added to `EdgeType`:

```ts
"translationOf"   // lang-specific document → primary-language document
```

### Node ID convention

Language-scoped document nodes use the pattern:

```
doc:{lang}:{documentId}:{domainId?}
```

Examples:
- `doc:en:srs-overview`
- `doc:jp:srs-overview`
- `doc:vi:srs-actors`

### Edge mapping

When a secondary-language document node is written, the indexer adds:

```json
{ "type": "translationOf", "from": "doc:jp:srs-overview", "to": "doc:en:srs-overview" }
```

This lets impact analysis walk: _source change → en doc node → translationOf ← jp doc node_ and flag which translated nodes are stale.

---

## CLI Changes

### `ai-spector init`

- Prompt: **"Which languages do you want? (comma-separated codes, e.g. en,jp,vi)"**
- Default: `en`
- Creates `docs/srs/{lang}/` and `docs/basic-design/{lang}/` for each code.
- Writes `languages` array into `docflow.config.json`.

### New command: `ai-spector lang add <code>`

```
ai-spector lang add jp
```

1. Reads current `docflow.config.json`.
2. Appends `{ code, label }` to `languages` (derive label from a small built-in map; fallback to code).
3. Creates `docs/srs/{code}/` and `docs/basic-design/{code}/` mirroring the primary language folder structure (empty files).
4. Runs a mini-index pass to register new document nodes and `translationOf` edges.

### `ai-spector index`

- Iterates each language in `config.languages`.
- Reads documents under `docs/srs/{lang}/` and `docs/basic-design/{lang}/`.
- Registers nodes as `doc:{lang}:{docId}`.
- For non-primary languages, adds `translationOf` edge to the primary-language counterpart.

---

## Impact Analysis Changes (`src/graph/impact.ts`)

When a source file or section changes and impact is computed:

1. Existing logic finds affected `document` nodes in the primary language.
2. **New step**: for each affected primary-language document node, follow reverse `translationOf` edges to collect all translated document nodes.
3. Report them as a separate group: **"Translation nodes that may need update"** with their `lang` attribute and file path.

---

## Template Changes

Document templates gain a `{lang}` token resolvable at generation time. The `outputPattern` in `documents.json` becomes:

```json
"outputPattern": "docs/srs/{lang}/{slug}"
```

The generator loops over `config.languages` and writes one file per language, passing the language code + label to the AI prompt so it generates content in the correct language.

---

## Cursor Skill Changes

### `generate-srs` / `generate-basic-design` skills

Add an optional `--lang` flag. When omitted, generate for **all configured languages** in one pass (parallel AI calls, one per language). When provided, generate only that language.

Prompt injection per language:

```
You are writing the {label} ({code}) version of this document.
Write all prose in {label}. Keep IDs, code, and technical tokens in their original form.
```

### New skill: `lang-status`

Checks each translated document node against its primary counterpart's last-modified timestamp (via git mtime or graph `updatedAt`). Outputs a table:

```
Document           EN (primary)   JP          VI
srs/01-overview    2026-06-01     STALE       OK
srs/02-actors      2026-06-01     OK          STALE
```

---

## Implementation Phases

### Phase 1 — Config & folder scaffold
- Add `LanguageConfig` to types.
- Update `loadDocflowConfig` to parse `languages` with a default of `[{ code: "en", label: "English" }]`.
- Update `runInit` to prompt for languages and create per-lang folders.
- Update scaffold template paths to use `{lang}` token.

### Phase 2 — Indexer & graph edges
- Update `runIndex` to iterate languages.
- Emit `doc:{lang}:*` node IDs.
- Emit `translationOf` edges for non-primary langs.
- Add `"translationOf"` to `EdgeType` union in `src/types.ts`.

### Phase 3 — Impact propagation
- In `src/graph/impact.ts`, after collecting affected document nodes, walk reverse `translationOf` edges.
- Surface translated nodes in impact report output.

### Phase 4 — `lang add` command
- New file `src/commands/lang.ts` with `runLangAdd`.
- Register under `program.command("lang").command("add <code>")` in `cli.ts`.

### Phase 5 — Cursor skills
- Update generation skills with `--lang` flag and multi-language loop.
- Add `lang-status` skill.

---

## Open Questions

1. **Label map**: maintain a small built-in `code → label` map (ISO 639-1 names) or always require the user to provide a label?
2. **Primary language**: always the first entry in `languages[]`, or an explicit `primary` flag?
3. **Stale detection**: use git mtime, or add an `updatedAt` timestamp to graph nodes?
4. **AI generation order**: generate primary language first, then translate from it, or call the AI fresh per language with shared data context?
