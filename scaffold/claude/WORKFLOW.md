# AI Spector workflow

**You describe what you need in chat.** Claude Code picks the right **skill**; the agent calls **MCP tools** (when `ai-spector` server is configured) or falls back to **`npx ai-spector`** CLI.

Skills load from `.claude/skills/` (see [.claude/skills/README.md](./.claude/skills/README.md)). On CLI or tool failure: agent pauses, shows output, and offers fix / workaround / pause — [cli-failures](./.claude/skills/ai-spector/references/cli-failures.md).

### When routing picks the wrong workflow

Say a **workflow trigger** — it **overrides** skill matching for that turn. See [.claude/workflows/README.md](./.claude/workflows/README.md).

| Wrong route? | Say |
|--------------|-----|
| "generate detail design" → resolve-task | `workflow: generate-detail-design` |
| incremental add → generate | `workflow: resolve-task` |
| document sign-off → task approve | `workflow: review` |
| resume stuck task | `workflow: task` |


## One-time setup

**In chat (easiest):** say **"setup ai-spector project"** — agent uses `ai-spector-setup` skill.

**CLI (guided):**

```bash
npm install -D ai-spector
npx ai-spector setup              # interactive wizard
npx ai-spector setup -y -l en,jp  # non-interactive
npx ai-spector setup --check      # audit only
```

Then: add files under `docs/data-source/`, enable **all** skills under `.claude/skills/`, reload MCP.

> **After upgrading ai-spector** (`npm install -D ai-spector@latest`): reload the MCP server in Cursor (Cmd+Shift+P → "Reload MCP Servers") so new tools are picked up. The server logs its version and tool count to stderr on startup — check Cursor's MCP output panel if a tool is missing.

## What to say → skill → agent does

| You want to… | Say (examples) | Skill | Agent runs (MCP preferred) |
|--------------|----------------|-------|---------------------------|
| **Learn / open course** | "open the course", "learn ai-spector" | `ai-spector-course` | `course serve --open` → link lesson |
| **Setup project** | "setup ai-spector", "initialize project", "bootstrap project" | `ai-spector-setup` | `setup --check` → `setup -y` → enable skills checklist |
| **Check workspace** | "check my workspace", "why did pre-commit block me", "stale clarifications" | `ai-spector-check` | `workspace_check({})` → findings table → optional `fix: true` |
| **Resume / manage tasks** | "resume my SRS", "continue generation", "active tasks", "pause task" | `ai-spector-task` | `task_list` → `task_resume` / `task_get` → route to generate or resolve skill |
| Ingest sources | "analyze my data source", "build the knowledge graph" | `ai-spector-graph` | `index({})` → agent extracts → `knowledge_validate` → `graph_merge` → `graph_validate` |
| Check graph health | "validate the graph", "graph errors", "graph report" | `ai-spector-graph` | `graph_validate({})` · `graph_report({})` |
| Refresh after edits | "re-index", "sync the graph" | `ai-spector-graph` | `index({ cocoindexSync: true })` (or `index({})` if no CocoIndex) |
| Write SRS | "generate SRS", "write use cases" | `ai-spector-generate-srs` | `task_create` → **gated**: check → clarify → briefing + plan → `task_approve_plan` → `task_record_wave` per wave → `spec_record` → `task_complete` |
| Basic design | "screen list", "API design", "wireframes" | `ai-spector-generate-basic-design` | same task-state flow → docs/basic-design → index each wave |
| Detail design | "generate detail design", "I want to generate detail design", "feature-level design" | `ai-spector-generate-detail-design` | **gated generate**: check → clarify → briefing → plan → `task_approve_plan` → waves → index each wave |
| Review extracted specs | "pending specs", "approve SPEC-001" | (generate skills, stage 6) | `spec_list` → `spec_approve` (merges to graph) / `spec_reject` |
| Answer clarifications | "open questions", "what did I answer about auth" | `ai-spector-check` | `context_list` → `context_resolve` |
| HTML prototype | "HTML mockup", "prototype with stripe theme" | `ai-spector-generate-prototype` | auth picker (if needed) → theme picker → setup → HTML → validate |
| Pick / preview UI theme | "help me pick a theme", "show me themes" | `ai-spector-generate-prototype` | read project context → recommend 3 → `prototype preview` ×3 |
| What to redo | "what's impacted", "what should I regenerate" | `ai-spector-graph` | `graph_impact({ git: true, change: "…" })` — includes `semanticSuggestions` when CocoIndex ready |
| Find docs by concept | "find all mentions of rate limiting", "which docs describe login?" | `ai-spector-search` | `docs_search({ query })` MCP |
| Find graph node by name | "show graph for user login" (node ID unknown) | `ai-spector-search` | `graph_query_fuzzy({ query })` MCP |
| Translation status | "what's stale in JP", "pending translations" | `ai-spector-lang-status` | `lang_queue({})` MCP |
| Sync translations | "resolve translations", "update JP from EN" | `ai-spector-resolve-translation` | read queue → translate → `index({ cocoindexSync: true })` |
| Review comments | "resolve comments", "fix C-001" | `ai-spector-resolve-comments` | inbox → plan → edit → commit |
| **Review documents** | "review docs", "approve SRS", "approve srs/01-overview", "approve detail-design/feature-list", "pending review", "what changed since approval" | `ai-spector-review` | `review_check` → queue → pick → `review_status` (readiness + quorum + custom checklists) → read doc → graph_impact → **write review** → user decision → `review_approve` / `review_decline` / `review_close` / `review_reject` |
| Add/update one feature or section | "I want to add login with Google", "add requirement", "update auth section" | `ai-spector-resolve-task` | tier confirm → clarify → (design/briefing by tier) → plan → `task_approve_plan` → execute → verify → `task_complete` |
| Explore graph | "show the graph" | `ai-spector-graph` | `npx ai-spector graph visualize --open` (no MCP equivalent) |

Unsure? Say **"help me approve"** or call **`workflow_route`** — the agent uses [skills/_skill-router.md](./skills/_skill-router.md) or asks one clarifying question.

### "Approve" disambiguation

When intent is unclear, the agent asks:

```
Which did you mean?
1. Sign off a document (e.g. srs/01-overview) — formal approval
2. Approve an extracted spec (e.g. SPEC-003) — after generation
3. Go ahead with the plan we discussed — start making changes
4. Mark a comment thread done (e.g. C-012) — feedback addressed
```

| You mean… | Say… | Tool |
|-----------|------|------|
| Sign off a document | "approve srs/01-overview", "review documents" | `review_approve` via `ai-spector-review` |
| Approve extracted spec | "approve SPEC-001" | `spec_approve` |
| Approve plan to execute | "yes, go ahead" (after plan table) | `task_approve_plan` |
| Mark comment thread done | "resolve C-012" | `comments_resolve` |

Full plan: [../../docs/review-routing-impl-plan.md](../../docs/review-routing-impl-plan.md).

## Typical first run

```text
npx ai-spector init
docs/data-source/     ← your inputs
"analyze the data source"
"validate the graph"
"generate the SRS"
"refresh the index"
```

## Pipeline order

```text
analyze → validate graph
  → generate SRS         (gated: check → clarify → briefing → plan → waves → extract)
  → index → spec review  (approve → graph merge)
  → generate basic design (same gates) → index
  → generate detail design (same gates) → index each wave
  → prototype setup + generate HTML screens
```

**Every generate run is human-in-the-loop:** the agent checks the workspace,
asks about *all* missing information (answers are stored and re-used across
sessions), shows you exactly which sources and key points will shape each
document, and waits for your explicit yes before writing anything. Afterwards it
offers extracted key specs for review — only approved specs reach the graph, and
`docs/data-source/` always stays purely yours.

## If something fails

| Symptom | What to say / do |
|---------|------------------|
| Analyze failed | Agent offers fix vs workaround; say **1** to retry or "analyze again" after fixing data-source |
| Validate errors | "validate the graph" — agent explains each error |
| Empty SRS | "analyze" then "generate SRS" — not bulk-read all docs |
| Unsure what regen | "what's the impact of my changes" |
| Comments incomplete | "resolve comments" — commit must include doc + `comments/` meta |

References: [cli-failures](./.claude/skills/ai-spector/references/cli-failures.md), [graph CLI](./skills/ai-spector/references/graph.md), [prerequisites](./skills/ai-spector/references/prerequisites.md). Web UI handover for browsing detail design: [../docs/plan/detail-design-web-handover.md](../docs/plan/detail-design-web-handover.md).
