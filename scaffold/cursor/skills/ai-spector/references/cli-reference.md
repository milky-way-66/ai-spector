# AI Spector CLI Reference

Complete command reference for AI agents. Run all commands from the project root with `npx ai-spector`.

**On any failure:** pause, report exit code + stderr, do not guess. Load [cli-failures.md](./cli-failures.md).

---

## Quick lookup

| Goal | Command |
|---|---|
| Initialize a new project | `npx ai-spector init` |
| Add a language | `npx ai-spector lang add <code>` |
| Refresh graph + indexes | `npx ai-spector index` |
| Prepare graph structure only | `npx ai-spector index --graph-only` |
| Rebuild doc indexes only | `npx ai-spector index --docs-only` |
| Query a node's subgraph | `npx ai-spector graph query <id> --json` |
| Impact analysis from a node | `npx ai-spector graph impact <id> --json` |
| Impact from git diff | `npx ai-spector graph impact --git --json` |
| Merge knowledge into graph | `npx ai-spector graph merge --from-knowledge` |
| Validate graph | `npx ai-spector graph validate` |
| Graph health report | `npx ai-spector graph report --json` |
| Visualize graph in browser | `npx ai-spector graph visualize --open` |
| List review comments | `npx ai-spector comments list --json` |
| Comment triage inbox | `npx ai-spector comments inbox --json` |
| Resolve a comment thread | `npx ai-spector comments resolve <threadId>` |
| Refresh Cursor skills | `npx ai-spector sync-cursor` |

---

## `init`

Scaffold a new project: creates `.ai-spector/`, `docs/srs/{lang}/`, `docs/basic-design/{lang}/`, Cursor skills.

```bash
npx ai-spector init [options]

Options:
  -l, --languages <codes>   Comma-separated language codes (default: "en")
                            e.g. --languages en,jp,vi
  -f, --force               Overwrite existing scaffold files
  -C, --cwd <path>          Target directory (default: current dir)
```

**Examples:**
```bash
npx ai-spector init                        # English only
npx ai-spector init --languages en,jp,vi   # three languages
npx ai-spector init --force                # re-scaffold in place
```

**What it writes:**
- `.ai-spector/docflow.config.json` — project config including `languages[]`
- `docs/srs/{lang}/` and `docs/basic-design/{lang}/` for each language
- `.cursor/skills/` — Cursor agent skills
- `.ai-spector/templates/` — SRS + basic design templates

---

## `lang add`

Add a language to an already-initialized project at any time.

```bash
npx ai-spector lang add <code> [options]

Arguments:
  code              BCP-47 language code: en, jp, ja, vi, zh, ko, fr, de, es, pt

Options:
  --label <label>   Override display name (inferred from built-in map if omitted)
  -C, --cwd <path>  Project root (default: current dir)
```

**Examples:**
```bash
npx ai-spector lang add jp
npx ai-spector lang add vi --label Vietnamese
```

**What it does:**
1. Creates `docs/srs/{code}/` and `docs/basic-design/{code}/`
2. Appends `{ code, label }` to `languages[]` in `docflow.config.json`
3. Registers `translationOf` edges in the graph for all existing primary document nodes
4. Prints: "Run `npx ai-spector index` to refresh the full graph."

After running, always follow with `npx ai-spector index`.

---

## `index`

Full refresh: section registry → graph bootstrap → knowledge merge → doc-semantic merge → provenance → bundles → validate → doc indexes.

```bash
npx ai-spector index [options]

Options:
  --graph-only          Registry + bootstrap + merge + validate only (no doc indexes)
  --docs-only           Rebuild .ai-spector/index/*.md only (no graph changes)
  --skip-docs           Skip doc indexes (graph steps still run)
  --skip-merge          Skip merging knowledge.json
  --skip-doc-semantics  Skip parsing docs body for UC/F/actor ids
  --skip-validate       Skip graph validate
```

**Typical agent usage:**
```bash
npx ai-spector index                  # after any doc write
npx ai-spector index --graph-only     # when only graph state matters
npx ai-spector index --skip-merge     # when knowledge.json is stale/missing
```

**Output:** prints a step-by-step summary table. Each step shows `✓ ok`, `○ skipped`, or `✗ failed`.

**Multi-language behaviour:** automatically creates `doc:{lang.code}:{docId}` nodes and `translationOf` edges for each secondary language configured in `docflow.config.json`.

---

## `graph query`

Return the subgraph and projection paths for a node. Always run before writing a document section.

```bash
npx ai-spector graph query <nodeId> [options]

Arguments:
  nodeId            Node id from the traceability graph

Options:
  -d, --direction <dir>   out | in | both (default: "both")
  --depth <n>             Traversal depth (default: 2)
  -e, --edges <types>     Comma-separated edge types
  --json                  JSON output (required for agent use)
```

**Examples:**
```bash
npx ai-spector graph query UC-01 --json
npx ai-spector graph query doc.srs.use-cases --direction out --depth 3 --json
npx ai-spector graph query srs-overview --edges contains,partOf --json
```

**JSON output shape:**
```jsonc
{
  "origin": { "id": "...", "type": "..." },
  "nodes": [...],
  "edges": [...],
  "projectionPaths": ["docs/srs/en/03-use-cases.md", ...]
}
```

Use `projectionPaths` to know which files to read. Do not glob `docs/**`.

---

## `graph impact`

Compute which nodes/documents need regeneration or review after a change. Also surfaces stale translation nodes.

```bash
npx ai-spector graph impact [id] [options]

Arguments:
  id                Node id (optional when using --file, --heading, or --git)

Options:
  --file <path>       Resolve origin from repo-relative doc path
  --heading <text>    Resolve section by heading (combine with --file)
  --git               Seeds from current git diff (staged + unstaged)
  --change <type>     Change type label (default: "content_change")
  -o, --output <path> Write impact JSON to file
  --json              Print JSON
```

**Examples:**
```bash
npx ai-spector graph impact UC-01 --json
npx ai-spector graph impact --file docs/srs/en/03-use-cases.md --json
npx ai-spector graph impact --file docs/srs/en/03-use-cases.md --heading "3.2 List Use Case" --json
npx ai-spector graph impact --git --json
```

**JSON output shape:**
```jsonc
{
  "origin": { "id": "...", "type": "...", "change": "content_change" },
  "affected": {
    "regenerate": [{ "id": "...", "type": "document", "projectionPath": "..." }],
    "review":     [{ "id": "...", "type": "section",  "projectionPath": "..." }]
  },
  "staleTranslations": [        // present when secondary-language nodes are affected
    { "id": "doc:jp:srs-use-cases", "type": "document", "reason": "translationOf srs-use-cases" }
  ]
}
```

`staleTranslations` lists secondary-language document nodes whose primary counterpart changed — they need re-translation, not re-generation from graph.

---

## `graph merge`

Merge a domain patch or `knowledge.json` into the traceability graph (upsert nodes + edges).

```bash
npx ai-spector graph merge [file] [options]

Options:
  --from-knowledge      Read .ai-spector/.docflow/analysis/knowledge.json
  --semantic            Merge semantic-links patch (agent meaning edges)
  -g, --graph <path>    Graph path override
  -o, --write-patch <p> Write normalized patch before merge
  --no-validate         Skip validate after merge
  --dry-run             Stats only, no save
```

**Examples:**
```bash
npx ai-spector graph merge --from-knowledge           # after /analyze
npx ai-spector graph merge patch.json                 # manual patch file
npx ai-spector graph merge --from-knowledge --dry-run # preview
```

Do not hand-edit `traceability.graph.json` for domain nodes — always merge via this command.

---

## `graph validate`

Validate graph against JSON schema and traceability rules.

```bash
npx ai-spector graph validate [options]

Options:
  -g, --graph <path>    Graph path override
  -s, --schema <path>   Schema path override
  --registry <path>     Registry path
  --rules <path>        Rules manifest path
```

Run after every merge or doc write. Exit code 0 = valid (warnings may still print).

---

## `graph report`

Layer health report: structure, spec instances, hubs, provenance, semantic links.

```bash
npx ai-spector graph report [options]

Options:
  -g, --graph <path>  Graph path override
  --json              JSON output
```

Useful for diagnosing missing provenance or empty domain layers.

---

## `graph visualize`

Generate an HTML report to explore the graph in a browser.

```bash
npx ai-spector graph visualize [options]

Options:
  --open   Open in default browser after generating
```

---

## `comments`

Git-backed review comment threads. Comments live under `comments/{logical_path}/`.

### `comments inbox`

Triage list of open threads, formatted for Cursor chat.

```bash
npx ai-spector comments inbox --json
```

Output: JSON with `idePresentation.markdown` table, each row has thread id, anchor, status.

### `comments list`

Raw list of threads with optional filters.

```bash
npx ai-spector comments list [options]

Options:
  --file <path>   Filter by logical file path (e.g. srs/01-overview)
  --json          JSON output
```

### `comments plan`

Resolve plan for a thread: anchor excerpt, graph impact, IDE workflow hints.

```bash
npx ai-spector comments plan [threadId] [options]

Options:
  --json   JSON output
```

### `comments show`

Thread detail: metadata, replies, events.

```bash
npx ai-spector comments show <threadId>
```

### `comments resolve`

Mark a thread resolved.

```bash
npx ai-spector comments resolve <threadId>
```

---

## `sync-cursor`

Refresh `.cursor/skills/` from the bundled scaffold without re-initializing the whole project.

```bash
npx ai-spector sync-cursor [-C <path>]
```

Use when a new version of `ai-spector` ships updated skills.

---

## Output paths (multi-language)

All document output paths follow:

```
docs/srs/{lang.code}/{filename}
docs/basic-design/{lang.code}/{filename}
docs/basic-design/{lang.code}/api/{slug}.md
docs/basic-design/{lang.code}/screens/{slug}.md
```

Primary language is the **first** entry in `languages[]` inside `docflow.config.json`. Secondary languages are translated from the finished primary file — never generated independently from the graph.

---

## Common sequences

**After analyzing data source:**
```bash
npx ai-spector graph merge --from-knowledge
npx ai-spector graph validate
npx ai-spector index --skip-merge
```

**After writing any doc file:**
```bash
npx ai-spector graph validate
npx ai-spector index
```

**After adding a language:**
```bash
npx ai-spector lang add jp
npx ai-spector index
```

**Before writing a section (query context):**
```bash
npx ai-spector graph query <seedNodeId> --json
# → read projectionPaths, write section, then:
npx ai-spector graph merge patch.json
```

**Check translation staleness:**
```bash
npx ai-spector graph impact --git --json
# → inspect staleTranslations[] in output
```
