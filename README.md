# AI Spector

Documentation workflow in **Cursor**: traceability graph, SRS / basic / detail design. **Describe what you need in chat** — skills route the agent, which runs `ai-spector` CLI. You usually do not run CLI yourself.

**Needs:** Node 20+, [Cursor](https://cursor.com), [uv](https://docs.astral.sh/uv/) (Graphify MCP after `init`).

## Setup (once)

```bash
npm install -D ai-spector
npx ai-spector init
```

1. Open the project in Cursor → reload **MCP** → enable **all** skills under `.cursor/skills/` (see `README.md` there).
2. Put source material in `docs/data-source/`.

Re-init scaffold: `npx ai-spector init --force`. After upgrading the package: `npx ai-spector sync-cursor`.

## Workflow

See `.cursor/WORKFLOW.md` after `init`. Enable all skills under `.cursor/skills/`.

### First run (natural language)

```text
“analyze the data source”
“validate the graph”
“generate the SRS”
“refresh the index”
```

Then: “generate basic design” → “generate detail design” as needed.

HTML prototype:

```bash
npx ai-spector prototype themes
npx ai-spector prototype setup --theme vercel
```

Then ask: “generate HTML prototype for all screens” → `npx ai-spector prototype manifest` → `prototype validate --strict`.

### Day to day

| When | Say (examples) |
|------|----------------|
| New or changed data source | “analyze data source” |
| Check graph | “validate the graph” |
| Regenerate docs | “generate SRS”, “generate basic design”, … |
| HTML prototype | “generate prototype with stripe theme” |
| After doc edits | “re-index the graph” |
| What to redo | “what’s the impact of my changes” |
| Review comments | “resolve comments” |
| Explore graph | “visualize the graph” |

### Typical path

```text
docs/data-source/  →  analyze  →  validate graph  →  generate SRS  →  index
                              →  generate basic design  →  generate detail design
                              →  prototype setup  →  generate HTML screens
```

## CLI (optional)

For scripts or debugging: `npx ai-spector index`, `graph validate`, `graph visualize --open`, `graph impact --git`, `prototype themes|setup|manifest|validate`. See `npx ai-spector --help`.

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
