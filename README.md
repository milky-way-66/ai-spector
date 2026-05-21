# AI Spector

Turn project notes and specs into structured documentation (SRS, basic design, detail design) inside [Cursor](https://cursor.com).

You work with **slash commands**. The AI runs the `ai-spector` CLI behind the scenes. You only use the terminal once: **`npx ai-spector init`**.

Release history: [CHANGELOG.md](CHANGELOG.md).

---

## How you work (Cursor-first)

### Once per project

```bash
npm install ai-spector
npx ai-spector init
```

Put your source files in `docs/data-source/`, open the folder in Cursor, turn on the **ai-spector** skill, and **reload MCP** (init writes `.cursor/mcp.json` for Graphify).

**Graphify requires:** [uv](https://docs.astral.sh/uv/) installed; package `graphifyy` is pulled via `uv tool run` on first MCP start.

### Slash commands

| You run | What happens |
|---------|----------------|
| **`/analyze`** | Graph skeleton, Graphify extract → `knowledge.json`, merge domain nodes, validate |
| **`/validate-graph`** | Checks the graph before generation |
| **`/generate-srs`** | SRS by DAG waves — graph-first context, `rendersTo` + `dependsOn` on output |
| **`/generate-basic-design`** | Basic design from graph + SRS (same targeting/waves pattern) |
| **`/generate-detail-design`** | Detail design from the graph |
| **`/index`** | Full refresh: registry/bootstrap, knowledge merge, **UC/F from markdown**, Graphify on changed paths, validate, doc indexes — run after **`/generate-srs`** |
| **`/summary`** | Optional searchable summaries under `.ai-spector/index/` only (not a full graph refresh) |
| **`/impact`** [what changed] | Regen scope from **your description**, git diff, selection, or path — agent resolves seeds (no node id required) |
| **`/visualize-graph`** | Browser report: graph, knowledge, detail docs, sections, **`rendersTo`** to file paths |

**Typical path:**

```text
npx ai-spector init
→ add docs/data-source/
→ /analyze
→ /validate-graph
→ /generate-srs
→ /index
```

Command details live in `.cursor/commands/` after `init` — start with `_workflow.md`. Deeper guides: `index.md`, `summary.md`, `impact.md`, `analyze.md`.

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
- Originating inputs under `docs/data-source/` → **`derivedFrom`** to repo-relative paths (and `graphify:<id>` when Graphify index matches)  
- Generated markdown under `docs/srs/`, `docs/basic-design/`, etc. → linked by **`rendersTo`** (target is the **repo-relative file path**, not a node id)  
- Per-UC / per-feature **detail files** → instance `document` nodes (`doc.srs.uc-UC-01`, …), **section** nodes with titles/snippets from generated markdown, **`definedIn`** / **`describedIn`** from domain nodes to those sections  

**`/index`** (or `ai-spector index`) parses UC/F/actor ids from SRS and basic-design bodies and wires detail semantics without a full **`/analyze`**. **`/analyze`** is still required for rich Graphify MCP extract into `knowledge.json`.

**Graphify** (optional MCP) helps read `docs/data-source/` during **`/analyze`**. The graph remains canonical.

---

## Requirements

- Node.js 20+
- [Cursor](https://cursor.com)
- Graphify MCP for **`/analyze`** (optional for **`/index`** with `--skip-graphify`)

---

## Try the example in this repo

For package developers:

```bash
git clone <repo-url>
cd ai-spector
npm install && npm run build
npm run init:example
```

Open **`example/`** as the Cursor workspace, add files under `example/docs/data-source/`, then run **`/analyze`** → **`/generate-srs`** → **`/index`**.

See [example/README.md](example/README.md).

---

## Project layout (after init)

```text
your-project/
  .cursor/commands/          # /analyze, /index, /impact, …
  .cursor/skills/ai-spector/
  .ai-spector/
    graph/traceability.graph.json
    .docflow/analysis/knowledge.json
    index/                     # optional summaries (/summary)
    views/graph-knowledge.html   # after /visualize-graph
  docs/
    data-source/                 # your inputs
    srs/                         # generated (+ per-UC/F detail files)
    basic-design/
```

---

## Troubleshooting

| Symptom | What to try |
|---------|-------------|
| CLI error during a slash command | Read agent **Blocked** message; fix cause; re-run the **same** command — see `_cli-failures.md` |
| Validate fails on `rendersTo` | Ensure each generated doc has `rendersTo` from its template `doc.*` node to the real file path; run **`/index`** after **`/generate-srs`** |
| Stale UC/F or detail sections | **`/index`** (body extract + section `definedIn`); full knowledge refresh needs **`/analyze`** |
| Unsure what to regenerate | **`/impact`** (empty = git diff), or describe the change in plain language |
| Graphify unavailable | `ai-spector index --skip-graphify` |

---

## For developers & contributors

The CLI is the engine; Cursor commands wrap it.

| Doc | Topic |
|-----|--------|
| [workflow-overview.md](docs/design/workflow-overview.md) | Graph-centric design |
| [traceability-graph-redesign.md](docs/design/traceability-graph-redesign.md) | Schema and roadmap |
| [testing.md](docs/testing.md) | Vitest, `tests/` layout, `npm test`, mocking |

**Tests:** [Vitest](https://vitest.dev/) — mirror `src/` under `tests/` (e.g. `tests/graph/InMemoryGraph.test.ts`). Do not colocate tests in `src/`.

```bash
npm install && npm run build
npm test              # vitest run
npm run test:watch    # during development
npm run init:example
```

**CLI reference** (normally invoked by agents, not end users):

| Command | Purpose |
|---------|---------|
| `ai-spector init` | Scaffold project |
| `ai-spector analyze` | Section tree in graph (`--merge` if knowledge present) |
| `ai-spector index` | Graph bootstrap, knowledge merge, doc semantics, Graphify, validate, doc indexes |
| `ai-spector graphify update` | Graphify code graph → `.ai-spector/.../graphify-out/` |
| `ai-spector graph merge --from-knowledge` | Domain nodes from staging |
| `ai-spector graph validate` | Schema + rules (`rendersTo` may target file paths) |
| `ai-spector graph visualize [--open]` | HTML report (detail docs, sections, `rendersTo` edges) |
| `ai-spector graph query <id> --json` | Context for generation |
| `ai-spector graph impact` | Regen scope — `<id>` optional with `--file`, `--heading`, or `--git` |

**`ai-spector index` flags:** `--graph-only`, `--docs-only`, `--skip-graphify`, `--skip-docs`, `--skip-merge`, `--skip-doc-semantics`, `--force-graphify`, `--skip-validate`

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
