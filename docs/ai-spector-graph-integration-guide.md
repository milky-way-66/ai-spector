# ai-spector-graph — Complete Integration Guide

End-to-end guide for integrating [`ai-spector-graph`](https://www.npmjs.com/package/ai-spector-graph) into your web app.

| Document | Purpose |
|----------|---------|
| **This guide** | Backend + frontend integration, recipes, full examples |
| [API reference](./ai-spector-graph.md) | `GraphSession` / `ProjectSession` method details |
| [Expansion roadmap](./ai-spector-graph-expansion.md) | Future data sources and SDK phases |

---

## 1. What you are building

```
┌──────────────────────────────────────────────────────────────────┐
│                        Your web application                       │
│  ┌─────────────┐    fetch JSON     ┌──────────────────────────┐  │
│  │   UI pages  │ ◄────────────── │  ai-spector-graph (SDK)   │  │
│  │ graph/impact│    query/impact  │  ProjectSession           │  │
│  │ knowledge   │ ◄────────────── │  read-only, in-browser    │  │
│  └─────────────┘                  └──────────────────────────┘  │
└───────────────────────────────▲──────────────────────────────────┘
                                │ HTTP GET (JSON + markdown)
┌───────────────────────────────┴──────────────────────────────────┐
│                     Your backend API                              │
│  reads repo files: .ai-spector/graph/, knowledge, registry, …    │
└───────────────────────────────▲──────────────────────────────────┘
                                │
┌───────────────────────────────┴──────────────────────────────────┐
│              ai-spector project (git repo)                        │
│  traceability.graph.json, docs/srs/, docflow.config.json, …        │
└────────────────────────────────────────────────────────────────────┘
```

**Division of responsibility:**

| Layer | Does | Does not |
|-------|------|----------|
| **Git repo** | Stores graph + docs (written by `ai-spector` CLI / Cursor) | Serve HTTP |
| **Your backend** | Read repo files; auth; CORS; optional git | Run graph algorithms |
| **Your frontend** | `fetch`; UI; cache | Merge or edit graph |
| **`ai-spector-graph`** | Parse JSON; query; impact; stats; health | `fetch`; UI |

The SDK is **read-only**. All writes stay in the CLI (`ai-spector index`, `graph merge`, etc.).

---

## 2. Prerequisites

### On the repo (ai-spector project)

The project must be initialized with ai-spector:

```bash
npx ai-spector init
npx ai-spector index    # builds traceability.graph.json
```

Minimum file for the SDK to work:

```
.ai-spector/graph/traceability.graph.json
```

Recommended additional files for a full web experience:

```
.ai-spector/
  docflow.config.json
  graph/traceability.graph.json
  registry/section-registry.json
  .docflow/
    analysis/knowledge.json
    state.json
    translation-queue/pending.json   # multi-language only
docs/srs/{lang}/*.md                 # fetched separately for previews
schemas/rules.impact.json            # or use SDK DEFAULT_IMPACT_RULES
```

### On the frontend

- Node 18+
- ESM bundler (Vite, Next.js App Router, Nuxt 3, etc.)
- TypeScript recommended

```bash
npm install ai-spector-graph
```

Zero runtime dependencies. Works in browser and Node.

---

## 3. Backend API design

The SDK does **not** call your API. Design endpoints so the frontend can load a **project bundle** in one or few requests.

### Option A — Single bundle endpoint (recommended)

```
GET /api/projects/:projectId/traceability
Authorization: Bearer <token>
```

**Response `200`:**

```json
{
  "graph": { "version": 1, "nodes": [], "edges": [] },
  "impactRules": { "version": 2, "pass1_expand": {}, "pass2_downstream": {}, "buckets": {} },
  "knowledge": null,
  "registry": { "version": 1, "root": "templates", "documents": [] },
  "config": { "version": 1, "languages": [{ "code": "en", "label": "English" }], "paths": {} },
  "state": { "version": 1, "index": { "lastRunAt": "2026-06-01T12:00:00Z" } },
  "translationQueue": {
    "pending": { "version": 1, "jobs": [] },
    "failed": []
  },
  "meta": {
    "graphUpdatedAt": "2026-06-05T10:00:00Z",
    "projectRoot": "acme-docs"
  }
}
```

Backend implementation pseudocode:

```ts
// Express example
app.get("/api/projects/:id/traceability", async (req, res) => {
  const root = await resolveProjectRoot(req.params.id);
  const read = (rel: string) =>
    fs.readFile(path.join(root, rel), "utf8").then(JSON.parse).catch(() => null);

  res.json({
    graph: await read(".ai-spector/graph/traceability.graph.json"),
    impactRules: await read("schemas/rules.impact.json"),
    knowledge: await read(".ai-spector/.docflow/analysis/knowledge.json"),
    registry: await read(".ai-spector/registry/section-registry.json"),
    config: await read(".ai-spector/docflow.config.json"),
    state: await read(".ai-spector/.docflow/state.json"),
    translationQueue: {
      pending: await read(".ai-spector/.docflow/translation-queue/pending.json"),
      failed: await loadFailedJobsAggregated(root),
    },
    meta: { graphUpdatedAt: await mtime(root, ".ai-spector/graph/traceability.graph.json") },
  });
});
```

### Option B — Per-file proxy

```
GET /api/repo/file?path=.ai-spector/graph/traceability.graph.json
GET /api/repo/file?path=.ai-spector/.docflow/analysis/knowledge.json
GET /api/repo/file?path=docs/srs/en/01-overview.md          → text/markdown
GET /api/repo/exists?paths=docs/srs/en/uc-01.md,docs/...    → { "docs/...": true }
```

Path allowlist: reject `..`, restrict to project root.

### File reference table

| Repo path | JSON field | Required | SDK use |
|-----------|------------|----------|---------|
| `.ai-spector/graph/traceability.graph.json` | `graph` | **Yes** | Graph engine |
| `schemas/rules.impact.json` | `impactRules` | For impact* | Impact analysis |
| `.ai-spector/.docflow/analysis/knowledge.json` | `knowledge` | No | Analyze coverage table |
| `.ai-spector/registry/section-registry.json` | `registry` | No | Section labels |
| `.ai-spector/docflow.config.json` | `config` | No | Language switcher |
| `.ai-spector/.docflow/state.json` | `state` | No | “Last indexed” banner |
| `.ai-spector/.docflow/translation-queue/pending.json` | `translationQueue.pending` | No | Translation dashboard |
| Failed job files (aggregated) | `translationQueue.failed` | No | Failed sync list |
| `.ai-spector/.docflow/extract/patch.json` | (separate fetch) | No | Patch preview |

\*Or omit `impactRules` and use `DEFAULT_IMPACT_RULES` from the SDK in the frontend.

### Markdown previews (not in SDK)

```
GET /api/repo/file?path=docs/srs/en/01-overview.md
→ { "path": "...", "content": "# Overview\n...", "mime": "text/markdown" }
```

Use when showing `projectionPath` from impact/query results.

---

## 4. Frontend — minimal integration

### 4.1 Load graph only

```ts
import {
  GraphSession,
  DEFAULT_IMPACT_RULES,
} from "ai-spector-graph";

async function loadGraphSession() {
  const res = await fetch("/api/projects/acme/traceability");
  if (!res.ok) throw new Error(`Load failed: ${res.status}`);
  const { graph } = await res.json();

  return GraphSession.fromJson(graph, {
    impactRules: DEFAULT_IMPACT_RULES,
  });
}

// Usage
const session = await loadGraphSession();
const stats = session.stats();
const subgraph = session.query("UC-01", { depth: 2 });
const impact = session.impactFromNode("F-01", { change: "updated" });
```

### 4.2 Full project session (recommended)

```ts
import {
  ProjectSession,
  parseImpactRules,
  DEFAULT_IMPACT_RULES,
  type ProjectBundle,
} from "ai-spector-graph";

async function loadProject(): Promise<ProjectSession> {
  const res = await fetch("/api/projects/acme/traceability");
  if (!res.ok) throw new Error(`Load failed: ${res.status}`);
  const data = await res.json();

  const bundle: ProjectBundle = {
    graph: data.graph,
    knowledge: data.knowledge ?? undefined,
    registry: data.registry ?? undefined,
    config: data.config ?? undefined,
    state: data.state ?? undefined,
    translationQueue: data.translationQueue ?? undefined,
    impactRules: data.impactRules
      ? parseImpactRules(data.impactRules)
      : DEFAULT_IMPACT_RULES,
  };

  return ProjectSession.fromBundle(bundle);
}
```

**Create once per load** — do not call `fromBundle` on every React render.

---

## 5. Frontend — React integration

### 5.1 Project provider

```tsx
// lib/traceability.tsx
import {
  createContext,
  useContext,
  useMemo,
  type ReactNode,
} from "react";
import { useQuery } from "@tanstack/react-query";
import {
  ProjectSession,
  parseImpactRules,
  DEFAULT_IMPACT_RULES,
  type ProjectBundle,
} from "ai-spector-graph";

const ProjectContext = createContext<ProjectSession | null>(null);

async function fetchProjectBundle(): Promise<ProjectBundle> {
  const res = await fetch("/api/projects/acme/traceability");
  if (!res.ok) throw new Error("Failed to load traceability bundle");
  const data = await res.json();
  return {
    graph: data.graph,
    knowledge: data.knowledge,
    registry: data.registry,
    config: data.config,
    state: data.state,
    translationQueue: data.translationQueue,
    impactRules: data.impactRules
      ? parseImpactRules(data.impactRules)
      : DEFAULT_IMPACT_RULES,
  };
}

export function TraceabilityProvider({
  children,
}: {
  children: ReactNode;
}) {
  const { data, isLoading, error } = useQuery({
    queryKey: ["traceability-bundle"],
    queryFn: fetchProjectBundle,
    staleTime: 60_000,
    select: (bundle) => ProjectSession.fromBundle(bundle),
  });

  if (isLoading) return <div>Loading graph…</div>;
  if (error) return <div>Error: {(error as Error).message}</div>;
  if (!data) return null;

  return (
    <ProjectContext.Provider value={data}>{children}</ProjectContext.Provider>
  );
}

export function useProject(): ProjectSession {
  const ctx = useContext(ProjectContext);
  if (!ctx) throw new Error("useProject outside TraceabilityProvider");
  return ctx;
}
```

### 5.2 Hooks for common features

```tsx
// hooks/useSubgraph.ts
import { useMemo } from "react";
import { useProject } from "../lib/traceability";

export function useSubgraph(seedId: string | null, depth = 2) {
  const project = useProject();
  return useMemo(() => {
    if (!seedId) return null;
    try {
      return project.graph.query(seedId, { depth, direction: "both" });
    } catch {
      return null;
    }
  }, [project, seedId, depth]);
}

// hooks/useImpact.ts
import { useMemo } from "react";
import { useProject } from "../lib/traceability";

export function useImpact(nodeId: string | null) {
  const project = useProject();
  return useMemo(() => {
    if (!nodeId) return null;
    try {
      return project.graph.impactFromNode(nodeId, { change: "user edit" });
    } catch {
      return null;
    }
  }, [project, nodeId]);
}

// hooks/useKnowledgeCoverage.ts
import { useMemo } from "react";
import { useProject } from "../lib/traceability";

export function useKnowledgeCoverage() {
  const project = useProject();
  return useMemo(() => project.knowledgeCoverage(), [project]);
}
```

### 5.3 Example pages

**Graph stats overview**

```tsx
function OverviewPage() {
  const project = useProject();
  const stats = project.graph.stats();
  const kStats = project.knowledgeStats();
  const health = project.healthSummary();

  return (
    <div>
      <h2>Graph</h2>
      <p>{stats.nodes} nodes, {stats.edges} edges</p>
      <p>Domain: {stats.domainNodes}, Structure: {stats.structureNodes}</p>

      {kStats.present && (
        <>
          <h2>Knowledge (analyze)</h2>
          <p>{kStats.useCases} use cases, {kStats.features} features</p>
        </>
      )}

      <h2>Health</h2>
      <p>Structure errors: {health.structureErrors}</p>
      {!health.layerOk && (
        <p>Layers needing work: {health.layersNeedingWork.join(", ")}</p>
      )}
      {health.suggestedCommand && (
        <p>Suggested: <code>{health.suggestedCommand}</code></p>
      )}

      {project.lastIndexRunAt() && (
        <p>Last index: {project.lastIndexRunAt()}</p>
      )}
    </div>
  );
}
```

**Knowledge coverage table (in graph ✓/✗)**

```tsx
function KnowledgePage() {
  const coverage = useKnowledgeCoverage();
  if (!coverage.present) return <p>No knowledge.json — run /analyze in Cursor.</p>;

  return (
    <div>
      {coverage.categories.map((cat) => (
        <section key={cat.category}>
          <h3>
            {cat.label} ({cat.inGraph}/{cat.total} in graph)
          </h3>
          <table>
            <thead>
              <tr><th>In graph</th><th>Id</th><th>Title</th></tr>
            </thead>
            <tbody>
              {cat.rows.map((row) => (
                <tr key={row.id}>
                  <td>{row.inGraph ? "✓" : "✗"}</td>
                  <td>{row.id}</td>
                  <td>{String(row.data.title ?? row.data.name ?? "")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      ))}
    </div>
  );
}
```

**Impact panel**

```tsx
function ImpactPanel({ nodeId }: { nodeId: string }) {
  const project = useProject();
  const impact = useImpact(nodeId);
  if (!impact) return null;

  const openDoc = async (path: string) => {
    const res = await fetch(`/api/repo/file?path=${encodeURIComponent(path)}`);
    const { content } = await res.json();
    // open in modal / side panel
    console.log(content);
  };

  return (
    <div>
      <h3>Impact from {impact.origin.id}</h3>
      <h4>Regenerate ({impact.regenerate.length})</h4>
      <ul>
        {impact.regenerate.map((e) => (
          <li key={e.id}>
            {e.id} — {e.reason}
            {e.projectionPath && (
              <button onClick={() => openDoc(e.projectionPath!)}>
                Open {e.projectionPath}
              </button>
            )}
          </li>
        ))}
      </ul>
      <h4>Review ({impact.review.length})</h4>
      <ul>
        {impact.review.map((e) => (
          <li key={e.id}>{e.id} ({e.type})</li>
        ))}
      </ul>
      {impact.staleTranslations && impact.staleTranslations.length > 0 && (
        <>
          <h4>Stale translations</h4>
          {project.linkStaleTranslations(impact).map((link) => (
            <div key={link.impact.id}>
              {link.impact.id}: {link.jobs.length} pending job(s)
            </div>
          ))}
        </>
      )}
    </div>
  );
}
```

**Impact from file path (like CLI `--file`)**

```tsx
function ImpactFromFile({ filePath }: { filePath: string }) {
  const project = useProject();
  const impact = useMemo(() => {
    const origins = project.graph.resolveOrigins({ file: filePath });
    if (origins.length === 0) return null;
    return project.graph.impactFromOrigins(origins, { change: "file edited" });
  }, [project, filePath]);

  if (!impact) return <p>No traceability seed for {filePath}</p>;
  return <ImpactPanel nodeId={impact.origin.id} />;
}
```

**Translation queue dashboard**

```tsx
function TranslationQueuePage() {
  const project = useProject();
  const stats = project.translationQueueStats();
  const jobs = project.pendingTranslationJobs();

  if (!project.hasTranslationQueue() && stats.pending === 0) {
    return <p>No translation queue (single-language project?).</p>;
  }

  return (
    <div>
      <p>Pending: {stats.pending}, Failed: {stats.failed}</p>
      <ul>
        {jobs.map((job) => (
          <li key={job.id}>
            {job.docType}/{job.relativePath} — origin: {job.origin.lang},
            pending targets: {job.targets.filter((t) => t.status === "pending").map((t) => t.lang).join(", ")}
          </li>
        ))}
      </ul>
    </div>
  );
}
```

**Language switcher**

```tsx
function LanguageSwitcher() {
  const project = useProject();
  const langs = project.languages();
  if (langs.length <= 1) return null;

  return (
    <select>
      {langs.map((l) => (
        <option key={l.code} value={l.code}>{l.label}</option>
      ))}
    </select>
  );
}
```

---

## 6. Graph visualization (canvas)

The SDK does not ship a UI. Feed data into vis-network, cytoscape, d3, etc.

```ts
import {
  expandPathTargetNodes,
  nodesForVisualization,
} from "ai-spector-graph";

function buildVisData(project: ProjectSession, seedId: string) {
  const { nodes, edges } = project.graph.query(seedId, { depth: 2 });
  const nodeIds = new Set(nodes.map((n) => n.id));
  const expanded = expandPathTargetNodes(project.graph.graph, { nodeIds });

  const visNodes = nodesForVisualization(nodes, expanded).map((n) => ({
    id: n.id,
    label: "title" in n ? String(n.title ?? n.id) : n.label,
    group: n.type,
  }));

  const visEdges = [...edges, ...expanded.resolvedEdges].map((e) => ({
    from: e.from,
    to: e.to,
    label: e.type,
  }));

  return { visNodes, visEdges };
}
```

Path-target edges (`rendersTo`, `derivedFrom`) point at file paths — `expandPathTargetNodes` creates synthetic `file:` / `source:` nodes so edges do not dangle.

---

## 7. Feature recipes

### 7.1 Node search

```ts
import { findNodeIdsByText } from "ai-spector-graph";

const ids = findNodeIdsByText(project.graph.graph, "checkout", { limit: 10 });
```

### 7.2 Section label in UI

```ts
// Without registry: show raw id
// With registry:
const label = project.sectionLabel("sec.srs.en.02") ?? "sec.srs.en.02";
```

### 7.3 Patch preview (pending agent changes)

```ts
const patch = await fetch("/api/files/patch.json").then((r) => r.json());
const preview = project.simulatePatch(patch);
// preview.nodesToCreate, preview.edgesToAdd, preview.edgesSkipped
```

### 7.4 Layer audit with file existence from backend

```ts
const existsRes = await fetch("/api/repo/exists?paths=...");
const { paths } = await existsRes.json();
const report = project.layerAudit({
  existingPaths: new Set(paths.filter((p: { exists: boolean }) => p.exists).map((p: { path: string }) => p.path)),
});
```

### 7.5 Highlight impacted nodes on canvas

```ts
const impact = project.graph.impactFromNode("UC-01");
const highlighted = new Set([
  impact.origin.id,
  ...impact.regenerate.map((e) => e.id),
  ...impact.review.map((e) => e.id),
]);
```

---

## 8. Next.js notes

### App Router — client component

```tsx
"use client";

import { ProjectSession, DEFAULT_IMPACT_RULES } from "ai-spector-graph";
// … use hooks as above
```

Fetch from Route Handler:

```ts
// app/api/projects/[id]/traceability/route.ts
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const bundle = await loadBundleFromRepo(params.id);
  return Response.json(bundle);
}
```

### Server Component (optional)

You can run the SDK on the server — it has no browser-only APIs:

```ts
import { ProjectSession, DEFAULT_IMPACT_RULES } from "ai-spector-graph";
import { readFile } from "fs/promises";

export default async function Page() {
  const graph = JSON.parse(await readFile(".ai-spector/graph/traceability.graph.json", "utf8"));
  const project = ProjectSession.fromBundle({ graph, impactRules: DEFAULT_IMPACT_RULES });
  const stats = project.graph.stats();
  return <pre>{JSON.stringify(stats, null, 2)}</pre>;
}
```

For interactive impact/query UI, still prefer **client-side** `ProjectSession` after fetching the bundle.

---

## 9. Vite proxy (local dev)

```ts
// vite.config.ts
export default {
  server: {
    proxy: {
      "/api": "http://localhost:3001",
    },
  },
};
```

---

## 10. Error handling

| Error | Cause | Fix |
|-------|-------|-----|
| `Unknown node id` | `query()` / `impactFromNode()` on missing id | Check `project.graph.graph.nodesById.has(id)` first |
| `Impact rules required` | Impact called without `impactRules` | Pass `DEFAULT_IMPACT_RULES` or fetched rules to `fromBundle` |
| `Edge references missing node` | Corrupt graph JSON | Re-run `ai-spector index`; validate on backend before serving |
| `section-registry.json missing documents` | Bad registry payload | Fix registry file or omit `registry` field |
| Empty `knowledgeCoverage` | No knowledge or empty analyze | Show “Run /analyze in Cursor” |

```ts
try {
  const session = ProjectSession.fromBundle(bundle);
} catch (err) {
  // graph JSON invalid
  showError("Graph data is invalid. Re-index the project.");
}
```

---

## 11. Performance

- **Load bundle once** — cache with React Query / SWR (`staleTime: 60_000` or more).
- **Memoize** derived query/impact results (`useMemo` keyed on `seedId`).
- **Large graphs** (5000+ nodes) — impact already caps BFS at 500 nodes; subgraph query depth 2–3 is usually enough for UI.
- **Do not** stringify the whole graph into React state — keep `ProjectSession` in context/ref.

---

## 12. Security

- Authenticate API requests (Bearer, session cookie).
- Path allowlist on `/api/repo/file` — no `../` escape.
- Graph JSON may contain internal repo paths — do not expose bundle to unauthenticated users if sensitive.
- SDK is safe to run client-side **after** auth — it cannot write to repo or call arbitrary URLs.

---

## 13. CLI parity cheat sheet

| CLI | SDK |
|-----|-----|
| `graph query <id> --depth N` | `project.graph.query(id, { depth: N })` |
| `graph impact <id>` | `project.graph.impactFromNode(id)` |
| `graph impact --file <path>` | `resolveOrigins({ file })` → `impactFromOrigins()` |
| `graph impact --git` | Backend resolves seeds → `impactFromOrigins(seeds)` |
| `graph report` | `project.layerAudit({ existingPaths })` |
| `graph validate` (structure) | `project.validationIssues()` |
| `graph visualize` (knowledge tab) | `project.knowledgeCoverage()` |
| `graph merge` (preview only) | `project.simulatePatch(patch)` — read-only |

---

## 14. SDK versions

| Version | Features |
|---------|----------|
| **0.1** | `GraphSession`, query, impact, stats, `expandPathTargetNodes` |
| **0.2** | Knowledge stats/coverage, section registry, `ProjectSession` |
| **0.3** | Config, state, layer audit, patch simulate |
| **0.4** | Translation queue, health summary, stale→job linking |

```bash
npm install ai-spector-graph@^0.4.0
```

---

## 15. Complete minimal app (vanilla)

```html
<!DOCTYPE html>
<html>
<head>
  <script type="module">
    import { ProjectSession, DEFAULT_IMPACT_RULES } from "https://esm.sh/ai-spector-graph@0.4";

    const res = await fetch("/api/projects/demo/traceability");
    const data = await res.json();

    const project = ProjectSession.fromBundle({
      graph: data.graph,
      knowledge: data.knowledge,
      registry: data.registry,
      impactRules: DEFAULT_IMPACT_RULES,
    });

    const seed = data.graph.nodes.find((n) => n.type === "useCase")?.id;
    if (seed) {
      console.log("Subgraph", project.graph.query(seed, { depth: 1 }));
      console.log("Impact", project.graph.impactFromNode(seed));
    }
    console.log("Stats", project.graph.stats());
    console.log("Knowledge", project.knowledgeCoverage());
  </script>
</head>
<body>Open devtools console.</body>
</html>
```

---

## 16. Checklist — go live

### Backend
- [ ] `GET …/traceability` returns `graph` (required)
- [ ] Optional: knowledge, registry, config, state, translationQueue, impactRules
- [ ] `GET …/repo/file?path=` for markdown previews
- [ ] Auth + CORS configured
- [ ] Path traversal blocked on file API

### Frontend
- [ ] `npm install ai-spector-graph`
- [ ] `ProjectSession.fromBundle()` after fetch
- [ ] Session cached (not recreated each render)
- [ ] Error/loading states for failed fetch
- [ ] Impact rules: `DEFAULT_IMPACT_RULES` or API rules

### Verify
- [ ] `project.graph.stats().nodes > 0`
- [ ] `project.graph.query(<known-id>)` returns nodes
- [ ] `project.graph.impactFromNode(<domain-id>)` returns regenerate/review
- [ ] Knowledge tab shows ✓/✗ if `knowledge.json` present
- [ ] `project.sectionLabel(<section-id>)` returns heading if registry present

---

## 17. Related docs

- [API reference](./ai-spector-graph.md) — detailed method signatures
- [Expansion roadmap](./ai-spector-graph-expansion.md) — future SDK features
- [Web SDK plan](./plan-web-graph-viewer.md) — original architecture plan
- [npm package](https://www.npmjs.com/package/ai-spector-graph)
- [ai-spector CLI README](../README.md) — how graph JSON is produced

---

## 18. Support

- Graph empty or stale → run `npx ai-spector index` in the repo
- Analyze data missing → run `/analyze` in Cursor, then `graph merge --from-knowledge`
- SDK bug → [GitHub issues](https://github.com/milky-way-66/ai-spector/issues)
