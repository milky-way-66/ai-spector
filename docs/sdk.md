# ai-spector Node SDK

Programmatic access to the same typed operations used by the CLI and MCP server. Use the SDK when you want to automate indexing, graph queries, impact analysis, or comment workflows from Node scripts, CI jobs, or custom backends.

**Requirements:** Node.js ≥ 20. CocoIndex helpers additionally need Python ≥ 3.11 when semantic search is enabled.

---

## Install

`ai-spector` is published to **npm** and the internal **Verdaccio** registry (`http://10.101.0.239:4873`).

**npm (default registry):**

```bash
npm install ai-spector
```

**Internal registry:**

```bash
npm install ai-spector --registry http://10.101.0.239:4873
```

---

## Entry points

| Import | Use for |
|--------|---------|
| `ai-spector` | Full SDK — graph sessions, `run*` operations, CocoIndex, comments |
| `ai-spector/graph` | Pure graph algorithms only (no filesystem I/O) — browser-safe subset |
| `ai-spector/mcp` | MCP server entry (`ai-spector-mcp` bin) |
| `ai-spector/cli` | CLI entry (`ai-spector` bin) |

The main SDK re-exports graph primitives plus file-backed operations. Prefer `ai-spector/graph` in bundlers that must not pull Node built-ins.

---

## Design

- Every `run*` function accepts typed options and returns a typed result — no `console.log`, no formatted strings.
- File-backed operations resolve paths from `root` (defaults to `process.cwd()`) via `.ai-spector/` layout, same as the CLI.
- In-memory helpers (`GraphSession`, `ProjectSession`, `querySubgraph`, `computeImpact`) accept JSON you already loaded — useful when your API serves graph data to a frontend.

Errors are thrown as standard `Error` objects with actionable messages (same text the CLI surfaces).

---

## Quick start

### Re-index a project

```ts
import { runIndex } from "ai-spector";

const report = await runIndex({ root: "/path/to/project" });

if (report.failed) {
  const failed = report.steps.filter((s) => s.status === "failed");
  throw new Error(`Index failed: ${failed.map((s) => s.id).join(", ")}`);
}

console.log(report.steps.map((s) => `${s.id}: ${s.status}`));
```

### Validate the traceability graph

```ts
import { validateGraph } from "ai-spector";

const issues = await validateGraph({
  graphPath: ".ai-spector/traceability.graph.json",
  schemaPath: "node_modules/ai-spector/schemas/traceability.graph.schema.json",
  registryPath: ".ai-spector/section-registry.json",
  rulesPath: ".ai-spector/rules/impact.json",
});

const errors = issues.filter((i) => i.severity === "error");
if (errors.length > 0) {
  console.error(errors);
  process.exit(1);
}
```

### Query a subgraph

```ts
import { runGraphQuery } from "ai-spector";

const subgraph = await runGraphQuery({
  graphPath: ".ai-spector/traceability.graph.json",
  seedId: "UC-01",
  direction: "both",
  depth: 2,
});

console.log(subgraph.nodes.length, subgraph.edges.length);
```

### Impact analysis from git changes

```ts
import { runGraphImpact } from "ai-spector";

const impact = await runGraphImpact({
  projectRoot: process.cwd(),
  graphPath: ".ai-spector/traceability.graph.json",
  rulesPath: ".ai-spector/rules/impact.json",
  git: true,
  change: "edited requirements",
});

for (const entry of impact.regenerate) {
  console.log("regenerate:", entry.id, entry.projectionPath);
}
for (const entry of impact.review) {
  console.log("review:", entry.id);
}
```

---

## In-memory graph sessions

When you already have JSON (e.g. from an HTTP API), use sessions instead of path-based `run*` helpers.

### `GraphSession`

```ts
import { GraphSession, DEFAULT_IMPACT_RULES } from "ai-spector";
import graphJson from "./traceability.graph.json" with { type: "json" };

const session = GraphSession.fromJson(graphJson, {
  impactRules: DEFAULT_IMPACT_RULES,
});

const stats = session.stats();
const subgraph = session.query("UC-01", { direction: "out", depth: 3 });
const impact = session.impactFromNode("UC-01", { change: "title updated" });
```

### `ProjectSession`

Bundles graph + optional knowledge, section registry, config, state, and translation queue — same shape a dashboard backend would fetch.

```ts
import { ProjectSession } from "ai-spector";

const project = ProjectSession.fromBundle({
  graph: graphJson,
  knowledge: knowledgeJson,
  registry: registryJson,
});

console.log(project.knowledgeStats());
console.log(project.knowledgeCoverage());
console.log(project.sectionLabel("sec.use-cases"));
console.log(project.healthSummary());
```

See also the browser-focused **`ai-spector-graph`** package if you only need read-only visualization in the frontend.

---

## API reference

### Graph primitives

| Export | Description |
|--------|-------------|
| `querySubgraph(graph, seedId, options?)` | BFS subgraph from a seed node |
| `computeImpact(graph, originId, change, rules)` | Formal impact buckets (`regenerate`, `review`) |
| `parseImpactRules(data)` | Parse `impact.json` rules file |
| `DEFAULT_IMPACT_RULES` | Built-in default rules object |
| `auditGraphLayers(graph, options?)` | Tri-layer coverage audit |
| `knowledgeGraphCoverage(graph, knowledge)` | Knowledge ↔ graph coverage report |
| `computeKnowledgeStats(knowledge)` | Count actors, use cases, features, etc. |
| `expandPathTargetNodes(graph, options?)` | Expand path/file nodes for visualization |

**Types:** `GraphQueryResult`, `ImpactResult`, `ImpactRulesFile`, `LayerAuditReport`, `KnowledgeCoverageReport`, `AnalysisKnowledge`, `ResolvedOrigin`, `GraphSessionOptions`, `ProjectSessionOptions`, `ProjectBundle`

### Graph operations (filesystem)

| Function | Returns | Notes |
|----------|---------|-------|
| `validateGraph(opts)` | `ValidationIssue[]` | Schema + structural validation |
| `runGraphMerge(opts)` | `GraphMergeResult` | Apply extract/knowledge patch |
| `runGraphQuery(opts)` | `GraphQueryResult` | Load graph from disk, then query |
| `runGraphImpact(opts)` | `GraphImpactResult` | Impact from node id, file/heading, or `--git` |
| `runGraphImpactFromGit(graph, opts)` | `GraphImpactResult` | Git diff seeds when graph is already loaded |

**`GraphMergeOptions` highlights:** `root`, `fromKnowledge`, `semantic`, `withKnowledge`, `dryRun`, `validate`

**`GraphImpactCliOptions` highlights:** `projectRoot`, `graphPath`, `rulesPath`, `originId`, `file`, `heading`, `git`, `change`, `output`

`GraphImpactResult` extends `ImpactResult` with optional `semanticSuggestions` when CocoIndex is configured.

### Index

```ts
const report = await runIndex({
  root: "/path/to/project",
  graphOnly: false,      // skip doc indexing
  docsOnly: false,       // skip graph steps
  skipMerge: false,
  skipValidate: false,
  cocoindexSync: false,  // trigger CocoIndex re-index when configured
});
```

**`IndexReport`:** `{ steps: IndexStepResult[]; failed: boolean; cocoindexUpdated?; cocoindexSkipped? }`

Each step has `id`, `label`, `status` (`ok` | `skipped` | `failed`), and optional `detail`.

### CocoIndex (optional)

| Function | Description |
|----------|-------------|
| `isCocoindexConfigured(root)` | Whether `.ai-spector/.docflow/cocoindex/pipeline.py` exists |
| `runCocoindexSetup(opts?)` | Scaffold CocoIndex pipeline + optional venv deps |
| `runCocoindexSearch(opts)` | Semantic doc search; returns `CocoindexSearchResult` |
| `runGraphQueryFuzzy(opts)` | Resolve query via embeddings, then run subgraph query |

**`CocoindexSearchOptions`:** `root`, `query`, `limit`, `threshold`

**`FuzzyQueryOptions`:** `root`, `query`, `direction`, `depth`, `threshold`

### Comments

| Function | Returns |
|----------|---------|
| `runCommentsList(opts)` | `{ threads, count }` |
| `runCommentsInbox(opts)` | `CommentInbox` payload for agents |
| `runCommentsPlan(opts)` | `CommentResolvePlan` for a thread |
| `runCommentsShow(opts)` | Full thread object |
| `runCommentsResolve(opts)` | `ResolveThreadResult` |

All accept `root` and optional `filePath`. List/inbox accept `status`: `open` | `resolved` | `all`.

---

## Subpath: `ai-spector/graph`

Exports the pure graph module — sessions, query, impact, registry helpers, translation queue parsers, and shared types. No `runIndex`, no comments, no CocoIndex spawn.

Use this subpath when:

- Building a browser bundle that receives JSON from your backend
- Unit-testing graph algorithms without touching the filesystem
- Publishing a thin wrapper around graph logic

```ts
import { ProjectSession, querySubgraph, computeImpact } from "ai-spector/graph";
```

For a full browser integration guide, see [ai-spector-graph integration](ai-spector-graph-integration-guide.md) (companion package).

---

## MCP and CLI

The MCP server and CLI are thin adapters over the same `run*` functions:

```bash
node dist/interfaces/mcp/server.js   # or: npx ai-spector-mcp
node dist/cli.js index --json          # or: npx ai-spector index --json
```

SDK callers get identical result shapes as `npx ai-spector <cmd> --json`.

---

## Related docs

| Doc | Audience |
|-----|----------|
| [Setup guide](setup-guide.md) | End-user project setup |
| [ai-spector-graph integration](ai-spector-graph-integration-guide.md) | Browser dashboards |
| [ARCHITECTURE.md](../ARCHITECTURE.md) | Contributor architecture |
