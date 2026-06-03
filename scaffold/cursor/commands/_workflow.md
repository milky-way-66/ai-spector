# AI Spector workflow (Cursor)

**You use slash commands.** The agent runs **`npx ai-spector`** CLI in the terminal. Do not ask the user to run `analyze`, `graph merge`, or `graph query` manually.

If CLI or a required tool fails: agent **pauses**, shows output, and offers **fix and retry**, an **approved workaround**, or **pause** — see [**_cli-failures.md**](./_cli-failures.md). No silent fallbacks.

## One-time setup (terminal)

```bash
npm install ai-spector
npx ai-spector init
```

Add source material under `docs/data-source/`, open the project in Cursor, and **enable all npx ai-spector skills** under `.cursor/skills/` (see `.cursor/skills/README.md`).

Skills auto-route for natural language; **slash commands stay the source of truth** for step-by-step work (see [commands/README.md](./README.md)). Slash commands win over skills when both apply.

## Day-to-day (slash commands or natural language)

| Step | You run | Agent runs (CLI) |
|------|---------|------------------|
| 1 | **`/analyze`** | `npx ai-spector analyze` → read markdown from `docs/data-source/` → `graph merge --from-knowledge` → `graph validate` → optional `graph visualize --open` |
| 2 | **`/validate-graph`** | `npx ai-spector graph validate` |
| 3 | **`/generate-srs`** [paths or request] — all, listed files, or described scope (**confirm** if described) → waves → merge (see `generate-srs.md`) |
| 4 | **`/summary srs`** (optional) | Doc summaries under `.ai-spector/index/` (fallback browse; graph is primary) |
| — | **`/index`** | After manual edits or **`/generate-srs`**: `npx ai-spector index` (structure + knowledge merge + **SRS body extract** + doc indexes) |
| 5 | **`/generate-basic-design`** [paths or request] — same targeting + waves as SRS (`generate-basic-design.md`) |
| 6 | **`/generate-detail-design`** | same `graph query` pattern |
| 7 | **`/generate-prototype`** [--theme name] | `npx ai-spector prototype setup --theme …` → agent writes `prototype/src/*.html` → `prototype manifest` → `prototype validate --strict` |
| After edits | **`/impact`** [what changed] | Empty args → `git diff` + resolve seeds; else describe change → `graph impact <id> --json` (or `--git` / `--file`) |
| Review comments | **`/resolve-comments`** [pick or file] | `comments inbox` (show table only) → plan → apply → **one commit: doc + comment meta** (amend) → push |
| Inspect graph | **`/visualize-graph`** | `graph visualize --open` |

**Any step fails?** Agent reports the error, proposes fix vs workaround vs pause ([_cli-failures.md](./_cli-failures.md)); you pick **1 / 2 / 3** or say “retry”. The agent does not bypass CLI or bulk-read docs without your approval.

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
| Red error after `/analyze` | Read agent’s **Blocked** message; reply **1** (fix/retry), **2** (workaround), or **3** (pause) |
| Validate errors | **`/validate-graph`** — agent explains each `[ERROR]` and fixes or guides you |
| Empty SRS / wrong context | **`/analyze`** then **`/generate-srs`** — not “read all docs manually” |
| Unsure what regen | **`/impact`** (current git diff, selection, path, or short description) |
| Comment resolve incomplete | Missing doc in commit — amend must include **both** `docs/…` and `comments/…/`; see [resolve-comments.md](./resolve-comments.md) |

Details: [_cli-failures.md](./_cli-failures.md). CLI reference: [_graph.md](./_graph.md). Skills: [../skills/README.md](../skills/README.md), [../skills/_skill-router.md](../skills/_skill-router.md). Prerequisites: [_prerequisites.md](./_prerequisites.md).
