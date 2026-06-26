# AI Spector

Documentation workflow in **Cursor** or **Claude Code**: traceability graph, SRS, basic design, and UI prototypes (static HTML or SPA). **Describe what you need in chat** — the agent matches one of **4 skills**, reads its runbook, and runs `ai-spector` MCP tools. You rarely touch the terminal.

**Kari Writer** owns the `.docops/` contract only (no agent skills). ai-spector is an optional local tool that implements that contract via git files.

**Needs:** Node 20+, Git, [Cursor](https://cursor.com) and/or [Claude Code](https://docs.anthropic.com/en/docs/claude-code), Python 3.11+ *(optional — CocoIndex semantic search)*.

**Learn:** `npm run docs:dev` · [Course](website/docs/en/README.md) · Tiếng Việt: `/vi/docs/` · Offline: `npx ai-spector course serve --open`

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

- `.docops/` — Writer contract (`docops.config.json`, comments, review-queue, prototype metadata)
- `.ai-spector/` — engine store (`engine.json`, graph, registry, work sessions)
- `docs/data-source/`, `docs/srs/`, `docs/basic-design/`
- **Cursor:** `.cursor/` — **4 skills**, rules, `mcp.json`
- **Claude Code:** `CLAUDE.md` + `.claude/skills/` (4 skills) + `.mcp.json`
- Pre-commit hook (when git is available)

No `docflow.config.json` — fresh `init` writes the two-config model below.

### Configuration (2 files)

| File | Owner | Purpose |
|------|-------|---------|
| `.docops/docops.config.json` | **Writer contract** (shared) | Languages, doc layers, paths, **capabilities** |
| `.ai-spector/engine.json` | ai-spector engine (local only) | Graph/task artifact paths, readiness, CocoIndex, `scaffoldVersion` |

**Writer** defines the contract schema (`kari-writer/contracts/CONTRACT.md` in the docs-ops meta-repo). It ships **no agent skills**. **Capabilities** in `docops.config.json` gate Writer web UI, ai-spector CLI/MCP, skill install, and `check` rules.

**`.docops/guide/`** is for human tool authors only — agents and skills must **not** load or link to it at runtime.

**Docops CLI** (Writer contract bootstrap — no full ai-spector scaffold):

```bash
npx ai-spector docops status              # human-readable layout + readiness
npx ai-spector docops status --json       # machine-readable for agents

npx ai-spector docops init --lang en      # scaffold Writer-ready .docops/
npx ai-spector docops init --dry-run      # preview planned files
npx ai-spector docops init --force        # fill gaps when config already exists

npx ai-spector docops migrate --dry-run   # preview legacy → .docops/ migration
npx ai-spector docops migrate             # migrate layout + copy templates
npx ai-spector docops migrate --from-docflow   # split docflow.config.json → contract + engine
npx ai-spector docops migrate --templates-only   # copy templates only
npx ai-spector docops migrate --repair    # fill gaps without overwriting existing files
```

Upgrade from a legacy project that still has `docflow.config.json`:

```bash
npx ai-spector docops migrate --from-docflow
```

Then run `npx ai-spector upgrade apply` to sync the 4-skill scaffold. Full migration steps: [`kari-writer/contracts/MIGRATION.md`](../../kari-writer/contracts/MIGRATION.md) in the docs-ops meta-repo.

### Upgrade (guided workflow)

In chat: **"upgrade ai-spector"**

Or CLI:

```bash
npm install ai-spector@latest          # public npm; add --registry … for Verdaccio
npx ai-spector upgrade scan
npx ai-spector upgrade apply --auto
# complete manual steps from scan (MCP reload, enable skills, …)
npx ai-spector upgrade validate
```

The upgrade workflow scans a package checklist, syncs the **4-skill** scaffold, backfills config, and stamps `scaffoldVersion` in `engine.json` when complete.

Legacy skills-only refresh:

```bash
npx ai-spector sync-cursor             # Cursor → .cursor/skills/, .cursor/rules/
npx ai-spector sync-claude             # Claude Code → CLAUDE.md, .claude/skills/
```

Then **reload MCP** in your editor (`.cursor/mcp.json` or `.mcp.json`).

| Command | What it updates |
|---------|-----------------|
| `upgrade scan` | Detect stale scaffold + config drift; list checklist items |
| `upgrade apply` | Auto-fix scaffold sync, config backfill, hooks |
| `upgrade validate` | Verify checklist complete; stamp `scaffoldVersion` |
| `sync-cursor` | Cursor skills, routing rules, `WORKFLOW.md` under `.cursor/` |
| `sync-claude` | `CLAUDE.md`, Claude skills and rules under `.claude/` |

### Step 2 — Finish setup in chat

```text
setup ai-spector project
```

The agent installs the npm dependency (if needed), verifies the checklist, and reminds you of any manual steps.

### Step 3 — Enable the agent *(manual, one-time)*

Enable the **4 skills** (not the retired 23-skill bundle):

| Skill | Role |
|-------|------|
| `ai-spector` | Setup, upgrade, adopt, check, work sessions |
| `ai-spector-generate` | SRS, basic/detail design, prototype, template import |
| `ai-spector-graph` | Analyze, index, validate, impact, search, sync audit |
| `ai-spector-contract` | Review sign-off, comments, prototype comments, translation |

**Cursor:** Settings → Rules → **Agent Skills** — enable all four folders under `.cursor/skills/`. Reload MCP (`.cursor/mcp.json`).

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

After `init`, see `.cursor/WORKFLOW.md` (Cursor) or `CLAUDE.md` (Claude Code) for the 4-skill map.

### How chat routing works

| Piece | Role |
|-------|------|
| **Routing** | `_skill-router.md` + `ai-spector-routing.mdc` classify your message → one of 4 skills; `workflow_route` when ambiguous |
| **Skill** | One of four workflows (setup/work, generate, graph, contract) with a runbook under `references/` |

Say what you want in natural language — same in Cursor and Claude Code. The agent reads the matching skill and follows its runbook. If intent is unclear (especially **“approve”**), it asks once before acting.

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
| Pause / resume work | “active work”, “resume my SRS”, “pause work” |
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
npx ai-spector docops status            # assess .docops/ layout and Writer readiness
npx ai-spector docops init --lang en    # scaffold Writer-ready .docops/ contract
npx ai-spector docops migrate --from-docflow   # split legacy docflow.config.json
npx ai-spector work list                # active/paused work sessions (replaces task)
npx ai-spector work resume <workId>
npx ai-spector contract review queue    # sign-off queue (capability: review)
npx ai-spector contract comments inbox  # open comment threads (capability: comments)
npx ai-spector graph validate
npx ai-spector graph visualize --open
npx ai-spector graph impact --git
npx ai-spector sync audit --fail-on-drift   # CI: design-layer drift since baseline
npx ai-spector prototype validate --strict
```

MCP tools are grouped: `work_*` (session lifecycle), `contract_review` / `contract_comments` / `contract_prototype` / `contract_translate` (Writer contract ops). Legacy `task_*` and flat review/comments tools remain as deprecation wrappers for one release.

Full list: `npx ai-spector --help`.

---

## If something breaks

| Issue | Fix |
|-------|-----|
| MCP tools unavailable | Reload MCP; confirm `.cursor/mcp.json` or `.mcp.json` has `ai-spector` server |
| Setup incomplete | **“check ai-spector setup”** |
| Skills not routing (Cursor) | Re-enable all **4** skill folders under `.cursor/skills/` |
| Validate errors after edits | **“re-index the graph”** |
| Pre-commit hook missing | **“install ai-spector git hook”** |
| Agent stuck on CLI error | `.cursor/skills/ai-spector/references/cli-failures.md` |
| Stale skills after upgrade | [Upgrade (refresh skills & rules)](#upgrade-refresh-skills--rules) — `sync-cursor` / `sync-claude`, then reload MCP |

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

### Release (bump version & publish)

Version lives in `package.json`. Use the deploy script — it runs tests, optionally bumps semver, builds, and publishes.

**Public npm:**

```bash
npm run deploy:npm
```

**Internal Verdaccio** (copy `.env.example` → `.env` first):

```bash
npm run deploy
```

The script prompts to bump **patch** (default), **minor**, or **major**. Override with env vars:

| Variable | Effect |
|----------|--------|
| `BUMP=minor` | Bump minor instead of patch |
| `SKIP_BUMP=1` | Publish current `package.json` version as-is |
| `SKIP_TEST=1` | Skip `npm test` before publish |

**Manual bump only** (no publish):

```bash
npm version patch --no-git-tag-version   # or minor | major
```

`prepublishOnly` runs `npm run build` automatically before publish — fix build errors before retrying.

Publish is implemented in **`scripts/deploy.sh`** (`npm run deploy` / `npm run deploy:npm`). Edit that script for registry URLs, auth prompts, or bump behavior.

**Update scaffold bundles** (after editing `scaffold/cursor/`):

```bash
npm run build:claude-scaffold   # regenerate scaffold/claude/ from scaffold/cursor/
```

MIT — [LICENSE](LICENSE).
