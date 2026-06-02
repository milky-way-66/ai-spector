# CLI and tool failures (mandatory agent behavior)

When any `ai-spector` command **fails** (non-zero exit, throws, or empty/invalid JSON when `--json` was required), or a **required tool** fails unexpectedly (MCP, terminal, network):

1. **Pause** the current step — no templates, no subagents, no writing `docs/srs/**`, no silent fallbacks.
2. **Report** using the response format below (verbatim CLI/tool output).
3. **Offer recovery** — always present **fix and retry** (recommended) and, when safe, a **bounded workaround** the agent can execute if the user approves.
4. **Wait for the user** (or apply [auto-fix without asking](#agent-may-fix-without-asking-small-local) only for trivial local fixes).
5. After fix or approved workaround, **continue the same task** from the failed step (re-run the same CLI when possible).

**Default:** fix and retry. **Workarounds** are allowed only with explicit user approval and the guardrails in [Workaround catalog](#workaround-catalog-user-approval-required).

---

## Recovery flow

```text
Tool/CLI fails
  → pause + report (Blocked format)
  → propose Option 1 (fix & retry) + Option 2 (workaround, if any) + Option 3 (pause)
  → user picks (or auto-fix for trivial cases)
  → execute choice → re-run same CLI at next checkpoint when possible
```

| User says | Agent does |
|-----------|------------|
| **1**, “fix”, “retry”, “yes fix” | Apply fix steps (or ask for one missing input), re-run **the same** failed command/step |
| **2**, “workaround”, “continue anyway” | Follow [Workaround catalog](#workaround-catalog-user-approval-required); state trade-offs; merge/validate when writing docs |
| **3**, “pause”, “stop”, no reply yet | Stop; do not generate or bulk-read docs; user re-runs the task later |
| “you figure it out” / “use your judgment” | Prefer **fix and retry** first; if blocked after one retry, propose the **smallest** approved workaround and ask once |

Do **not** leave the user stuck with only “run `/analyze` again” when you can propose a concrete fix **or** a bounded workaround.

---

## Forbidden (unless user explicitly approves a workaround)

| Do not | Why |
|--------|-----|
| Hand-edit `traceability.graph.json` at scale | Bypasses merge/validate; drifts from `knowledge.json` |
| Implement graph BFS/search in the agent | Duplicates `graph query` / `graph impact` |
| Glob or read all of `docs/srs/**` because query failed | Hides missing graph or bad seed id |
| Use `.ai-spector/index/*.md` as **primary** context when validate/query failed | Index is fallback only after **successful** CLI with thin graph |
| Skip `graph merge` and “fill SRS from memory” | Breaks traceability |
| Silently continue after `graph validate` errors | Generation will be wrong or inconsistent |
| Tell the user “run this CLI yourself” without offering to run it | Agent owns CLI in this workflow |
| Continue generation after CLI failure **without** user choosing fix, workaround, or pause | User must not be blocked silently or bypassed silently |

**Allowed after successful CLI:** If `graph query --json` succeeds but `nodes` has no domain entries, say so and suggest **analyze** — still do not bulk-read `docs/srs/**`.

---

## Response format (copy this structure)

```markdown
## Blocked: <task or slash-command> — <CLI | tool> failed

**Command / tool:** `ai-spector <subcommand> …` or `<MCP tool name>`
**Exit code:** <n> (if applicable)

**Output:**
\`\`\`
<paste full stdout/stderr or tool error>
\`\`\`

**What this means:** <one or two sentences>

**How to fix (recommended):**
1. <step agent or user can take>
2. <step>
3. Re-run the same step: `<exact command>` or **/<slash-command>**

**Workaround (optional):** <only if bounded and useful — e.g. “read these 2 projection paths and draft section X; merge after index recovers”>
**Trade-off if workaround:** <traceability / staleness risk in plain language>

**What would you like to do?**
1. **Fix and retry** (recommended) — <one-line summary of fix path>
2. **Workaround** — <one-line summary; skip only if none applies>
3. **Pause** — stop here; you fix environment and say “retry” or re-run the task

Reply with **1**, **2**, **3**, or tell me your preference.
```

For **optional** steps (e.g. `graph visualize --open`), you may use a shorter **Interrupted** header but still offer fix vs skip.

---

## Workaround catalog (user approval required)

Use only when the user chooses **2** or explicitly accepts the trade-off. Prefer the **smallest** scope that unblocks the task; return to CLI as soon as it works.

| Situation | Workaround | Guardrails | Restore traceability |
|-----------|------------|------------|----------------------|
| `graph query` fails once (cwd, typo) | Fix cwd/seed id; one retry | No doc writes until query succeeds | Re-run query before write |
| `graph query` OK but thin `nodes` | Read only `projectionPaths` + cited `docs/data-source/**` | Named paths only; no `docs/srs/**` glob | `graph merge` + `validate` after draft |
| `graph validate` — one bad id/edge | Patch **single** node/edge; re-validate | No mass graph surgery | `validate` must pass before next wave |
| `graph merge` — one bad `listedInSection` | Fix id in `knowledge.json`; re-merge | No hand-merge of full graph | Same |
| Graphify MCP down mid-**analyze** | Continue with existing `knowledge.json` + user sources | User accepts stale extract; document in reply | Re-run **analyze** when MCP is back |
| `graphify update` on markdown-only path | Skip (expected); use **index** for doc semantics | Do not treat as hard failure | **index** on schedule per command doc |
| `index` fails on one path | Skip that path if command allows; fix path and re-index | Do not skip required wave index without user OK | Re-run **index** for skipped paths |
| Optional visualize fails | Skip open; continue pipeline | User chose workaround | None |
| Terminal/env (not git, missing `uv`) | Agent runs install/init steps user approves | No destructive deletes without ask | Re-run failed CLI |
| Generation blocked only by **upstream** missing SRS | User approves generating prerequisite layer first | Run prerequisite wave with normal merge/validate | Full pipeline order |

After any workaround that wrote docs or graph patches: **`graph validate`** (and **`index`** when the command doc requires) before the next wave.

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

- **Means:** Analyze extract did not populate staging.
- **Fix:** Re-run Graphify extract in analyze; ensure `docs/data-source/` has real files; fill `knowledge.json` with at least one `useCase` or `feature`.
- **Workaround (user OK):** Manually add minimal entries to `knowledge.json` then re-merge.

### `graph merge` — `Merge edge missing target node` / section id

- **Means:** `listedInSection` points to a section id not in the graph.
- **Fix:** Use a section id from `section-registry.json` (e.g. `sec.srs.3-use-cases.l3.3.32-list-use-case`) or omit `listedInSection` for defaults; re-run merge.

### `graph validate` — `DOC-SECTION-COVERAGE` on `doc.bd.list-api` / `doc.bd.list-screen` / `doc.bd.db-design`

- **Means:** Basic-design **list chapter** documents exist in the graph without child `section` nodes (common after a projection-only `graph merge` before bootstrap/index).
- **Fix:** From project root run **`npx ai-spector index`** (or ask to **refresh index**). Ensure `.ai-spector/templates/basic_design/` exists (`npx ai-spector init`). Then re-run **`graph merge`** for your patch and **`graph validate`**.

### `graph validate` — `DOMAIN-ANCHORED` / `SECTION-TREE` / `SCHEMA`

- **Means:** Graph inconsistent with rules.
- **Fix:** Paste each `[ERROR]` line; prefer re-run **analyze** (merge) over manual JSON surgery; for one bad id, agent may patch **only** that node/edge then re-validate.

### `graph query <id>` — seed missing or empty subgraph

- **Means:** Wrong id, or domain not merged.
- **Fix:** Run **visualize-graph** or `graph query` with a known id from `knowledge.json`; run **analyze** if no `useCase`/`feature` nodes.

### `graph query` — invalid JSON / parse error

- **Means:** CLI crashed or wrong cwd.
- **Fix:** Re-run from project root; if repeat, report as tool bug with full stderr.

### Graphify MCP unavailable

- **Means:** Analyze cannot extract.
- **Fix:** User enables Graphify in Cursor; reload MCP.
- **Workaround (user OK):** Proceed with existing `knowledge.json` and data-source reads; schedule re-analyze.

### `graphify update` — `unknown option: --graph`

- **Means:** Agent used `graphify update <path> --graph <file>`. The `update` subcommand does **not** accept `--graph` (only `query`, `explain`, `path`, `cluster-only` do).
- **Fix:** Run **`ai-spector graphify update`** (sets absolute `GRAPHIFY_OUT` and project-root cwd). Do not pass `--graph` on `update`.

### `graphify update` — `No code files found` (exit 1) on `docs/srs` / `docs/basic-design`

- **Means:** Those paths are empty or markdown-only; Graphify `update` AST-indexes **code** extensions (`.py`, `.ts`, `.js`, …), not SRS markdown alone.
- **Fix:** **`ai-spector index`** / **`ai-spector graphify update`** skip empty and markdown-only sources automatically (success, not failure). Use **`docs/data-source`** for code Graphify indexing; SRS/basic-design semantics come from index doc-extract, not `graphify update`.

### `graphify update` — output under `docs/data-source/.ai-spector/...`

- **Means:** `GRAPHIFY_OUT` was a **relative** path and Graphify resolved it from the **source directory** (`docs/data-source`), not the repo root.
- **Fix:** Run **`ai-spector graphify update`** from the project root. Delete mistaken `docs/data-source/graphify-out/` or `docs/data-source/.ai-spector/.docflow/graph/graphify-out/` if present.

### `graph impact --git` — not a git repository / no changes

- **Means:** `--git` needs a git working tree with staged or unstaged diffs.
- **Fix:** Initialize git (`git init`) and make edits, or use **impact** with a short description, editor selection, or `--file` / `--heading` instead of `--git`.

### `graph impact --git` — could not map diff to graph seeds

- **Means:** Changed paths are not linked to `document` / `section` nodes (e.g. only `README.md` or `src/`).
- **Fix:** Run impact on doc paths under `docs/` or `.ai-spector/`; or **impact** with a short description of the traceability change.

### Stale graph or indexes after manual edits or generate SRS

- **Means:** User changed `docs/data-source/`, SRS outputs, or templates without re-running ingest; graph still shows template-only domain nodes.
- **Fix:** Run **`ai-spector index`**. Use **`--force-graphify`** if Graphify output must rebuild entirely.
- **Still stale domain detail?** Re-run **analyze** for Graphify MCP → fresh `knowledge.json`.

### Graphify wrote `docs/data-source/graphify-out/` or `docs/data-source/.ai-spector/.../graphify-out/`

- **Means:** `graphify update` ran without absolute `GRAPHIFY_OUT` from project root (or used a relative env path).
- **Fix:** Run **`ai-spector graphify update`** (absolute `GRAPHIFY_OUT`, cwd = project root, removes stale folders). Do not copy files manually unless CLI failed and user approved workaround.

---

## Agent may fix without asking (small, local)

- Create missing parent dirs under `.ai-spector/` if `init` was incomplete.
- Correct a **single** typo in `knowledge.json` id or `listedInSection` then re-run `graph merge`.
- Re-run the **same** failed command once after an obvious fix (e.g. `cd` to project root).
- Wrong CLI flags the agent introduced (e.g. `graphify update --graph`) — fix and retry immediately.

## Agent must ask user before

- Deleting `traceability.graph.json` or re-running `init --force`.
- Large manual edits to graph or generated SRS.
- Changing bundled templates or `workflow.dependencies.json`.
- Any [workaround](#workaround-catalog-user-approval-required) not listed above or that skips **validate** before the next generation wave.
- Bulk reads under `docs/srs/**` or `docs/basic-design/**` as primary context.
