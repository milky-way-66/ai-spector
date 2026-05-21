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

Put your source files in `docs/data-source/`, open the folder in Cursor, turn on the **ai-spector** skill, and **reload MCP** (init writes `.cursor/mcp.json` for Graphify).

**Graphify requires:** [uv](https://docs.astral.sh/uv/) installed; package `graphifyy` is pulled via `uv tool run` on first MCP start.

### Then use slash commands

| You run | What happens |
|---------|----------------|
| **`/analyze`** | Builds the graph skeleton, extracts knowledge (Graphify), merges use cases & features into the graph, validates |
| **`/visualize-graph`** | Opens a browser report to inspect the graph and `knowledge.json` |
| **`/validate-graph`** | Checks the graph before generation |
| **`/generate-srs`** | All SRS, listed files, or a short request (agent confirms scope) — graph-first, by DAG waves |
| **`/generate-basic-design`** | All, listed files, or request (confirm) — graph + SRS context, by waves |
| **`/generate-detail-design`** | Detail design from the graph |
| **`/graph-impact <id>`** | Shows what to regenerate after you change something |
| **`/index`** (or `ai-spector index`) | Rebuild graph structure, re-merge knowledge, Graphify storage, doc indexes after manual file edits |
| **`/summary`** (optional) | Build `.ai-spector/index/*.md` doc summaries — not the same as full `/index` |

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

### Graphify MCP (configured on `init`)

`init` adds **`.cursor/mcp.json`** (Graphify) and updates **`.gitignore`** (Graphify cache, HTML reports, legacy `docs/data-source/graphify-out/`).

Graphify graph file:

`.ai-spector/.docflow/graph/graphify-out/graph.json`

Restart Cursor or reload MCP after init. If you still see **`docs/data-source/graphify-out/`**, that is an old Graphify default — delete it; see `docs/data-source/README.md`.

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
| [testing.md](docs/testing.md) | Vitest layout, commands, mocking |

**Build from source:**

```bash
npm install && npm run build
npm test
npm run init:example
```

**CLI reference** (normally invoked by agents, not end users):

| Command | Purpose |
|---------|---------|
| `ai-spector init` | Scaffold project |
| `ai-spector analyze` | Section tree in graph |
| `ai-spector graphify update` | Graphify code graph → `.ai-spector/.../graphify-out/` (sets `GRAPHIFY_OUT`) |
| `ai-spector graph merge --from-knowledge` | Domain nodes from staging |
| `ai-spector graph validate` | Rules check |
| `ai-spector graph visualize [--open]` | HTML report |
| `ai-spector graph query <id> --json` | Context for generation |
| `ai-spector graph impact <id> --json` | Regen scope |
| `ai-spector index` | Refresh graph + knowledge merge + Graphify + `.ai-spector/index/` (see flags below) |

**`ai-spector index` flags:** `--graph-only`, `--docs-only`, `--skip-graphify`, `--skip-docs`, `--skip-merge`, `--skip-validate`

Option: `-r <path>` to point at another project root.

---

## Publish to npm (maintainers)

```bash
npm run prepublish:check   # build + list tarball contents
npm login
npm publish
```

Replace `milky-way-66/ai-spector` in `package.json` (`repository`, `homepage`, `bugs`) before publishing. See [PUBLISHING.md](PUBLISHING.md).

---

## License

MIT — see [LICENSE](LICENSE).
