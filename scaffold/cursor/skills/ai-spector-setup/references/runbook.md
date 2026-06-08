# Project setup runbook

End-to-end setup so the user can say **"setup project"** once and start the docflow pipeline.

**Prefer this over manual CLI.** If the user wants CLI steps instead, point them to
[cli-setup.md](./cli-setup.md) or the full [setup-guide.md](../../../../../docs/setup-guide.md).

---

## Phase 0 — Audit

```bash
npx ai-spector setup --check --json
```

Parse `steps[]`: each has `id`, `label`, `status` (`ok` | `missing` | `warning`), optional `fix`.

If `ready: true` and CocoIndex is already configured, skip to **Phase 5** (user reminders only).
If `ready: true` but CocoIndex not yet asked, proceed to Phase 2.

---

## Phase 1 — Install CLI dependency

When `package.json` exists and step `npm-dep` is not `ok`:

```bash
npm install -D ai-spector
```

If there is no `package.json`, tell the user they can use `npx ai-spector` without a local install, or run `npm init -y` first if they want a project package.

---

## Phase 2 — Ask: languages

Ask the user **one** question if not known:

> Which languages? (e.g. `en` only, or `en,jp,vi` for multi-language docs)

Default: `en`.

---

## Phase 3 — Ask: CocoIndex (optional)

Ask the user **one** question:

> Do you want to enable CocoIndex for semantic doc search?
> (Requires Python 3.11+. Adds `docs_search` and `graph_query_fuzzy` MCP tools.
>  Can be added later with `npx ai-spector cocoindex setup`.)

Record yes/no — do not run yet.

---

## Phase 4 — Scaffold + hooks

```bash
npx ai-spector setup --yes --languages <codes> --install-dep
```

Example for `en,jp,vi`:
```bash
npx ai-spector setup --yes --languages en,jp,vi --install-dep
```

Add `--force` only when re-scaffolding an existing project and the user confirmed overwrite.

This command:
- Runs `init` (or `sync-cursor` if already initialized)
- Creates `docs/data-source/`, per-language `docs/srs/` and `docs/basic-design/`
- Runs `git init` if needed
- Installs pre-commit hook
- Copies all agent skills to `.cursor/skills/`

Then verify:
```bash
npx ai-spector setup --check
```
All three must show `✓`: `node`, `init`, `cursor-skills`.

---

## Phase 4b — CocoIndex setup (if user said yes in Phase 3)

```bash
npx ai-spector cocoindex setup
```

Then tell the user:
> Python steps (run in terminal):
> ```bash
> cd .ai-spector/.docflow/cocoindex
> pip install -r requirements.txt
> python pipeline.py cocoindex update
> ```
> Default: LanceDB (no server needed). See `.env.example` for Postgres or OpenAI options.

---

## Phase 5 — Cursor IDE (tell the user)

Print this checklist in chat:

1. **Open** this folder in Cursor (if not already open).
2. **Settings → Rules → Agent Skills** — enable **all** folders under `.cursor/skills/`.
3. **Reload MCP** if `.cursor/mcp.json` is present.
4. **Add** source material under `docs/data-source/`.
5. **Next command in chat:** `"analyze my data source"` (or attach sample files first).

---

## Optional — Add a language later

```bash
npx ai-spector lang add vi
npx ai-spector index
```

---

## Guardrails

- Run all commands from **project root**.
- On CLI failure → [cli-failures.md](../../ai-spector/references/cli-failures.md).
- Do **not** run analyze/generate until setup audit passes.
- Do **not** skip the skills-enable reminder — agents will not route correctly without it.

---

## Finish

Report a short summary table:

| Step | Status |
|------|--------|
| Scaffold | ok |
| Git hook | ok |
| Skills on disk | ok |
| CocoIndex | ok / skipped |
| User: enable skills in Cursor | **manual** |
| User: add docs/data-source/ | **manual** |

Suggest next command: `"analyze my data source"` when ready.
