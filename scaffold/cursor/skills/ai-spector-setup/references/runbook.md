# Project setup runbook

End-to-end setup so the user can say **"setup project"** once and start the docflow pipeline.

## Phase 0 — Audit

```bash
npx ai-spector setup --check --json
```

Parse `steps[]`: each has `id`, `label`, `status` (`ok` | `missing` | `warning`), optional `fix`.

If `ready: true`, skip to **Phase 4** (user reminders only).

## Phase 1 — Install CLI dependency

When `package.json` exists and step `npm-dep` is not `ok`:

```bash
npm install -D ai-spector
```

If there is no `package.json`, tell the user they can use `npx ai-spector` without a local install, or run `npm init -y` first if they want a project package.

## Phase 2 — Scaffold + hooks

Ask the user **one** question if languages are unknown:

> Which languages? (e.g. `en` only, or `en,jp,vi` for multi-language docs)

Then run (non-interactive — agent supplies flags):

```bash
npx ai-spector setup --yes --languages en,jp --install-dep
```

Add `--force` only when re-scaffolding an existing project and the user confirmed overwrite.

This command:

- Runs `init` (or `sync-cursor` if already initialized)
- Creates `docs/data-source/`, per-language `docs/srs/` / `docs/basic-design/`
- Runs `git init` if needed
- Installs pre-commit hook

## Phase 3 — Verify

```bash
npx ai-spector setup --check
```

All required steps (`node`, `init`, `cursor-skills`) must be `ok`. If not, fix and re-run Phase 2.

## Phase 4 — Cursor IDE (tell the user)

Print this checklist in chat:

1. **Open** this folder in Cursor (if not already).
2. **Settings → Rules → Agent Skills** — enable **all** folders under `.cursor/skills/`.
3. **Reload MCP** if `.cursor/mcp.json` is present.
4. **Add** source material under `docs/data-source/`.
5. **Next command in chat:** `"analyze my data source"` (or attach sample files first).

## Optional — Multi-language

If user wants translations later:

```bash
npx ai-spector lang add vi
```

## Guardrails

- Run commands from **project root**.
- On CLI failure → [cli-failures.md](../../ai-spector/references/cli-failures.md).
- Do **not** run analyze/generate until setup audit passes.
- Do not skip the skills-enable reminder — agents will not route correctly without it.

## Finish

Report a short table:

| Step | Status |
|------|--------|
| Scaffold | ok |
| Git hook | ok |
| Skills on disk | ok |
| User: enable skills in Cursor | manual |
| User: docs/data-source | manual |

Suggest: `"analyze the data source"` when ready.
