# AI Spector

Documentation workflow in **Cursor** or **Claude Code**: traceability graph, SRS, basic design, and UI prototypes (static HTML or SPA). **Describe what you need in chat** — an orchestrator routes to specialized workers that run `ai-spector` MCP tools. You rarely touch the terminal.

**Needs:** Node 20+, Git, [Cursor](https://cursor.com) and/or [Claude Code](https://docs.anthropic.com/en/docs/claude-code), Python 3.11+ *(optional — CocoIndex semantic search)*.

**Learn:** `npx ai-spector course serve --open` · [Course](docs/course/README.md) *(13 lessons, ~10 min each)*

**Tiếng Việt:** [README.vi.md](README.vi.md)

---

## Setup (once)

### Prerequisites

| Requirement | Check |
|-------------|-------|
| Node.js ≥ 20 | `node --version` |
| Git repository | `git status` |
| Cursor and/or Claude Code | IDE open in project root |
| Python ≥ 3.11 *(optional)* | CocoIndex semantic search |

### Step 1 — Install & scaffold *(CLI)*

Run once at your project root. **Install the package first**, then run the init wizard.

**Internal registry** (Verdaccio — no `npm login` required):

```bash
npm install ai-spector --registry http://10.101.0.239:4873
npx ai-spector init
```

**Public npm:**

```bash
npm install ai-spector
npx ai-spector init
```

The init wizard prompts for editor (Cursor, Claude Code, or both), languages, git hook, and optional CocoIndex.

Creates:

- `.ai-spector/` — config, graph, templates
- `docs/data-source/`, `docs/srs/`, `docs/basic-design/`
- **Cursor:** `.cursor/` — skills, rules, `mcp.json`
- **Claude Code:** `CLAUDE.md` + `.claude/skills/` + `.mcp.json`
- Pre-commit hook (when git is available)

### Step 2 — Finish setup in chat

```text
setup ai-spector project
```

The agent installs the npm dependency (if needed), verifies the checklist, and reminds you of any manual steps.

### Step 3 — Enable the agent *(manual, one-time)*

**Cursor:** Settings → Rules → **Agent Skills** — enable **all** folders under `.cursor/skills/`. Reload MCP (`.cursor/mcp.json`).

**Claude Code:** Skills load from `.claude/skills/`. Reload MCP (`.mcp.json`).

### Step 4 — Add source material

Drop requirements into `docs/data-source/` (`.md`, `.txt`, `.pdf`).

### Step 5 — Start the pipeline

```text
analyze my data source
```

Continue in chat — see [Workflow](#workflow) below.

---

## Workflow

After `init`, see `.cursor/WORKFLOW.md` (Cursor) or `CLAUDE.md` (Claude Code) for the full skill map.

### How chat routing works

| Layer | Role |
|-------|------|
| **Orchestrator** | Classifies your message, asks clarifying questions, spawns a worker |
| **Worker** | One job (analyze, generate SRS, review docs, …) with a saved task state |

Say what you want in natural language — same in Cursor and Claude Code. If intent is unclear (especially **“approve”**), the agent asks once before acting.

### First run

```text
analyze the data source
validate the graph
generate the SRS
```

Generation is **gated**: workspace check → clarifying questions → plan table → your **yes, go ahead** → waves of writing → optional **SPEC-NNN** approval → index.

Then as needed:

```text
generate basic design
generate prototype
refresh the index
review documents
```

**Prototype** — static HTML (default) or SPA (React/Vue → `prototype/dist/`). Say **“generate prototype”** or **“generate prototype with Vue”**. For themes: **“help me pick a theme”** or **“prototype with stripe theme”**. SPA: run framework build, then `npx ai-spector prototype sync`.

### Day to day

| When | Say (examples) |
|------|----------------|
| New or changed sources | “analyze data source” |
| Check graph | “validate the graph”, “graph report” |
| Regenerate docs | “generate SRS”, “generate basic design” |
| Pause / resume work | “active tasks”, “resume my SRS”, “pause task” |
| One feature or section | “I want to add login with Google”, “update the auth section” |
| After doc edits | “refresh the index”, “re-index the graph” |
| Document sign-off | “review documents”, “approve srs/01-overview”, “what needs review” |
| Comment threads | “resolve comments”, “show open comments” |
| Impact / what to redo | “what’s the impact of my changes” |
| Prototype | “generate prototype”, “prototype with stripe theme” |
| Multi-language | “add language vi”, “resolve translations” — [course](docs/course/05-prototype/01-translations.md) |
| Custom templates | “set up template pack”, `generate <pack-name>` — [course](docs/course/07-advanced/01-custom-templates.md) |
| Semantic search *(CocoIndex)* | “find all mentions of rate limiting” |
| Explore graph | “show the graph”, `npx ai-spector graph visualize --open` |
| Check workspace | “check my workspace”, “why did pre-commit block me” |

### Typical path

```text
docs/data-source/  →  analyze  →  validate
  →  generate SRS (clarify → plan → waves → specs)  →  index
  →  basic design  →  prototype  →  review documents
```

---

## Optional — CocoIndex

Enables semantic search MCP tools (`docs_search`, `graph_query_fuzzy`). Requires Python ≥ 3.11.

```text
enable CocoIndex for this project
```

See [docs/setup-guide.md](docs/setup-guide.md) for Postgres / embedding options.

---

## CLI *(scripts & debugging)*

Most users stay in chat. Useful commands:

```bash
npx ai-spector course serve --open    # interactive course in browser
npx ai-spector setup --check
npx ai-spector graph validate
npx ai-spector graph visualize --open
npx ai-spector graph impact --git
npx ai-spector prototype validate --strict
```

Full list: `npx ai-spector --help`.

---

## If something breaks

| Issue | Fix |
|-------|-----|
| MCP tools unavailable | Reload MCP; confirm `.cursor/mcp.json` or `.mcp.json` has `ai-spector` server |
| Setup incomplete | **“check ai-spector setup”** |
| Skills not routing (Cursor) | Re-enable all folders under `.cursor/skills/` |
| Validate errors after edits | **“re-index the graph”** |
| Pre-commit hook missing | **“install ai-spector git hook”** |
| Agent stuck on CLI error | `.cursor/skills/ai-spector/references/cli-failures.md` |

After upgrading: reload MCP; in chat **“sync ai-spector cursor skills”** if scaffold skills changed.

---

## Node SDK

For scripts, CI, or custom backends:

- **[SDK guide](docs/plan/sdk.md)** — install, entry points, API reference

```bash
npm install ai-spector
```

```ts
import { runIndex, runGraphImpact, validateGraph } from "ai-spector";
```

---

## Web / graph SDK

For browser dashboards (read-only graph UI): npm package **`ai-spector-graph`**.

- **[Integration guide](docs/ai-spector-graph-integration-guide.md)**
- **[API reference](docs/ai-spector-graph.md)**

```bash
npm install ai-spector-graph
```

---

## Develop

```bash
npm install && npm run build && npm test
```

MIT — [LICENSE](LICENSE).
