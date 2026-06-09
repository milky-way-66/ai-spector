# AI Spector

Documentation workflow in **Cursor** or **Claude Code**: traceability graph, SRS / basic / detail design. **Describe what you need in chat** — skills route the agent, which runs `ai-spector` CLI or MCP tools. You usually do not run CLI yourself.

**Needs:** Node 20+, Git, [Cursor](https://cursor.com) and/or [Claude Code](https://docs.anthropic.com/en/docs/claude-code), Python 3.11+ *(optional — CocoIndex semantic search)*.

Full setup reference: [docs/setup-guide.md](docs/setup-guide.md)

**Tiếng Việt:** [README.vi.md](README.vi.md)

---

## Setup (once)

### Prerequisites

| Requirement | Check |
|-------------|-------|
| Node.js ≥ 20 | `node --version` |
| Git repository | `git status` |
| Cursor and/or Claude Code | IDE open in project root |
| Python ≥ 3.11 *(optional)* | only for CocoIndex semantic search |

---

### Step 1 — Scaffold *(only CLI step)*

Run once in your project root:

```bash
npx ai-spector init
```

The wizard prompts for editor (Cursor, Claude Code, or both), languages, git hook, and optional CocoIndex.

This creates:

- `.ai-spector/` — config, graph, templates
- `docs/data-source/`, `docs/srs/`, `docs/basic-design/`
- **Cursor:** `.cursor/` — skills, rules, `mcp.json`
- **Claude Code:** `CLAUDE.md` + `.claude/skills/` + `.mcp.json`
- Pre-commit hook (when git is available)

---

### Step 2 — Finish setup in chat

Open the project in **Cursor** or **Claude Code** and say:

```text
setup ai-spector project
```

The agent installs the npm dependency (if needed), verifies the checklist, offers CocoIndex, and reminds you what is left to do manually.

---

### Step 3 — Enable the agent *(manual, one-time)*

**Cursor**

1. **Settings → Rules → Agent Skills** — enable **all** folders under `.cursor/skills/` (see `.cursor/skills/README.md`)
2. **Reload MCP** — `.cursor/mcp.json` registers the `ai-spector` MCP server

**Claude Code**

1. Skills load automatically from `.claude/skills/` (see `CLAUDE.md`)
2. **Reload MCP** — `.mcp.json` registers the `ai-spector` MCP server

---

### Step 4 — Add source material

Drop requirements docs, meeting notes, user stories, or any input into `docs/data-source/`. Supported formats: `.md`, `.txt`, `.pdf`.

---

### Step 5 — Start the pipeline

In chat:

```text
analyze my data source
```

Then continue in chat as needed — see [Workflow](#workflow) below.

---

### Optional — CocoIndex semantic search

Enables `docs_search` and `graph_query_fuzzy` MCP tools. Requires Python ≥ 3.11.

In chat:

```text
enable CocoIndex for this project
```

See [docs/setup-guide.md](docs/setup-guide.md) for Postgres / OpenAI embedding options.

---

### Add another editor later

In chat:

```text
add Claude Code support to ai-spector
sync ai-spector cursor skills
```

After upgrading ai-spector, say **"sync ai-spector cursor skills"** in chat.

---

## Workflow

See `.cursor/WORKFLOW.md` (Cursor) or `CLAUDE.md` (Claude Code) after `init`.

### First run

Say in chat:

```text
“analyze the data source”
“validate the graph”
“generate the SRS”
“refresh the index”
```

Then: **“generate basic design”** → **“generate detail design”** as needed.

**HTML prototype** — say **“generate HTML prototype”**. If no theme is saved, the agent recommends 3 themes, opens previews in your browser, and waits for you to pick. Or name one upfront: **“prototype with stripe theme”**.

Then: **“generate HTML prototype for all screens”**.

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

---

## CLI (optional)

For scripts or debugging only: `npx ai-spector index`, `graph validate`, `graph visualize --open`, `graph impact --git`, `prototype auth|themes|preview|setup|manifest|validate`. See `npx ai-spector --help`.

---

## If something breaks

| Issue | Fix |
|-------|-----|
| MCP tools unavailable | Reload MCP; confirm `.cursor/mcp.json` or `.mcp.json` has `ai-spector` server |
| Setup incomplete | In chat: **“check ai-spector setup”** |
| Skills not routing (Cursor) | Re-enable all folders under `.cursor/skills/` in Settings → Rules |
| Validate errors after edits | In chat: **“re-index the graph”** |
| Pre-commit hook missing | In chat: **“install ai-spector git hook”** |
| Agent stuck on CLI error | `.cursor/skills/ai-spector/references/cli-failures.md` |

---

## Web / graph SDK

For **browser or custom dashboards** (not the Cursor/Claude CLI), use the read-only npm package **`ai-spector-graph`**. Your backend serves repo JSON; the frontend loads it into `ProjectSession`.

- **[Integration guide](docs/ai-spector-graph-integration-guide.md)** — architecture, API examples, React, recipes
- **[API reference](docs/ai-spector-graph.md)** — types and exports

```bash
npm install ai-spector-graph
```

---

## Develop

```bash
npm install && npm run build && npm test
```

MIT — [LICENSE](LICENSE).
