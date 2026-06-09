# AI Spector workflow

**You describe what you need in chat.** Cursor picks the right **skill**; the agent calls **MCP tools** (when `ai-spector` server is configured) or falls back to **`npx ai-spector`** CLI. You do not need to memorize command names.

Enable all skills under `.cursor/skills/` (see [skills/README.md](./skills/README.md)). On CLI or tool failure: agent pauses, shows output, and offers fix / workaround / pause — [cli-failures](./skills/ai-spector/references/cli-failures.md).

## One-time setup

**In chat (easiest):** say **"setup ai-spector project"** — agent uses `ai-spector-setup` skill.

**CLI (guided):**

```bash
npm install -D ai-spector
npx ai-spector setup              # interactive wizard
npx ai-spector setup -y -l en,jp  # non-interactive
npx ai-spector setup --check      # audit only
```

Then: add files under `docs/data-source/`, enable **all** skills under `.cursor/skills/`, reload MCP.

## What to say → skill → agent does

| You want to… | Say (examples) | Skill | Agent runs (MCP preferred) |
|--------------|----------------|-------|---------------------------|
| **Setup project** | “setup ai-spector”, “initialize project”, “get started” | `ai-spector-setup` | `setup --check` → `setup -y` → enable skills checklist |
| Ingest sources | “analyze my data source”, “build the knowledge graph” | `ai-spector-graph` | `analyze({})` → agent extracts → `knowledge_validate` → `graph_merge` → `graph_validate` |
| Check graph health | “validate the graph”, “graph errors”, “graph report” | `ai-spector-graph` | `graph_validate({})` · `graph_report({})` |
| Refresh after edits | “re-index”, “sync the graph” | `ai-spector-graph` | `index({ cocoindexSync: true })` (or `index({})` if no CocoIndex) |
| Write SRS | “generate SRS”, “write use cases” | `ai-spector-generate-srs` | DAG waves → docs/srs → `graph_merge` → `index({ cocoindexSync: true })` |
| Basic design | “screen list”, “API design”, “wireframes” | `ai-spector-generate-basic-design` | docs/basic-design → `graph_merge` → `index({ cocoindexSync: true })` each wave |
| Detail design | “detail design for checkout” | `ai-spector-generate-detail-design` | docs/detail-design |
| HTML prototype | “HTML mockup”, “prototype with stripe theme” | `ai-spector-generate-prototype` | auth picker (if needed) → theme picker → setup → HTML → validate |
| Pick / preview UI theme | “help me pick a theme”, “show me themes” | `ai-spector-generate-prototype` | read project context → recommend 3 → `prototype preview` ×3 |
| What to redo | “what’s impacted”, “what should I regenerate” | `ai-spector-graph` | `graph_impact({ git: true, change: “…” })` — includes `semanticSuggestions` when CocoIndex ready |
| Find docs by concept | “find all mentions of rate limiting”, “which docs describe login?” | `ai-spector-search` | `docs_search({ query })` MCP |
| Find graph node by name | “show graph for user login” (node ID unknown) | `ai-spector-search` | `graph_query_fuzzy({ query })` MCP |
| Translation status | “what’s stale in JP”, “pending translations” | `ai-spector-lang-status` | `lang_queue({})` MCP |
| Sync translations | “resolve translations”, “update JP from EN” | `ai-spector-resolve-translation` | read queue → translate → `index({ cocoindexSync: true })` |
| Review comments | “resolve comments”, “fix C-001” | `ai-spector-resolve-comments` | inbox → plan → edit → commit |
| Explore graph | “show the graph” | `ai-spector-graph` | `npx ai-spector graph visualize --open` (no MCP equivalent) |

Unsure? The agent uses [skills/_skill-router.md](./skills/_skill-router.md) or asks one clarifying question.

## Typical first run

```text
npx ai-spector init
docs/data-source/     ← your inputs
“analyze the data source”
“validate the graph”
“generate the SRS”
“refresh the index”
```

## Pipeline order

```text
analyze → validate graph → generate SRS → index
  → generate basic design → index
  → generate detail design
  → prototype setup + generate HTML screens
```

## If something fails

| Symptom | What to say / do |
|---------|------------------|
| Analyze failed | Agent offers fix vs workaround; say **1** to retry or “analyze again” after fixing data-source |
| Validate errors | “validate the graph” — agent explains each error |
| Empty SRS | “analyze” then “generate SRS” — not bulk-read all docs |
| Unsure what regen | “what’s the impact of my changes” |
| Comments incomplete | “resolve comments” — commit must include doc + `comments/` meta |

References: [cli-failures](./skills/ai-spector/references/cli-failures.md), [graph CLI](./skills/ai-spector/references/graph.md), [prerequisites](./skills/ai-spector/references/prerequisites.md).
