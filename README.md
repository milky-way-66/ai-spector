# AI Spector

Documentation workflow in **Cursor**: traceability graph, SRS / basic / detail design, driven by slash commands. The agent runs `ai-spector` CLI — you usually do not.

**Needs:** Node 20+, [Cursor](https://cursor.com), [uv](https://docs.astral.sh/uv/) (Graphify MCP after `init`).

## Setup (once)

```bash
npm install -D ai-spector
npx ai-spector init
```

1. Open the project in Cursor → reload **MCP** → enable **ai-spector** skills (`.cursor/skills/_skill-router.md`).
2. Put source material in `docs/data-source/`.

Re-init scaffold: `npx ai-spector init --force`. After upgrading the package: `npx ai-spector sync-cursor`.

## Workflow

Use **slash commands** in chat (or natural language with skills on). Details: `.cursor/commands/_workflow.md`.

### First run

```text
/analyze          → semantic extract (+ Graphify sidecar) → graph
/validate-graph   → check graph
/generate-srs     → SRS from graph
/index            → sync graph after generate
```

Then: `/generate-basic-design` → `/generate-detail-design` as needed.

### Day to day

| When | Command |
|------|---------|
| New or changed data source | `/analyze` |
| Check graph | `/validate-graph` |
| Regenerate docs | `/generate-srs`, `/generate-basic-design`, `/generate-detail-design` |
| Edited docs or finished generate | `/index` |
| What to redo after a change | `/impact` |
| Review comments | `/resolve-comments` |
| Explore graph | `/visualize-graph` |

### Typical path

```text
docs/data-source/  →  /analyze  →  /validate-graph  →  /generate-srs  →  /index
                              →  /generate-basic-design  →  /generate-detail-design
```

## CLI (optional)

For scripts or debugging: `npx ai-spector index`, `graph validate`, `graph visualize --open`, `graph impact --git`. See `npx ai-spector --help`.

## If something breaks

| Issue | Fix |
|-------|-----|
| Graphify / MCP | Install `uv`, reload MCP — `.cursor/commands/_cli-failures.md` |
| Validate errors after edits | `/index` |
| Old slash commands | `npx ai-spector sync-cursor` |

## Develop

```bash
npm install && npm run build && npm test
```

MIT — [LICENSE](LICENSE).
