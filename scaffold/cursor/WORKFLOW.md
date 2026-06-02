# AI Spector workflow

**You describe what you need in chat.** Cursor picks the right **skill**; the agent runs `ai-spector` CLI. You do not need to memorize command names.

Enable all skills under `.cursor/skills/` (see [skills/README.md](./skills/README.md)). On CLI or tool failure: agent pauses, shows output, and offers fix / workaround / pause — [cli-failures](./skills/ai-spector/references/cli-failures.md).

## One-time setup

```bash
npm install ai-spector
npx ai-spector init
```

Add files under `docs/data-source/`, open the project in Cursor, **reload MCP** (`.cursor/mcp.json`), enable **all ai-spector skills**.

## What to say → skill → agent does

| You want to… | Say (examples) | Skill | Agent runs (summary) |
|--------------|----------------|-------|----------------------|
| Ingest sources | “analyze my data source”, “build the knowledge graph” | `ai-spector-graph` | `analyze` → Graphify → merge knowledge → validate |
| Check graph | “validate the graph”, “graph errors” | `ai-spector-graph` | `graph validate` |
| Refresh after edits | “re-index”, “sync the graph” | `ai-spector-graph` | `ai-spector index` |
| Write SRS | “generate SRS”, “write use cases” | `ai-spector-generate-srs` | DAG waves → docs/srs → merge → index |
| Basic design | “screen list”, “API design”, “wireframes” | `ai-spector-generate-basic-design` | docs/basic-design → merge → index each wave |
| Detail design | “detail design for checkout” | `ai-spector-generate-detail-design` | docs/detail-design |
| HTML prototype | “HTML mockup”, “prototype with stripe theme” | `ai-spector-generate-prototype` | `prototype setup` → HTML → manifest → validate |
| What to redo | “what’s impacted”, “what should I regenerate” | `ai-spector-graph` | `graph impact` / git diff |
| Review comments | “resolve comments”, “fix C-001” | `ai-spector-resolve-comments` | inbox → plan → edit → commit |
| Explore graph | “show the graph” | `ai-spector-graph` | `graph visualize --open` |

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
| Analyze failed | Agent offers fix vs workaround; say **1** to retry or “analyze again” after fixing data-source / Graphify |
| Validate errors | “validate the graph” — agent explains each error |
| Empty SRS | “analyze” then “generate SRS” — not bulk-read all docs |
| Unsure what regen | “what’s the impact of my changes” |
| Comments incomplete | “resolve comments” — commit must include doc + `comments/` meta |

References: [cli-failures](./skills/ai-spector/references/cli-failures.md), [graph CLI](./skills/ai-spector/references/graph.md), [prerequisites](./skills/ai-spector/references/prerequisites.md).
