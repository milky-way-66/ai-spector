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
| Refresh graph + indexes (JSON) | `npx ai-spector index --json` |
| Prepare graph for data-source analysis | `npx ai-spector graph analyze [--json]` |
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
| Record design-layer sync baseline | `npx ai-spector sync snapshot --label "…"` |
| Audit drift since baseline | `npx ai-spector sync audit --json` |
| CI gate for layer drift | `npx ai-spector sync audit --fail-on-drift` |
| Refresh Cursor skills | `npx ai-spector sync-cursor` |
| Bootstrap template-import task | `npx ai-spector task create -k import -w template-import -t "…"` |
| Approve import manifest plan | `npx ai-spector task approve-import-plan <taskId>` |
| Install template pack | `npx ai-spector template install --name <pack>` |

---

## `setup`

**Recommended** one-command setup (interactive or scripted).

```bash
npx ai-spector setup [options]

Options:
  --check           Audit only (no file changes)
  -l, --languages   Comma-separated codes (e.g. en,jp,vi)
  -y, --yes         Non-interactive defaults
  -f, --force       Re-run init (overwrite scaffold)
  --install-dep     npm install -D ai-spector --registry http://10.101.0.239:4873 when package.json exists
  --json            JSON audit output
  -C, --cwd         Project root
```

**Examples:**
```bash
npx ai-spector setup                    # interactive wizard
npx ai-spector setup -y -l en,jp,vi    # CI / agent-friendly
npx ai-spector setup --check --json    # status for IDE agent
```

Runs: audit → init or sync-cursor → git + pre-commit hook → `docs/data-source/` → Cursor checklist.

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
- **Git** — runs `git init` when the target dir is not already in a repo
- **Pre-commit hook** — `graph validate` (block), translation queue + impact (warn); re-run with `npx ai-spector hooks install`
- `git init` (if not already a repo) + **pre-commit hook** (`hooks pre-commit` on staged docs/graph)

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

## `lang queue`

Translation sync job queue (file-level, bidirectional). State files under `.ai-spector/.docflow/translation-queue/`:

| File | Contents |
|------|----------|
| `pending.json` | Open sync jobs |
| `resolved.json` | Completed jobs |
| `failed.json` | Conflicts / dismissed / errors |
| `fingerprints.json` | File hash + version baseline (internal) |
| `changes/` | Per-document merge context (`{docType}--{path}.json` with `changes[]`, diffs) |
| `change-history.json` | Append-only log of all file edits (lang, version, hashes) |

```bash
npx ai-spector lang queue pending [--lang jp] [--no-enrich] [--json]
npx ai-spector lang queue resolved [--limit 20] [--json]
npx ai-spector lang queue failed [--limit 20] [--json]
npx ai-spector lang queue scan
npx ai-spector lang queue fail <jobId> [--reason dismissed] [--message <text>]
npx ai-spector lang queue retry <jobId>
```

**Enrichment (default on `pending --json`):** each job includes `enrichment` with git-anchored `diff`, `impact` buckets (`intraDocTargets`, `regenerate`, `syncUpstream`, `review`), and optional `layerDrift`. Use `--no-enrich` for fast listing without diff/graph compute.

Reconciliation runs automatically at the end of `npx ai-spector index` when multiple languages are configured.

**Job directions:**
- `outbound` — primary changed → sync to secondary languages
- `inbound` — secondary changed → sync back to primary + other languages

**Merge resolution:** read `enrichment.diff` from `lang queue pending --json` for line-level context. Per-lang edit order: `changes/{docType}--{relativePath}.json` (`sequence`, `mtimeMs`). When `origin.mergedLangs` is set, merge using enrichment diff plus changes metadata. Full audit: `change-history.json`.

---

## `review queue`

Two-track document review (internal → client). State under `.ai-spector/.docflow/review-queue/`.

```bash
npx ai-spector review queue [--track internal|client|all] [--no-enrich] [--no-diff] [--json]
npx ai-spector review status <logicalPath> [--json] [--history]
npx ai-spector review begin [logicalPath] [--json]
npx ai-spector review check [--json]
npx ai-spector review approve <logicalPath> --by <name>
```

**Enrichment (default when diff shown):** pending entries include `enrichments[logicalPath]` with git-anchored `diff`, `impact.review` (downstream re-review candidates), and `impact.regenerate`. Use `--no-enrich` for fast queue listing.

**Anchors:** internal quorum writes `baselineAnchor` (git ref + hash) instead of eager snapshot diffs; legacy snapshots still work as fallback until re-approve.

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
  --direction <mode>  downstream (default), upstream, or both
  -o, --output <path> Write impact JSON to file
  --json              Print JSON

> **Note:** Change type is always `content_change` on the CLI. Use MCP
> `graph_impact({ change: "…" })` when you need a different change label.
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

## `hooks`

Git pre-commit checks for doc edits (local safety net).

```bash
npx ai-spector hooks install [-C <path>]
npx ai-spector hooks pre-commit [--strict] [--skip-impact] [--skip-queue]
```

**On commit** (when `docs/**` or `.ai-spector/graph/**` files are staged):

| Check | Behavior |
|-------|----------|
| Graph validate | Blocks commit on errors |
| Translation queue | Warns if pending jobs match staged docs |
| Graph impact | Warns if regenerate/review needed |

`--strict` turns warnings into errors. Bypass once: `git commit --no-verify`.

Installed automatically by `init` when the project is already a git repo.

---

## `sync snapshot`

Record a baseline when SRS, basic design, and detail design are aligned. Writes `.ai-spector/.docflow/sync/baseline.json` with per-file content hashes, graph hash, and git ref.

```bash
npx ai-spector sync snapshot [options]

Options:
  --label <text>    Human label for this baseline (e.g. sprint name)
  --git-ref <ref>   Git ref to store (default: HEAD)
  --force           Overwrite existing baseline
  --json            JSON output
```

**Examples:**
```bash
npx ai-spector sync snapshot --label "sprint-12"
npx ai-spector sync snapshot --force          # re-baseline after updates
npx ai-spector sync snapshot --json
```

Run after `index` when layers are confirmed aligned. Baseline already exists without `--force` → error (run audit first or force overwrite).

---

## `sync audit`

Compare live design layers against the sync baseline. Reports file-level drift (modified/added/deleted), git unified diffs from baseline `gitRef`, merged graph impact buckets, and traceability gap hints.

```bash
npx ai-spector sync audit [options]

Options:
  --json              JSON output (required for agent use)
  --fail-on-drift     Exit 1 when drift detected (CI gate)
  --direction <dir>   downstream | upstream | both (default: both when basic/detail changed)
  --verify-git-ref    Warn if HEAD is not descendant of baseline gitRef
```

**Examples:**
```bash
npx ai-spector sync audit --json
npx ai-spector sync audit --fail-on-drift   # CI — exit 0 when aligned
npx ai-spector sync audit --direction upstream --json
```

**Exit codes:** `0` aligned (or drift with no `--fail-on-drift`); `1` drift with `--fail-on-drift`; `2` no baseline — run `sync snapshot` first.

**CI example:**
```yaml
- run: npx ai-spector sync audit --fail-on-drift --json
```

After resolving drift: `index` → `sync snapshot --force` to reset baseline.

---

## `sync-cursor`

Refresh `.cursor/skills/` from the bundled scaffold without re-initializing the whole project.

```bash
npx ai-spector sync-cursor [-C <path>]
```

Use when a new version of `ai-spector` ships updated skills.

---

## `task`

Workflow task state (generate, resolve, **import**). Prefer MCP tools when available.

```bash
npx ai-spector task create -k <generate|resolve|import> -w <workflow> -t "<trigger>" [--force] [--json]
npx ai-spector task list [-k kind] [-w workflow] [--json]
npx ai-spector task status [--json]                    # slots: generate / resolve / import
npx ai-spector task get <taskId> [--json]
npx ai-spector task update <taskId> --patch '<json>' [--json]
npx ai-spector task approve <taskId>                   # generate/resolve plan gate only
npx ai-spector task approve-import-plan <taskId>       # import manifest plan gate
npx ai-spector task approve-pack-design <taskId> --design-spec <path>
npx ai-spector task complete <taskId> [--json]
```

**Import workflow** (`-k import -w template-import`): use `approve-pack-design` and `approve-import-plan` — **not** `task approve`.

---

## `template`

Template pack scan, infer, install (gated during import).

```bash
npx ai-spector template scan <sourcePath>
npx ai-spector template infer [--json]
npx ai-spector template install [--name <pack>] [--dry-run]
npx ai-spector template list
npx ai-spector template inspect <pack> [--json]
npx ai-spector template setup-mark <pack> <itemId>
```

`template install` requires an active import task with approved manifest plan unless `--legacy`.

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

**Layer sync baseline + drift audit:**
```bash
npx ai-spector sync snapshot --label "sprint-12"
# … edits to docs/basic-design/ or docs/detail-design/ …
npx ai-spector sync audit --json
# → resolve drift, then:
npx ai-spector index && npx ai-spector sync snapshot --force
```
