# ai-spector SDK

Programmatic access to the same typed operations used by the CLI and MCP server.

**Requirements:** Node.js ≥ 20 for Node operations. Browser/SSR environments use `ai-spector/graph` only — no Node required.

---

## Install

```bash
npm install ai-spector
```

Internal Verdaccio registry:

```bash
npm install ai-spector --registry http://10.101.0.239:4873
```

---

## Entry points

| Import | Runtime | What it contains |
|--------|---------|-----------------|
| `ai-spector` | Node ≥ 20 | Everything: graph sessions + file operations + CocoIndex + comments |
| `ai-spector/graph` | Browser · SSR · Node | Pure graph algorithms + sessions — **zero Node built-ins** |
| `ai-spector/types` | Anywhere | Shared TypeScript types only — no runtime code |
| `ai-spector/mcp` | Node | MCP server entry (`ai-spector-mcp` bin) |
| `ai-spector/cli` | Node | CLI entry (`ai-spector` bin) |

**Rule of thumb:**
- Frontend app (Vue, React, Next)? → use `ai-spector/graph`
- Node script, CI, backend, or CLI? → use `ai-spector`
- Types only in a shared type package? → use `ai-spector/types`

> For a complete browser integration walkthrough see **[Browser integration guide](browser-integration.md)**.

---

## TypeScript config

All subpaths ship `types` fields in the export map. Any `moduleResolution` that respects export conditions works without extra config:

```jsonc
// tsconfig.json
{
  "compilerOptions": {
    "moduleResolution": "bundler"   // Vite / esbuild / webpack 5
    // or "node16" / "nodenext"     // Node ESM
  }
}
```

No `paths` overrides needed.

---

## SDK design

- Every `run*` function accepts typed options and returns a typed result — no `console.log`, no formatted strings.
- File-backed operations resolve paths from `root` (defaults to `process.cwd()`) via the `.ai-spector/` layout, same as the CLI.
- In-memory helpers (`GraphSession`, `ProjectSession`, `querySubgraph`, `computeImpact`) accept JSON you already loaded — no filesystem access. These are the same functions the `run*` helpers call internally.
- Errors throw as standard `Error` objects with actionable messages (same text the CLI surfaces).

---

## Node SDK quick start

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
  graphPath: ".ai-spector/graph/traceability.graph.json",
  schemaPath: "node_modules/ai-spector/schemas/traceability.graph.schema.json",
  registryPath: ".ai-spector/registry/section-registry.json",
  rulesPath: "schemas/rules.impact.json",
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

const result = await runGraphQuery({
  graphPath: ".ai-spector/graph/traceability.graph.json",
  seedId: "UC-01",
  direction: "both",
  depth: 2,
});

console.log(result.nodes.length, result.edges.length);
```

### Impact analysis from git changes

```ts
import { runGraphImpact } from "ai-spector";

const impact = await runGraphImpact({
  projectRoot: process.cwd(),
  graphPath: ".ai-spector/graph/traceability.graph.json",
  rulesPath: "schemas/rules.impact.json",
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

## In-memory sessions (browser + Node)

Use sessions when you already have JSON — from an HTTP API, a file you loaded yourself, or a test fixture.  
Import from `ai-spector/graph` in browser code; from `ai-spector` in Node code.

### `GraphSession`

Single-graph in-memory session.

```ts
import { GraphSession, DEFAULT_IMPACT_RULES } from "ai-spector/graph";

const session = GraphSession.fromJson(graphJson, {
  impactRules: DEFAULT_IMPACT_RULES,
});

const stats    = session.stats();
const subgraph = session.query("UC-01", { direction: "out", depth: 3 });
const impact   = session.impactFromNode("UC-01", { change: "title updated" });
```

### `ProjectSession` / `createProjectSession`

Multi-file session: graph + optional knowledge, section registry, config, state, and translation queue.

```ts
import { createProjectSession } from "ai-spector/graph";
import type { ProjectBundle } from "ai-spector/types";

// bundle comes from your API — see Browser integration guide for the full contract
const bundle: ProjectBundle = {
  graph:     graphJson,
  knowledge: knowledgeJson,   // optional
  registry:  registryJson,    // optional
};

const project = createProjectSession(bundle);

console.log(project.knowledgeStats());
console.log(project.knowledgeCoverage());
console.log(project.sectionLabel("sec.use-cases"));
console.log(project.healthSummary());
```

`createProjectSession(bundle)` and `ProjectSession.fromBundle(bundle)` are identical — use whichever reads more naturally.

---

## Repo file layout reference

Your backend must serve these files. Paths are relative to the project root.

| File | Bundle field | Required |
|------|-------------|----------|
| `.ai-spector/graph/traceability.graph.json` | `graph` | **Yes** |
| `schemas/rules.impact.json` | `impactRules` | No — falls back to built-in defaults |
| `.ai-spector/registry/section-registry.json` | `registry` | No — disables `sectionLabel()` |
| `.ai-spector/.docflow/knowledge.json` | `knowledge` | No — disables knowledge coverage |
| `.ai-spector/.docflow/state.json` | `state` | No |
| `.ai-spector/.docflow/translation-queue/` (merged) | `translationQueue` | No |

---

## API reference

### Browser-safe exports (`ai-spector/graph`)

#### Sessions

| Export | Description |
|--------|-------------|
| `createProjectSession(bundle)` | Free-function alias for `ProjectSession.fromBundle(bundle)` |
| `ProjectSession.fromBundle(bundle)` | Multi-file project session |
| `GraphSession.fromJson(graph, opts?)` | Single-graph session |

#### Algorithms

| Export | Description |
|--------|-------------|
| `querySubgraph(graph, seedId, opts?)` | BFS subgraph from a seed node |
| `computeImpact(graph, originId, change, rules)` | Formal impact buckets (`regenerate`, `review`) |
| `mergeImpactResults(results, gitSeeds?)` | Merge multiple impact results (multi-seed git diff) |
| `parseImpactRules(data)` | Parse a `rules.impact.json` object |
| `DEFAULT_IMPACT_RULES` | Built-in rules — used when `impactRules` is omitted from bundle |
| `auditGraphLayers(graph, opts?)` | Tri-layer coverage audit |
| `knowledgeGraphCoverage(graph, knowledge)` | Knowledge ↔ graph coverage report |
| `computeKnowledgeStats(knowledge)` | Count actors, use cases, features, etc. |
| `expandPathTargetNodes(graph, opts?)` | Expand path/file nodes for visualization |
| `nodesForVisualization(graph, opts?)` | Flat node list ready for a graph canvas |
| `resolveImpactOrigins(graph, hints)` | Resolve a file/heading/id to impact origin nodes |
| `pickPrimaryImpactOrigin(origins)` | Pick the best origin from a resolve result |
| `sectionLabel(registry, id)` | Human label for a registry section id |
| `registryDocuments(registry)` | All registry document entries |
| `graphHealthSummary(graph, audit)` | Structured health summary |
| `computeGraphStats(graph)` | Node/edge count stats |

#### Types (also in `ai-spector/types`)

`ProjectBundle` · `ProjectSessionOptions` · `GraphSessionOptions` · `ImpactRulesFile` · `ImpactEntry` · `ImpactResult` · `QueryOptions` · `GraphQueryResult` · `LayerAuditReport` · `KnowledgeCoverageReport` · `AnalysisKnowledge` · `ResolvedOrigin` · `GraphHealthSummary` · `GraphStats` · `SectionRegistry` · `RegistryDocument` · `TranslationJob` · `TranslationQueueStats` · `StaleTranslationLink` · `ExtractPatch` · `PatchSimulationResult`

---

### Node-only exports (`ai-spector`)

> Do not import these in browser bundles — they use `node:fs`, `node:path`, `node:child_process`.

#### Graph operations (file-backed)

| Function | Returns | Notes |
|----------|---------|-------|
| `validateGraph(opts)` | `ValidationIssue[]` | Schema + structural validation |
| `runGraphMerge(opts)` | `GraphMergeResult` | Apply extract/knowledge patch |
| `runGraphQuery(opts)` | `GraphQueryResult` | Load graph from disk, then query |
| `runGraphImpact(opts)` | `GraphImpactResult` | Impact from node id, file/heading, or `--git` |
| `runGraphImpactFromGit(graph, opts)` | `GraphImpactResult` | Git diff seeds when graph already loaded |

`GraphImpactResult` extends `ImpactResult` with optional `semanticSuggestions` when CocoIndex is configured.

#### Index

```ts
import { runIndex } from "ai-spector";

const report = await runIndex({
  root: "/path/to/project",
  graphOnly: false,      // skip doc indexing steps
  docsOnly: false,       // skip graph steps
  skipMerge: false,
  skipValidate: false,
  cocoindexSync: false,  // trigger CocoIndex re-index when configured
});
// IndexReport: { steps: IndexStepResult[]; failed: boolean; cocoindexUpdated?; cocoindexSkipped? }
// Each step: { id, label, status: "ok" | "skipped" | "failed", detail? }
```

#### CocoIndex (optional semantic search)

| Function | Description |
|----------|-------------|
| `isCocoindexConfigured(root)` | Whether CocoIndex pipeline exists |
| `runCocoindexSetup(opts?)` | Scaffold CocoIndex pipeline + optional venv deps |
| `runCocoindexSearch(opts)` | Semantic doc search — returns `CocoindexSearchResult` |
| `runGraphQueryFuzzy(opts)` | Resolve via embeddings, then run subgraph query |

Requires Python ≥ 3.11 when enabled.

#### Comments

| Function | Returns |
|----------|---------|
| `runCommentsList(opts)` | `{ threads, count }` |
| `runCommentsInbox(opts)` | `CommentInbox` payload for agents |
| `runCommentsPlan(opts)` | `CommentResolvePlan` for a thread |
| `runCommentsShow(opts)` | Full thread object |
| `runCommentsResolve(opts)` | `ResolveThreadResult` |

All accept `root` and optional `filePath`. List/inbox accept `status`: `"open"` | `"resolved"` | `"all"`.

---

## What not to do

```ts
// ❌ Don't import the Node root package in a browser bundle
import { createProjectSession } from "ai-spector";      // pulls in node:fs

// ✅ Use the browser entry instead
import { createProjectSession } from "ai-spector/graph";

// ❌ Don't call runIndex / runGraphImpact from frontend code
import { runIndex } from "ai-spector/graph";            // not exported — will error

// ✅ Run operations server-side, pass resulting JSON to the frontend session
```

---

## MCP and CLI

The MCP server and CLI are thin adapters over the same `run*` functions. SDK callers get identical result shapes:

```bash
npx ai-spector index --json         # same shape as runIndex() result
npx ai-spector graph impact --json  # same shape as runGraphImpact() result
npx ai-spector-mcp                  # MCP server
```

---

## Related docs

| Doc | Audience |
|-----|----------|
| [Browser integration guide](browser-integration.md) | Vue / React / Next.js frontend apps |
| [ARCHITECTURE.md](../ARCHITECTURE.md) | Contributor architecture reference |
