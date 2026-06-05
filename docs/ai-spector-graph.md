# ai-spector-graph — API Reference

**Package:** [`ai-spector-graph`](https://www.npmjs.com/package/ai-spector-graph)  
**Role:** Browser SDK for **read-only** traceability graph work — load JSON, query subgraphs, run impact analysis.  
**Used by:** Frontend apps (primary) and the `ai-spector` CLI (same engine).

> **New to the SDK?** Read the **[Complete Integration Guide](./ai-spector-graph-integration-guide.md)** first (backend API, React setup, recipes, go-live checklist). This document is the API reference.

---

## What this package does

| Does | Does not |
|------|----------|
| Build `InMemoryGraph` from `traceability.graph.json` | Fetch files over HTTP |
| Query subgraphs around a seed node | Merge or write to the graph |
| Compute impact (regenerate / review buckets) | Run git, parse markdown, validate with Ajv |
| Resolve file paths / headings → graph node ids | Ship a UI or graph canvas |

**Your backend** reads repo files and returns JSON.  
**Your frontend** fetches JSON and passes it into this SDK.  
**This SDK** runs all graph logic in the browser (or Node).

---

## Install

```bash
npm install ai-spector-graph
```

Works in Vite, Next.js, Nuxt, CRA, or any ESM bundler. Zero runtime dependencies.

---

## Correct usage flow

```
┌─────────────┐     GET JSON      ┌─────────────┐     fromJson()     ┌──────────────┐
│   Backend   │ ────────────────► │  Frontend   │ ─────────────────► │ GraphSession │
│  (your API) │  traceability +   │   (fetch)   │   parsed objects   │  query/impact│
│             │  rules.impact     │             │                    └──────────────┘
└─────────────┘                   └─────────────┘
```

### Step 1 — Backend serves JSON

Your API reads files from the repo and returns them as JSON. Minimum set:

| Repo path | API example | Required |
|-----------|-------------|----------|
| `.ai-spector/graph/traceability.graph.json` | `GET /api/files/traceability.graph.json` | **Yes** |
| `schemas/rules.impact.json` | `GET /api/files/rules.impact.json` | For impact (or use bundled defaults) |
| `.ai-spector/.docflow/analysis/knowledge.json` | `GET /api/files/knowledge.json` | Optional — analyze progress, in-graph coverage |
| `.ai-spector/registry/section-registry.json` | `GET /api/files/section-registry.json` | Optional — section headings / doc tree labels |
| `.ai-spector/docflow.config.json` | `GET /api/files/docflow.config.json` | Optional — languages, graph path |
| `.ai-spector/.docflow/state.json` | `GET /api/files/state.json` | Optional — last index / merge timestamps |
| `.ai-spector/.docflow/extract/patch.json` | `GET /api/files/patch.json` | Optional — preview pending graph changes |
| `.ai-spector/.docflow/translation-queue/pending.json` | `GET /api/files/translation-queue/pending.json` | Optional — translation jobs dashboard |
| `.ai-spector/.docflow/translation-queue/failed/*` | `GET /api/translation-queue/failed` (aggregated) | Optional — failed sync jobs |

Generic proxy pattern:

```
GET /api/repo/file?path=.ai-spector/graph/traceability.graph.json
```

The SDK never calls your API — only your app does.

### Step 2 — Frontend fetches and parses

```ts
const graphRes = await fetch("/api/files/traceability.graph.json");
if (!graphRes.ok) throw new Error("Failed to load graph");
const graph = await graphRes.json();

const rulesRes = await fetch("/api/files/rules.impact.json");
const rulesJson = rulesRes.ok ? await rulesRes.json() : null;
```

Always validate HTTP status before `.json()`. Handle stale or missing graph with your own loading/error UI.

### Step 3 — Build session

**Graph only:**

```ts
import {
  GraphSession,
  parseImpactRules,
  DEFAULT_IMPACT_RULES,
} from "ai-spector-graph";

const session = GraphSession.fromJson(graph, {
  impactRules: rulesJson
    ? parseImpactRules(rulesJson)
    : DEFAULT_IMPACT_RULES,
});
```

**Graph + knowledge + registry (recommended):**

```ts
import { ProjectSession, parseImpactRules, DEFAULT_IMPACT_RULES } from "ai-spector-graph";

const [graph, knowledge, registry] = await Promise.all([
  fetch("/api/files/traceability.graph.json").then((r) => r.json()),
  fetch("/api/files/knowledge.json").then((r) => (r.ok ? r.json() : null)),
  fetch("/api/files/section-registry.json").then((r) => (r.ok ? r.json() : null)),
]);

const project = ProjectSession.fromBundle({
  graph,
  knowledge,
  registry,
  impactRules: rulesJson ? parseImpactRules(rulesJson) : DEFAULT_IMPACT_RULES,
});

// Graph via project.graph — same as GraphSession
project.graph.query("UC-01");

// Knowledge + registry helpers
project.knowledgeStats();
project.knowledgeCoverage();
project.sectionLabel("sec.srs.en.02");
```

`GraphSession.fromJson()` / `ProjectSession.fromBundle()` call `InMemoryGraph.from()` internally. Invalid edges (missing nodes) throw immediately — catch and show an error if the graph JSON is corrupt.

### Step 4 — Query, impact, interact

```ts
// Subgraph around a node
const subgraph = session.query("UC-01", { depth: 2, direction: "both" });

// Impact from a node id
const impact = session.impactFromNode("F-01", { change: "requirement updated" });

// Impact from a repo file path (like CLI --file)
const origins = session.resolveOrigins({ file: "docs/srs/en/02-actors.md" });
const impactFromFile = session.impactFromOrigins(origins, { change: "edited" });

// Dashboard counts
const stats = session.stats();

// Direct graph access
const node = session.graph.nodesById.get("UC-01");
const neighbors = session.graph.neighbors("UC-01", "out");
```

---

## `GraphSession` API reference

### `GraphSession.fromJson(graph, options?)`

```ts
static fromJson(
  data: TraceabilityGraph,
  options?: { impactRules?: ImpactRulesFile },
): GraphSession
```

| Argument | Type | Description |
|----------|------|-------------|
| `data` | `TraceabilityGraph` | Parsed `traceability.graph.json` |
| `options.impactRules` | `ImpactRulesFile` | Required before calling any impact method |

**Impact rules options:**

1. Fetch project rules: `parseImpactRules(await fetch(...).then(r => r.json()))`
2. Use SDK defaults: `DEFAULT_IMPACT_RULES` (same rules as `schemas/rules.impact.json` in ai-spector)

---

### `session.query(seedId, options?)`

Equivalent to CLI: `ai-spector graph query <seedId>`

```ts
interface QueryOptions {
  direction?: "out" | "in" | "both";  // default: "both"
  depth?: number;                        // default: 2
  edgeTypes?: EdgeType[];              // default: generate-related edges
  nodeTypes?: NodeType[];              // filter result nodes
}
```

**Returns `GraphQueryResult`:**

```ts
{
  seed: string;
  nodes: GraphNode[];
  edges: GraphEdge[];
  projectionPaths: string[];  // output file paths affected by this subgraph
}
```

**Examples:**

```ts
// Default: depth 2, both directions
session.query("bundle.business");

// Match CLI: --depth 3 --direction out
session.query("doc.srs.en", { depth: 3, direction: "out" });

// Only traceability edges
session.query("F-01", {
  depth: 4,
  edgeTypes: ["satisfies", "dependsOn", "tracesTo", "listedIn"],
});

// Use projection paths to fetch doc content from your API
const { projectionPaths } = session.query("UC-01");
for (const path of projectionPaths) {
  const md = await fetch(`/api/repo/file?path=${encodeURIComponent(path)}`).then(r => r.text());
}
```

---

### `session.impactFromNode(nodeId, options?)`

Equivalent to CLI: `ai-spector graph impact <nodeId>`

```ts
interface ImpactOptions {
  change?: string;  // default: "change"
}
```

**Returns `ImpactResult`:**

```ts
{
  origin: { id: string; type: string; change: string };
  regenerate: ImpactEntry[];   // sections/documents to regenerate
  review: ImpactEntry[];       // domain entities to review
  affectedOutputPaths: string[];
  staleTranslations?: ImpactEntry[];
  truncated?: boolean;         // BFS hit 500-node cap
}
```

Each `ImpactEntry`:

```ts
{
  id: string;
  type: string;
  reason: string;           // e.g. "listedIn from UC-01"
  projectionPath?: string;  // repo path to open in your UI
}
```

**Example — highlight impacted nodes in a canvas:**

```ts
const impact = session.impactFromNode("UC-01", { change: "use case updated" });

const impactedIds = new Set([
  impact.origin.id,
  ...impact.regenerate.map((e) => e.id),
  ...impact.review.map((e) => e.id),
]);

// Pass impactedIds to your graph renderer as a highlight set
```

---

### `session.resolveOrigins(hints)`

Equivalent to CLI: `ai-spector graph impact --file <path> [--heading <text>]`

```ts
interface ResolveOriginsHints {
  id?: string;            // explicit node id (maps to nodeId internally)
  file?: string;          // repo-relative path, e.g. docs/srs/en/02-actors.md
  heading?: string;       // section heading text
  text?: string;          // free-text search on ids/titles
  sectionAnchor?: string; // section graph id or anchor comment
}
```

**Returns `ResolvedOrigin[]`:**

```ts
{ id: string; type: string; reason: string }[]
```

**Examples:**

```ts
// By node id
session.resolveOrigins({ id: "UC-01" });

// By file path (document node + rendersTo domain nodes)
session.resolveOrigins({ file: "docs/srs/en/03-use-cases.md" });

// By file + heading (section-level seed)
session.resolveOrigins({
  file: "docs/srs/en/03-use-cases.md",
  heading: "3.2 Checkout flow",
});

// Text search
session.resolveOrigins({ text: "checkout" });
```

Then run impact on all matches:

```ts
const origins = session.resolveOrigins({ file: "docs/srs/en/02-actors.md" });
if (origins.length === 0) {
  // show "no traceability seed for this file"
} else {
  const impact = session.impactFromOrigins(origins, { change: "file edited" });
}
```

**Note:** Git-based impact (`--git`) is **not** in the SDK. Your backend can run git, resolve seeds server-side, and return seed ids to the frontend.

---

### `session.stats()`

```ts
{
  nodes: number;
  edges: number;
  byType: Record<string, number>;  // e.g. { useCase: 12, feature: 8, ... }
  domainNodes: number;
  structureNodes: number;
}
```

---

### `session.graph`

Direct access to `InMemoryGraph`:

```ts
// Lookup
session.graph.nodesById.get("F-01");

// One-hop neighbors
session.graph.neighbors("UC-01", "out");
session.graph.neighbors("UC-01", "in");
session.graph.neighbors("UC-01", "both", new Set(["satisfies", "dependsOn"]), 2);

// Export back to JSON
const json = session.graph.toTraceabilityGraph();

// Structural validation (read-only check)
const issues = session.graph.validateStructure();
```

---

## `ProjectSession` API (graph + knowledge + registry)

Use when your API returns multiple project files.

### `ProjectSession.fromBundle(bundle)`

```ts
interface ProjectBundle {
  graph: TraceabilityGraph;
  impactRules?: ImpactRulesFile;
  knowledge?: unknown;   // knowledge.json
  registry?: unknown;    // section-registry.json
}
```

| Method | Description |
|--------|-------------|
| `project.graph` | `GraphSession` — query, impact, stats |
| `project.knowledgeStats()` | Counts: actors, use cases, features, … |
| `project.knowledgeCoverage()` | Per-category rows with `inGraph: boolean` |
| `project.sectionLabel(sectionId)` | Registry heading, e.g. `"2. Actors"` |
| `project.registryDocuments()` | Template document list |
| `project.hasKnowledge()` / `hasRegistry()` / `hasConfig()` / `hasState()` | Whether optional JSON was loaded |
| `project.languages()` / `primaryLanguage()` / `languageCodes()` | From `docflow.config.json` |
| `project.lastIndexRunAt()` / `lastGraphMergedAt()` | From `state.json` |
| `project.layerAudit({ existingPaths? })` | Tri-layer health (parity with `graph report`) |
| `project.simulatePatch(patch)` | Preview merge without writing |
| `project.validationIssues()` | Structural graph validation errors |
| `project.healthSummary()` | Validation + layer audit combined |
| `project.translationQueueStats()` | Pending/failed/resolved job counts |
| `project.pendingTranslationJobs()` | Active translation jobs |
| `project.linkStaleTranslations(impact)` | Map `staleTranslations` → queue jobs |
| `project.jobsForProjectionPath(path)` | Pending jobs for a doc path |

### Knowledge coverage (parity with `graph visualize` Knowledge tab)

```ts
const coverage = project.knowledgeCoverage();

for (const cat of coverage.categories) {
  console.log(cat.label, cat.inGraph, "/", cat.total);
  for (const row of cat.rows) {
    console.log(row.id, row.inGraph ? "✓" : "✗", row.data.title ?? row.data.name);
  }
}
```

`KnowledgeCoverageRow`:

```ts
{
  id: string;
  category: "actor" | "useCase" | "feature" | "requirement" | "nfr" | "dataEntity";
  inGraph: boolean;
  graphNodeType?: NodeType;
  data: Record<string, unknown>;  // title, name, priority, satisfies, tracesTo, …
}
```

### Registry helpers (standalone)

```ts
import {
  parseSectionRegistry,
  sectionLabel,
  findRegistrySection,
  allRegistrySections,
} from "ai-spector-graph";

const registry = parseSectionRegistry(registryJson);
sectionLabel(registry, "sec.srs.en.02");  // "2. Actors"
```

### Translation queue (v0.4)

For multi-language projects, your API can aggregate queue files:

```ts
const project = ProjectSession.fromBundle({
  graph,
  config,
  translationQueue: {
    pending: await fetch("/api/files/translation-queue/pending.json").then((r) => r.json()),
    failed: await fetch("/api/translation-queue/failed-jobs").then((r) => r.json()),
  },
});

const stats = project.translationQueueStats();
// { pending: 3, failed: 1, pendingTargetsByLang: { jp: 2, vi: 1 } }

const impact = project.graph.impactFromNode("doc.srs.en.01");
const links = project.linkStaleTranslations(impact);
// stale translation docs → matching pending jobs
```

Standalone helpers:

```ts
import {
  parseTranslationQueueBundle,
  jobsForProjectionPath,
  linkStaleTranslationsToQueue,
} from "ai-spector-graph";
```

### Graph health (v0.4)

```ts
const health = project.healthSummary({ existingPaths: pathsFromBackend });
// { structureErrors, layerOk, layersNeedingWork, suggestedCommand }
```

### Knowledge helpers (standalone)

```ts
import {
  parseKnowledge,
  isKnowledgePayload,
  computeKnowledgeStats,
  knowledgeGraphCoverage,
} from "ai-spector-graph";

const knowledge = parseKnowledge(knowledgeJson);
const stats = computeKnowledgeStats(knowledge);
const coverage = knowledgeGraphCoverage(knowledge, session.graph);
```

---

## Lower-level API (without `GraphSession`)

Use when you need finer control or tree-shaking:

```ts
import {
  InMemoryGraph,
  querySubgraph,
  computeImpact,
  parseImpactRules,
  DEFAULT_IMPACT_RULES,
  resolveImpactOrigins,
  projectionPathForNode,
  computeGraphStats,
  expandPathTargetNodes,
} from "ai-spector-graph";

const g = InMemoryGraph.from(graphJson);

const subgraph = querySubgraph(g, "UC-01", { depth: 2 });
const path = projectionPathForNode(g, "F-01");
const impact = computeImpact(g, "F-01", "change", DEFAULT_IMPACT_RULES);
const stats = computeGraphStats(graphJson);
```

---

## Graph visualization (canvas libraries)

Some edges point at **file paths**, not node ids (`rendersTo`, `derivedFrom`). Canvas libraries need synthetic nodes:

```ts
import { expandPathTargetNodes, nodesForVisualization } from "ai-spector-graph";

const { nodes, edges } = session.query("UC-01", { depth: 2 });
const nodeIds = new Set(nodes.map((n) => n.id));

const expanded = expandPathTargetNodes(session.graph, { nodeIds });
const visNodes = nodesForVisualization(nodes, expanded);
const visEdges = [...edges, ...expanded.resolvedEdges];
```

Synthetic node ids:

| Edge type | Synthetic id format | Example |
|-----------|---------------------|---------|
| `derivedFrom` | `source:<path>` | `source:docs/data-source/actors.md` |
| `rendersTo` (no doc node) | `file:<path>` | `file:docs/srs/en/01-overview.md` |

Feed `visNodes` + `visEdges` into vis-network, cytoscape, d3, sigma.js, etc.

---

## React integration pattern

```tsx
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  GraphSession,
  parseImpactRules,
  DEFAULT_IMPACT_RULES,
  type ImpactResult,
  type GraphQueryResult,
} from "ai-spector-graph";

async function loadSession() {
  const graph = await fetch("/api/files/traceability.graph.json").then((r) => {
    if (!r.ok) throw new Error("graph load failed");
    return r.json();
  });

  let impactRules = DEFAULT_IMPACT_RULES;
  try {
    const rules = await fetch("/api/files/rules.impact.json").then((r) => r.json());
    impactRules = parseImpactRules(rules);
  } catch {
    // fall back to bundled rules
  }

  return GraphSession.fromJson(graph, { impactRules });
}

export function useGraphSession() {
  return useQuery({
    queryKey: ["traceability-graph"],
    queryFn: loadSession,
    staleTime: 60_000,
  });
}

export function useSubgraph(seedId: string, depth = 2) {
  const { data: session } = useGraphSession();
  return useMemo<GraphQueryResult | null>(() => {
    if (!session || !seedId) return null;
    try {
      return session.query(seedId, { depth });
    } catch {
      return null;
    }
  }, [session, seedId, depth]);
}

export function useImpact(nodeId: string | null) {
  const { data: session } = useGraphSession();
  return useMemo<ImpactResult | null>(() => {
    if (!session || !nodeId) return null;
    try {
      return session.impactFromNode(nodeId);
    } catch {
      return null;
    }
  }, [session, nodeId]);
}
```

Keep **one `GraphSession` per graph load** — rebuilding on every render is expensive for large graphs.

---

## JSON data contract

### `TraceabilityGraph`

```ts
interface TraceabilityGraph {
  version: number;
  nodes: GraphNode[];
  edges: GraphEdge[];
}

interface GraphNode {
  id: string;
  type: NodeType;  // "useCase" | "feature" | "document" | "section" | ...
  [key: string]: unknown;  // title, heading, output, outputPattern, ...
}

interface GraphEdge {
  type: EdgeType;  // "satisfies" | "listedIn" | "tracesTo" | ...
  from: string;    // node id
  to: string;      // node id OR repo path for rendersTo/derivedFrom
  role?: string;
}
```

### Node types

`bundle`, `sourceFile`, `document`, `section`, `table`, `diagram`, `actor`, `useCase`, `feature`, `requirement`, `nfr`, `dataEntity`

### Edge types

`partOf`, `contains`, `follows`, `references`, `listedIn`, `definedIn`, `describedIn`, `satisfies`, `dependsOn`, `requires`, `tracesTo`, `derivedFrom`, `rendersTo`, `relatesTo`, `translationOf`

---

## CLI parity

| CLI command | SDK equivalent |
|-------------|----------------|
| `graph query <id> --depth N` | `session.query(id, { depth: N })` |
| `graph query <id> --direction out` | `session.query(id, { direction: "out" })` |
| `graph impact <id>` | `session.impactFromNode(id, { change })` |
| `graph impact --file <path>` | `session.resolveOrigins({ file })` → `session.impactFromOrigins()` |
| `graph impact --file <path> --heading <h>` | `session.resolveOrigins({ file, heading })` → `impactFromOrigins()` |
| `graph impact --git` | **Not in SDK** — resolve on backend, pass seed ids to FE |
| `graph visualize` | Use `expandPathTargetNodes` + your canvas library |

---

## Relationship to `ai-spector` CLI

The CLI package (`ai-spector`) depends on `ai-spector-graph` for core graph logic:

- `InMemoryGraph`, `query`, `impact`, `resolve` (non-git) → from SDK
- `merge`, `doc-extract`, `loadGraph`, `resolveFromGitDiff` → CLI only

Both share the same algorithms. SDK results match CLI output when given the same `traceability.graph.json` and `rules.impact.json`.

---

## Common mistakes

### 1. Calling impact without rules

```ts
const session = GraphSession.fromJson(graph);  // no impactRules
session.impactFromNode("UC-01");  // throws: "Impact rules required"
```

**Fix:** Pass `impactRules` or `DEFAULT_IMPACT_RULES`.

### 2. Expecting the SDK to fetch files

```ts
// Wrong — SDK has no fetch
const session = await GraphSession.loadFromApi("/api/graph");
```

**Fix:** Fetch in your app, then `GraphSession.fromJson(parsed)`.

### 3. Querying unknown node ids

```ts
session.query("nonexistent");  // throws: "Unknown node id"
```

**Fix:** Check `session.graph.nodesById.has(id)` first, or use `resolveOrigins({ text })`.

### 4. Ignoring path-target edges in visualization

`rendersTo` and `derivedFrom` edges often have `to` as a file path string, not a node id. Without `expandPathTargetNodes`, canvas libraries show dangling edges.

### 5. Rebuilding session on every render

```tsx
// Wrong — runs InMemoryGraph.from() every render
function Bad({ graph }) {
  const session = GraphSession.fromJson(graph);
}
```

**Fix:** Memoize or store session in React Query / context / `useMemo`.

---

## TypeScript

Full types ship with the package. Enable `strict` in your `tsconfig` for best IntelliSense.

```ts
import type {
  TraceabilityGraph,
  GraphNode,
  GraphEdge,
  ImpactResult,
  GraphQueryResult,
  ImpactRulesFile,
} from "ai-spector-graph";
```

---

## Local development (monorepo)

Inside the ai-spector repo:

```bash
npm run build:graph   # build SDK only
npm test              # includes packages/graph/tests
```

Workspace link: root `package.json` has `"ai-spector-graph": "workspace:*"`.

---

## Expanding beyond the graph file

The SDK today focuses on `traceability.graph.json` + impact rules. Your backend can also expose **knowledge**, **section-registry**, **config**, **state**, and **repo markdown** — see **[Expansion guide](./ai-spector-graph-expansion.md)** for:

- Tier 1: `knowledge.json`, `section-registry.json`, `docflow.config.json`, markdown previews
- Proposed `ProjectSession` facade (multi-file bundle)
- Backend API patterns (per-file vs project bundle)
- Phased SDK roadmap (v0.2–v0.4)

---

## See also

- **[Integration guide](./ai-spector-graph-integration-guide.md)** — complete backend + frontend integration
- [Expansion guide](./ai-spector-graph-expansion.md) — knowledge, registry, and more for web
- [Web SDK plan](./plan-web-graph-viewer.md) — architecture and scope
- [Traceability graph design](./design/traceability-graph-redesign.md) — graph schema
- [Package README](../packages/graph/README.md) — npm quick start
