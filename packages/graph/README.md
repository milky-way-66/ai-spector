# ai-spector-graph

Browser SDK for ai-spector traceability graphs. **Read-only** — load JSON, query subgraphs, run impact analysis.

Your backend fetches repo files and returns JSON. Your frontend passes that JSON into this SDK.

## Install

```bash
npm install ai-spector-graph
```

## Quick start

```ts
import { ProjectSession, parseImpactRules, DEFAULT_IMPACT_RULES } from "ai-spector-graph";

// 1. Fetch JSON from your API
const [graph, knowledge, registry] = await Promise.all([
  fetch("/api/files/traceability.graph.json").then((r) => r.json()),
  fetch("/api/files/knowledge.json").then((r) => (r.ok ? r.json() : null)),
  fetch("/api/files/section-registry.json").then((r) => (r.ok ? r.json() : null)),
]);

// 2. Build project session
const project = ProjectSession.fromBundle({
  graph,
  knowledge,
  registry,
  impactRules: DEFAULT_IMPACT_RULES,
});

// 3. Graph + knowledge + labels
project.graph.query("UC-01", { depth: 2 });
project.knowledgeCoverage();           // in-graph ✓/✗ per analyze row
project.sectionLabel("sec.srs.en.02"); // "2. Actors"
```

## Documentation

| Guide | Description |
|-------|-------------|
| **[Integration guide](../../docs/ai-spector-graph-integration-guide.md)** | **Start here** — backend API, React setup, recipes, checklist |
| [API reference](../../docs/ai-spector-graph.md) | `GraphSession` / `ProjectSession` methods |
| [Expansion roadmap](../../docs/ai-spector-graph-expansion.md) | Future data sources |

## JSON files your API should serve

| Repo file | Purpose |
|-----------|---------|
| `.ai-spector/graph/traceability.graph.json` | **Required** — main graph |
| `schemas/rules.impact.json` | Impact analysis (or use `DEFAULT_IMPACT_RULES`) |
| `.ai-spector/.docflow/analysis/knowledge.json` | Optional — analyze stats + in-graph coverage |
| `.ai-spector/registry/section-registry.json` | Optional — section headings for UI |
| `.ai-spector/docflow.config.json` | Optional — languages |
| `.ai-spector/.docflow/state.json` | Optional — index/merge timestamps |
| `.ai-spector/.docflow/translation-queue/pending.json` | Optional — translation dashboard |

## No HTTP in this package

Fetch is your app's job. The SDK only accepts parsed JSON.
