# ai-spector-graph

Browser SDK for ai-spector traceability graphs. **Read-only** — load JSON, query subgraphs, run impact analysis.

Your backend fetches repo files and returns JSON. Your frontend passes that JSON into this SDK.

## Install

```bash
npm install ai-spector-graph
```

## Quick start

```ts
import {
  GraphSession,
  parseImpactRules,
  DEFAULT_IMPACT_RULES,
} from "ai-spector-graph";

// 1. Fetch JSON from your API (FE responsibility)
const graph = await fetch("/api/files/traceability.graph.json").then((r) => r.json());
const rules = await fetch("/api/files/rules.impact.json").then((r) => r.json());

// 2. Build graph in memory
const session = GraphSession.fromJson(graph, {
  impactRules: parseImpactRules(rules),
  // or: impactRules: DEFAULT_IMPACT_RULES
});

// 3. Query & impact
const subgraph = session.query("UC-01", { depth: 2 });
const impact = session.impactFromNode("F-01", { change: "updated" });
const stats = session.stats();

// Low-level access
const neighbors = session.graph.neighbors("UC-01", "out");
```

## JSON files your API should serve

| Repo file | Purpose |
|-----------|---------|
| `.ai-spector/graph/traceability.graph.json` | **Required** — main graph |
| `schemas/rules.impact.json` | Impact analysis (or use `DEFAULT_IMPACT_RULES` from SDK) |

## API

### `GraphSession`

| Method | Description |
|--------|-------------|
| `GraphSession.fromJson(graph, { impactRules? })` | Build session from `TraceabilityGraph` JSON |
| `session.query(seedId, options?)` | Subgraph traversal |
| `session.impactFromNode(nodeId, { change? })` | Impact from node id |
| `session.impactFromOrigins(origins, { change? })` | Impact from resolved origins |
| `session.resolveOrigins({ id, file, heading, text })` | Resolve file/path/text → seed nodes |
| `session.stats()` | Node/edge counts by type |
| `session.graph` | `InMemoryGraph` instance |

### Lower-level exports

- `InMemoryGraph.from(data)`
- `querySubgraph`, `computeImpact`, `parseImpactRules`
- `expandPathTargetNodes` — synthetic file/source nodes for graph canvases

## No HTTP in this package

Fetch is your app's job. The SDK only accepts parsed JSON.
