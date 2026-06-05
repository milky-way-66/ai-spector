# AI Spector

Documentation workflow in **Cursor**: traceability graph, SRS / basic / detail design. **Describe what you need in chat** — skills route the agent, which runs `ai-spector` CLI. You usually do not run CLI yourself.

**Needs:** Node 20+, [Cursor](https://cursor.com), [uv](https://docs.astral.sh/uv/) (Graphify MCP after `init`).

## Setup (once)

**In Cursor:** ask **"setup ai-spector project"** (agent runs the setup skill).

**CLI:**

```bash
npm install -D ai-spector
npx ai-spector setup              # guided wizard
npx ai-spector setup -y -l en,jp  # non-interactive
npx ai-spector setup --check      # audit checklist
```

1. Open the project in Cursor → reload **MCP** → enable **all** skills under `.cursor/skills/`.
2. Put source material in `docs/data-source/`.

Re-init scaffold: `npx ai-spector init --force` or `npx ai-spector setup -y --force`. After upgrading: `npx ai-spector sync-cursor`.

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
```

Ask in chat: **“generate HTML prototype”** — if no theme is saved, the agent recommends 3 themes, opens previews in your browser, and waits for you to pick. Or name one upfront: “prototype with stripe theme”.

```bash
npx ai-spector prototype auth --username demo --password '<secret>'  # once per project
npx ai-spector prototype preview stripe --open   # optional: preview yourself
npx ai-spector prototype setup --theme vercel    # after you choose
```

Then ask: “generate HTML prototype for all screens” → `npx ai-spector prototype manifest` → `prototype validate --strict`.

### Day to day

| When | Say (examples) |
|------|----------------|
| New or changed data source | “analyze data source” |
| Check graph | “validate the graph” |
| Regenerate docs | “generate SRS”, “generate basic design”, … |
| HTML prototype | “generate prototype with stripe theme” |
| Choose a theme | “help me pick a prototype theme”, “show me theme options” |
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

For scripts or debugging: `npx ai-spector index`, `graph validate`, `graph visualize --open`, `graph impact --git`, `prototype auth|themes|preview|setup|manifest|validate`. See `npx ai-spector --help`.

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
