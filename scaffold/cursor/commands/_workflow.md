# AI Spector workflow (Cursor)

**You use slash commands.** The agent runs `ai-spector` CLI in the terminal. Do not ask the user to run `analyze`, `graph merge`, or `graph query` manually.

If CLI fails: agent **stops**, shows output, and helps you fix — see [**_cli-failures.md**](./_cli-failures.md). No silent fallbacks.

## One-time setup (terminal)

```bash
npm install ai-spector
npx ai-spector init
```

Add source material under `docs/data-source/`, open the project in Cursor, **reload MCP** (Graphify is in `.cursor/mcp.json` from `init`), and **enable all ai-spector skills** (see `.cursor/skills/_skill-router.md`).

Skills auto-route when you ask in natural language (e.g. “resolve this comment”, “generate SRS”). Slash commands still work and take priority.

## Day-to-day (slash commands or natural language)

| Step | You run | Agent runs (CLI) |
|------|---------|------------------|
| 1 | **`/analyze`** | `ai-spector analyze` → `ai-spector graphify update` (sidecar) → semantic extract → `graph merge --from-knowledge` → `graph validate` → optional `graph visualize --open` |
| 2 | **`/validate-graph`** | `ai-spector graph validate` |
| 3 | **`/generate-srs`** [paths or request] — all, listed files, or described scope (**confirm** if described) → waves → merge (see `generate-srs.md`) |
| 4 | **`/summary srs`** (optional) | Doc summaries under `.ai-spector/index/` (fallback browse; graph is primary) |
| — | **`/index`** | After manual edits or **`/generate-srs`**: `ai-spector index` (structure + knowledge merge + **SRS body extract** + Graphify on changed paths + doc indexes) |
| 5 | **`/generate-basic-design`** [paths or request] — same targeting + waves as SRS (`generate-basic-design.md`) |
| 6 | **`/generate-detail-design`** | same `graph query` pattern |
| After edits | **`/impact`** [what changed] | Empty args → `git diff` + resolve seeds; else describe change → `graph impact <id> --json` (or `--git` / `--file`) |
| Review comments | **`/resolve-comments`** [pick or file] | `comments inbox` (show table only) → plan → apply → **one commit: doc + comment meta** (amend) → push |
| Inspect graph | **`/visualize-graph`** | `graph visualize --open` |

**Any step fails?** Agent reports the error and fix steps, then you re-run the **same** slash command. The agent does not bypass CLI with manual graph edits or folder-wide doc reads.

## Typical first run

```text
npx ai-spector init          ← only CLI step you run yourself
docs/data-source/            ← add files
/analyze
/validate-graph
/generate-srs
/index
```

## If something fails

| Symptom | What to do |
|---------|------------|
| Red error after `/analyze` | Read agent’s **Blocked** message; fix data-source or Graphify; run **`/analyze`** again |
| Validate errors | **`/validate-graph`** — agent explains each `[ERROR]` and fixes or guides you |
| Empty SRS / wrong context | **`/analyze`** then **`/generate-srs`** — not “read all docs manually” |
| Unsure what regen | **`/impact`** (current git diff, selection, path, or short description) |
| Comment resolve incomplete | Missing doc in commit — amend must include **both** `docs/…` and `comments/…/`; see [resolve-comments.md](./resolve-comments.md) |

Details: [_cli-failures.md](./_cli-failures.md). CLI reference: [_graph.md](./_graph.md). Skills: [../skills/_skill-router.md](../skills/_skill-router.md). Prerequisites: [_prerequisites.md](./_prerequisites.md).
