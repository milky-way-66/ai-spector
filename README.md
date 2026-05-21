# ai-spector

**AI Spector** turns project inputs into structured documentation (SRS, basic design, detail design) inside [Cursor](https://cursor.com). One `npm install` gives you a CLI, templates, slash commands, and an agent skill.

The **traceability graph** (`.ai-spector/graph/traceability.graph.json`) is the heart of the system: it stores sections, use cases, features, and links. Generation and search go through **`ai-spector graph query`** — not by reading whole folders.

**Graphify** (optional MCP) only helps **extract** facts from `docs/data-source/` during `/analyze`. The **canonical store** is always our graph.

---

## 1. Overview

| You get | Purpose |
|---------|---------|
| **`ai-spector init`** | Project scaffold: `.ai-spector/`, `.cursor/commands`, skill, `docs/data-source/` |
| **Templates** | SRS, basic design, detail design (bundled in the package) |
| **`ai-spector analyze`** | Build section/document structure in the graph |
| **`/analyze` in Cursor** | Extract from inputs (Graphify) → merge into the graph |
| **`/generate-*` in Cursor** | Fill templates; agents use `graph query --json` for context |
| **`graph validate` / `query` / `impact`** | Validate, find relevant docs, scope regen after edits |

**In one sentence:** inputs → graph (truth) → generated markdown projections, with the IDE asking the CLI which parts of the graph matter for each step.

---

## 2. Getting started

### Requirements

- Node.js 20+
- [Cursor](https://cursor.com)
- Graphify MCP (for `/analyze` only)

### New project

```bash
npm install ai-spector
cd your-project
npx ai-spector init
```

| Step | What to do |
|------|------------|
| 1 | Add files under `docs/data-source/` |
| 2 | `npx ai-spector analyze` |
| 3 | Open in Cursor, enable **ai-spector** skill |
| 4 | Run **`/analyze`** (merge knowledge into the graph) |
| 5 | `npx ai-spector graph validate` |
| 6 | **`/validate-graph`** then **`/generate-srs`** |
| 7 | Optional: `/index-docs srs`, `/generate-basic-design`, `/generate-detail-design` |

Agents should run `npx ai-spector graph query <id> --json` during generate steps and use only `projectionPaths` from the output.

### Try `example/` in this repo

```bash
git clone <repo-url>
cd ai-spector
npm install
npm run build
npm run init:example
npm run analyze
npm run graph:validate
```

Open **`example/`** as the Cursor workspace (not the repo root). Add samples under `example/docs/data-source/`, then run `/analyze` → `/validate-graph` → `/generate-srs`.

From repo root:

```bash
npx ai-spector -r example graph query sec.srs.3-use-cases.l3.3.32-list-use-case --json
```

See [example/README.md](example/README.md).

---

## 3. How it works (detail)

### 3.1 Components

| Component | Role |
|-----------|------|
| **CLI (`ai-spector`)** | `init`, `analyze`, `graph validate`, `graph query`, `graph impact` |
| **Traceability graph** | JSON graph: `document`, `section`, `useCase`, `feature`, edges |
| **Cursor commands + skill** | `/analyze`, `/generate-srs`, … — must call CLI for graph operations |
| **Templates** | `node_modules/ai-spector/templates/` — section patterns for generated docs |

### 3.2 Graphify vs our graph

| | Graphify (MCP) | Our graph |
|---|----------------|-----------|
| **When** | `/analyze` on raw inputs | `ai-spector analyze` + merge after `/analyze` + all generate/impact |
| **Role** | Ingest helper (search, extract) | **Source of truth** |
| **On disk** | `knowledge.json` (staging) | `traceability.graph.json` |
| **Generation** | Not used | `graph query` / `graph impact` |

### 3.3 Data flow

```text
docs/data-source/
        │
        ▼
/analyze + Graphify          → knowledge.json (staging)
        │
        ▼ merge
traceability.graph.json      ← OUR graph
        ▲
        │ ai-spector analyze   (section tree from templates)
        │
        ├── graph query --json
        ├── graph impact --json
        └── /generate-*  →  docs/srs/, docs/basic-design/, …
```

- **Sections** — template headings (`##`, `###`) are nodes with `partOf` / `contains`.
- **Domain nodes** — `useCase`, `feature`, … with `listedIn`, `satisfies`, `definedIn`, …
- **Markdown under `docs/`** — projections from the graph, not the canonical store.

### 3.4 Full pipeline

```text
ai-spector init
→ add docs/data-source/
→ ai-spector analyze              (graph structure)
→ /analyze                        (extract → knowledge.json)
→ ai-spector graph merge --from-knowledge
→ ai-spector graph validate
→ /generate-srs                   (graph query per target)
→ /index-docs srs                 (optional)
→ /generate-basic-design
→ /graph-impact after edits       (graph impact --json)
```

Cursor contract (see `.cursor/commands/_graph.md` after `init`):

```bash
ai-spector graph merge --from-knowledge
ai-spector graph validate
ai-spector graph query <seedId> --json
ai-spector graph impact <nodeId> --json
```

### 3.5 Project layout

```text
your-project/
  .cursor/commands/           # slash commands
  .cursor/skills/ai-spector/
  .ai-spector/
    docflow.config.json
    graph/traceability.graph.json
    registry/section-registry.json
    .docflow/analysis/          # knowledge.json, gaps.json
    .docflow/extract/           # patch.json (optional; from merge --write-patch)
    .docflow/config/            # DAGs, prerequisites
    index/                      # optional
  docs/
    data-source/                # inputs
    srs/                          # generated
    basic-design/
    detail-design/
```

### 3.6 CLI reference

| Command | Description |
|---------|-------------|
| `ai-spector init [--force]` | Scaffold project |
| `ai-spector analyze` | Registry + bootstrap graph structure |
| `ai-spector graph validate` | Schema + traceability rules |
| `ai-spector graph query <id> --json` | Neighbors + `projectionPaths` |
| `ai-spector graph impact <id> --json` | Regen / review / downstream |
| `ai-spector graph registry` | Rebuild section registry |
| `ai-spector graph bootstrap` | Rebuild structure from registry |

Option: `-r, --root <path>` to target a project directory.

### 3.7 npm package contents

| Path | Contents |
|------|----------|
| `dist/` | CLI |
| `templates/` | SRS, basic_design, detail_design |
| `schemas/` | Graph schema + rules |
| `documents.json` | SRS manifest |
| `scaffold/` | Copied on `init` |

### 3.8 Design docs & development

| Doc | Topic |
|-----|--------|
| [workflow-overview.md](docs/design/workflow-overview.md) | Graph-centric workflow |
| [traceability-graph-redesign.md](docs/design/traceability-graph-redesign.md) | Schema, migration phases |

**Hack on this repo:**

```bash
npm install && npm run build
npm run init:example && npm run analyze && npm run graph:validate
```

---

## License

MIT — see [LICENSE](LICENSE).
