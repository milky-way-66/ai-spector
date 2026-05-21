# AI Spector

Turn project notes and specs into structured documentation (SRS, basic design, detail design) inside [Cursor](https://cursor.com).

You work with **slash commands**. The AI runs the `ai-spector` CLI behind the scenes. You only use the terminal once: **`npx ai-spector init`**.

---

## How you work (Cursor-first)

### Once per project

```bash
npm install ai-spector
npx ai-spector init
```

Put your source files in `docs/data-source/`, open the folder in Cursor, and turn on the **ai-spector** skill.

### Then use slash commands

| You run | What happens |
|---------|----------------|
| **`/analyze`** | Builds the graph skeleton, extracts knowledge (Graphify), merges use cases & features into the graph, validates |
| **`/visualize-graph`** | Opens a browser report to inspect the graph and `knowledge.json` |
| **`/validate-graph`** | Checks the graph before generation |
| **`/generate-srs`** | Writes SRS files using graph context (not whole-folder guessing) |
| **`/generate-basic-design`** | Basic design from the graph |
| **`/generate-detail-design`** | Detail design from the graph |
| **`/graph-impact <id>`** | Shows what to regenerate after you change something |

**Typical path:**

```text
npx ai-spector init
→ add docs/data-source/
→ /analyze
→ /validate-graph
→ /generate-srs
```

Command details live in `.cursor/commands/` after `init` (start with `_workflow.md`).

If a CLI step fails during a slash command, the agent should **stop**, show you the error, and help you fix it — not bypass the tool with manual edits. See `_cli-failures.md` in your project after `init`.

---

## What is the graph?

All structure and traceability live in one file:

`.ai-spector/graph/traceability.graph.json`

- Chapters and headings → **sections** in the graph  
- Use cases, features, actors → **domain nodes** with links (`listedIn`, `satisfies`, …)  
- Files under `docs/srs/` → **output** of the graph, not the source of truth  

**Graphify** (optional MCP) only helps read `docs/data-source/` during **`/analyze`**. The graph remains canonical.

---

## Requirements

- Node.js 20+
- [Cursor](https://cursor.com)
- Graphify MCP for **`/analyze`**

---

## Try the example in this repo

For package developers:

```bash
git clone <repo-url>
cd ai-spector
npm install && npm run build
npm run init:example
```

Open **`example/`** as the Cursor workspace, add files under `example/docs/data-source/`, then run **`/analyze`** → **`/generate-srs`**.

See [example/README.md](example/README.md).

---

## Project layout (after init)

```text
your-project/
  .cursor/commands/          # /analyze, /generate-srs, …
  .cursor/skills/ai-spector/
  .ai-spector/
    graph/traceability.graph.json
    .docflow/analysis/knowledge.json
    views/graph-knowledge.html   # after /visualize-graph
  docs/
    data-source/                 # your inputs
    srs/                         # generated
```

---

## For developers & contributors

The CLI is the engine; Cursor commands wrap it.

| Doc | Topic |
|-----|--------|
| [workflow-overview.md](docs/design/workflow-overview.md) | Graph-centric design |
| [traceability-graph-redesign.md](docs/design/traceability-graph-redesign.md) | Schema and roadmap |

**Build from source:**

```bash
npm install && npm run build
npm run init:example
```

**CLI reference** (normally invoked by agents, not end users):

| Command | Purpose |
|---------|---------|
| `ai-spector init` | Scaffold project |
| `ai-spector analyze` | Section tree in graph |
| `ai-spector graph merge --from-knowledge` | Domain nodes from staging |
| `ai-spector graph validate` | Rules check |
| `ai-spector graph visualize [--open]` | HTML report |
| `ai-spector graph query <id> --json` | Context for generation |
| `ai-spector graph impact <id> --json` | Regen scope |

Option: `-r <path>` to point at another project root.

---

## License

MIT — see [LICENSE](LICENSE).
