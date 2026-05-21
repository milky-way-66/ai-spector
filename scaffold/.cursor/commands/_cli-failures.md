# CLI failures (mandatory agent behavior)

When any `ai-spector` command **fails** (non-zero exit, throws, or empty/invalid JSON when `--json` was required):

1. **Stop** the current slash command — no templates, no subagents, no writing `docs/srs/**`.
2. **Show the user** the failure using the response format below (verbatim CLI output).
3. **Explain** what it means in plain language and give **concrete fix steps** the user can take (or approve the agent to apply).
4. **Re-run the same CLI** after the fix — do not switch to a manual workaround.

## Forbidden when CLI fails

| Do not | Why |
|--------|-----|
| Hand-edit `traceability.graph.json` at scale | Bypasses merge/validate; drifts from `knowledge.json` |
| Implement graph BFS/search in the agent | Duplicates `graph query` / `graph impact` |
| Glob or read all of `docs/srs/**` because query failed | Hides missing graph or bad seed id |
| Use `.ai-spector/index/*.md` as primary context when validate/query failed | Index is fallback only after **successful** CLI with empty graph |
| Skip `graph merge` and “fill SRS from memory” | Breaks traceability |
| Silently continue after `graph validate` errors | Generation will be wrong or inconsistent |
| Tell the user “run this CLI yourself” without fixing | User workflow is slash commands; agent owns CLI |

**Allowed after successful CLI:** If `graph query --json` succeeds but `nodes` has no domain entries, say so and suggest **`/analyze`** — still do not bulk-read `docs/srs/**`.

---

## Response format (copy this structure)

```markdown
## Blocked: <slash-command> — CLI failed

**Command:** `ai-spector <subcommand> …`
**Exit code:** <n>

**CLI output:**
\`\`\`
<paste full stdout/stderr>
\`\`\`

**What this means:** <one or two sentences>

**How to fix:**
1. <step for user or agent>
2. <step>
3. Re-run **/<slash-command>** (or the step that failed, e.g. `/analyze`)

**I will not:** <e.g. generate SRS without a passing validate, or edit the graph by hand>
```

---

## Common failures → fixes

### `ai-spector: command not found`

- **Means:** Package not installed or not on PATH.
- **Fix:** `npm install ai-spector` in the project; agent uses `npx ai-spector …` from project root.

### `Could not find project root` / missing `docflow.config.json`

- **Means:** `init` not run or wrong working directory.
- **Fix:** Run `npx ai-spector init` from project root; agent `cd`s to workspace root before CLI.

### `ai-spector analyze` fails

- **Means:** Registry/templates or graph bootstrap broke.
- **Fix:** Show full error; check `.ai-spector/registry/section-registry.json` exists; re-run `init` if config is corrupt; do not proceed to merge.

### `graph merge` — `No domain entries in knowledge.json`

- **Means:** `/analyze` extract did not populate staging.
- **Fix:** Re-run Graphify extract in `/analyze`; ensure `docs/data-source/` has real files; fill `knowledge.json` with at least one `useCase` or `feature`.

### `graph merge` — `Merge edge missing target node` / section id

- **Means:** `listedInSection` points to a section id not in the graph.
- **Fix:** Use a section id from `section-registry.json` (e.g. `sec.srs.3-use-cases.l3.3.32-list-use-case`) or omit `listedInSection` for defaults; re-run merge.

### `graph validate` — `DOMAIN-ANCHORED` / `SECTION-TREE` / `SCHEMA`

- **Means:** Graph inconsistent with rules.
- **Fix:** Paste each `[ERROR]` line; prefer re-run **`/analyze`** (merge) over manual JSON surgery; for one bad id, agent may patch **only** that node/edge then re-validate.

### `graph query <id>` — seed missing or empty subgraph

- **Means:** Wrong id, or domain not merged.
- **Fix:** Run **`/visualize-graph`** or `graph query` with a known id from `knowledge.json`; run **`/analyze`** if no `useCase`/`feature` nodes.

### `graph query` — invalid JSON / parse error

- **Means:** CLI crashed or wrong cwd.
- **Fix:** Re-run from project root; if repeat, report as tool bug with full stderr.

### Graphify MCP unavailable

- **Means:** `/analyze` cannot extract.
- **Fix:** User enables Graphify in Cursor; do not fake `knowledge.json`; stop and document blocker.

### `graphify update` — `unknown option: --graph`

- **Means:** Agent used `graphify update <path> --graph <file>`. The `update` subcommand does **not** accept `--graph` (only `query`, `explain`, `path`, `cluster-only` do).
- **Fix:** Run **`ai-spector graphify update`** (sets absolute `GRAPHIFY_OUT` and project-root cwd). Do not pass `--graph` on `update`.

### `graphify update` — `No code files found` (exit 1) on empty `docs/srs` / `docs/basic-design`

- **Means:** Graphify was invoked on an empty doc folder (no files to index).
- **Fix:** **`ai-spector index`** / **`ai-spector graphify update`** skip empty sources automatically. Add SRS/basic-design markdown when you want Graphify storage for those paths.

### `graphify update` — output under `docs/data-source/.ai-spector/...`

- **Means:** `GRAPHIFY_OUT` was a **relative** path and Graphify resolved it from the **source directory** (`docs/data-source`), not the repo root.
- **Fix:** Run **`ai-spector graphify update`** from the project root. Delete mistaken `docs/data-source/graphify-out/` or `docs/data-source/.ai-spector/.docflow/graph/graphify-out/` if present.

### `graph impact --git` — not a git repository / no changes

- **Means:** `--git` needs a git working tree with staged or unstaged diffs.
- **Fix:** Initialize git (`git init`) and make edits, or use **`/impact <description>`**, editor selection, or `--file` / `--heading` instead of `--git`.

### `graph impact --git` — could not map diff to graph seeds

- **Means:** Changed paths are not linked to `document` / `section` nodes (e.g. only `README.md` or `src/`).
- **Fix:** Run impact on doc paths under `docs/` or `.ai-spector/`; or **`/impact`** with a short description of the traceability change.

### Stale graph or indexes after manual edits or `/generate-srs`

- **Means:** User changed `docs/data-source/`, SRS outputs, or templates without re-running ingest; graph still shows template-only domain nodes.
- **Fix:** Run **`ai-spector index`** (or **`/index`**). Index merges `knowledge.json`, parses UC/F/actor ids from `docs/srs/` bodies, and runs Graphify on **changed** paths (`docs/data-source`, `docs/srs`, `docs/basic-design`). Use **`--force-graphify`** if Graphify output must rebuild entirely.
- **Still stale domain detail?** Re-run **`/analyze`** for Graphify MCP → fresh `knowledge.json`.

### Graphify wrote `docs/data-source/graphify-out/` or `docs/data-source/.ai-spector/.../graphify-out/`

- **Means:** `graphify update` ran without absolute `GRAPHIFY_OUT` from project root (or used a relative env path).
- **Fix:** Run **`ai-spector graphify update`** (absolute `GRAPHIFY_OUT`, cwd = project root, removes stale folders). Do not copy files manually unless CLI failed.

---

## Agent may fix without asking (small, local)

- Create missing parent dirs under `.ai-spector/` if `init` was incomplete.
- Correct a **single** typo in `knowledge.json` id or `listedInSection` then re-run `graph merge`.
- Re-run the **same** failed command once after an obvious fix (e.g. `cd` to project root).

## Agent must ask user before

- Deleting `traceability.graph.json` or re-running `init --force`.
- Large manual edits to graph or generated SRS.
- Changing bundled templates or `workflow.dependencies.json`.
