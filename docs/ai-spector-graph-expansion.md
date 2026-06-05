# Expanding Web / SDK Data Sources

Suggestions for letting the frontend use **more than `traceability.graph.json`** — knowledge, registry, config, repo files, and workflow state. All fetched by **your backend API**; processed by **`ai-spector-graph`** (or a thin extension).

---

## Principle

```
Repo / .ai-spector files  →  Backend API (JSON/text)  →  Frontend fetch  →  SDK helpers
```

| Layer | Role |
|-------|------|
| Backend | Read repo; auth; path allowlist; optional git |
| Frontend | `fetch`; UI; caching (React Query, etc.) |
| SDK | Parse JSON; compare; stats; read-only graph logic |

Do **not** put HTTP in the SDK. Add **new pure modules** as data types grow.

---

## Tier 1 — High value, easy to add (recommend next)

### 1. `knowledge.json`

**Repo path:** `.ai-spector/.docflow/analysis/knowledge.json`  
**Role:** Staging output from `/analyze` — actors, use cases, features, requirements, entities **before** full graph merge.

**Web use cases:**

| Feature | Why |
|---------|-----|
| **Analyze progress panel** | Show counts: 12 use cases, 8 features — same as CLI visualize Knowledge tab |
| **Knowledge vs graph diff** | Highlight rows in knowledge not yet in graph (`inGraph: ✓/✗`) — parity with `graph-visualize` HTML |
| **Stale analyze warning** | Compare `knowledgeVersion` / counts vs graph domain node counts |

**SDK additions (pure, browser-safe):**

```ts
// Proposed exports in ai-spector-graph
export type { AnalysisKnowledge, KnowledgeActor, KnowledgeUseCase, ... };

export function isKnowledgePayload(data: unknown): data is AnalysisKnowledge;
export function computeKnowledgeStats(knowledge: AnalysisKnowledge | null): KnowledgeStats;
export function knowledgeGraphCoverage(
  knowledge: AnalysisKnowledge,
  graph: InMemoryGraph,
): { id: string; inGraph: boolean; type: string }[];
```

**FE fetch:**

```ts
const knowledge = await fetch("/api/files/knowledge.json").then(r => r.ok ? r.json() : null);
const coverage = knowledgeGraphCoverage(knowledge, session.graph);
```

**Note:** `knowledgeToPatch` stays CLI-only (write path). Web only **reads** and **compares**.

---

### 2. `section-registry.json`

**Repo path:** `.ai-spector/registry/section-registry.json`  
**Role:** Template → document/section ids and headings (SRS, basic-design structure).

**Web use cases:**

| Feature | Why |
|---------|-----|
| **Human labels in UI** | Show `sec.srs.en.02-actors` → heading "2. Actors" |
| **Document tree navigator** | Sidebar: documents → sections from registry + graph `contains` |
| **Empty section indicators** | Registry section exists but no graph `section` node yet |

**SDK additions:**

```ts
export type { SectionRegistry, RegistryDocument, RegistrySection };

export function parseSectionRegistry(json: unknown): SectionRegistry;
export function sectionLabel(registry: SectionRegistry, sectionId: string): string | undefined;
export function documentTree(registry: SectionRegistry): RegistryDocument[];
```

Registry is **read-only JSON** — no Node APIs needed.

---

### 3. `docflow.config.json`

**Repo path:** `.ai-spector/docflow.config.json`  
**Role:** Languages (`en`, `jp`, …), graph/registry path overrides.

**Web use cases:**

| Feature | Why |
|---------|-----|
| **Language switcher** | FE knows which `docs/srs/{lang}/` paths exist |
| **Correct API paths** | If graph path is customized, FE requests the right file |

**SDK additions:**

```ts
export interface DocflowConfig {
  version: number;
  languages: { code: string; label: string }[];
  paths: { graph: string; registry: string; templates: string };
}

export function parseDocflowConfig(json: unknown): DocflowConfig;
export function primaryLanguage(config: DocflowConfig): { code: string; label: string };
```

---

### 4. Repo markdown (via API, not in SDK)

**Paths:** `docs/srs/**`, `docs/basic-design/**`, `docs/data-source/**`

**Web use cases:**

| Feature | Why |
|---------|-----|
| **Projection preview** | Impact/query returns `projectionPath` → FE fetches markdown and renders |
| **Source traceability** | `derivedFrom` paths → show source chunk next to domain node |
| **Side-by-side** | Graph selection + live doc content |

**Pattern (FE only):**

```ts
const path = impact.regenerate[0]?.projectionPath;
if (path) {
  const md = await fetch(`/api/repo/file?path=${encodeURIComponent(path)}`).then(r => r.text());
}
```

SDK already returns paths via `projectionPathForNode`, `GraphQueryResult.projectionPaths`, `ImpactEntry.projectionPath`.

---

## Tier 2 — Workflow & health (medium effort)

### 5. `state.json`

**Repo path:** `.ai-spector/.docflow/state.json`  
**Role:** Timestamps — last index, analysis prep, source hashes.

**Web use cases:**

- “Graph indexed 2h ago” banner
- Stale data warning if `state.index.lastRunAt` older than graph `mtime` (BE can add graph `updatedAt` in API)

**SDK:** `parseProjectState(json)` + types only. No graph logic.

---

### 6. Layer audit (graph-only slice)

**CLI:** `ai-spector graph report`  
**Today:** Uses filesystem for `missingOnDisk` spec files.

**Web use cases:**

- Tri-layer health dashboard: structure / domain / source hub / business hub / provenance
- Suggested next command (read-only string)

**SDK additions (partial port of `layer-audit.ts`):**

```ts
export function auditGraphLayers(graph: InMemoryGraph): LayerAuditReport;
// Omit missingOnDisk[] unless BE sends file-existence map:
export function auditGraphLayers(
  graph: InMemoryGraph,
  opts?: { existingPaths?: Set<string> },
): LayerAuditReport;
```

Backend optional: `GET /api/repo/exists?paths=...` → `{ "docs/srs/en/uc-01.md": true }`.

---

### 7. Structural validation

**Already in SDK:** `session.graph.validateStructure()` → `ValidationIssue[]`

**Web use cases:**

- Validation panel in project settings
- Block “publish docs” if `DOMAIN-ANCHORED` errors

**Optional:** Browser Ajv for full schema validation against `schema.graph.json` (v2; rules in bundled JSON).

---

### 8. `semantic-links.patch.json` / `patch.json` (read-only preview)

**Repo path:** `.ai-spector/.docflow/extract/*.json`  
**Role:** Agent-proposed edges before merge.

**Web use cases:**

- “Pending graph changes” review UI
- Diff view: current graph vs patch overlay (read-only simulation)

**SDK additions:**

```ts
export function simulatePatch(
  graph: InMemoryGraph,
  patch: ExtractPatch,
): { addedNodes: GraphNode[]; addedEdges: GraphEdge[] };
// Does NOT mutate — returns what merge would add
```

Merge itself stays CLI-only.

---

## Tier 3 — Larger features (later)

### 9. Document indexes

**Repo path:** `.ai-spector/index/srs.md`, `basic-design.md`  
**Role:** Pre-built markdown summaries for agents.

**Web:** Render as HTML in a “Project index” page. FE fetches text; no SDK needed.

---

### 10. Translation queue

**Repo path:** `.ai-spector/.docflow/translation-queue/`  
**Files:** `pending.json`, `fingerprints.json`, `resolved/`, `failed/`

**Web use cases:**

- Translation job dashboard (multi-language projects)
- Link stale translations from `ImpactResult.staleTranslations` to queue jobs

**SDK:** New submodule `ai-spector-graph/translation` or separate `ai-spector-i18n` package.

---

### 11. Prototype manifest

**Repo path:** `prototype/manifest.json`, `screen-map.json`  
**Role:** Screen prototype — **separate subsystem** from traceability graph.

**Recommendation:** Separate npm package `ai-spector-prototype` if web needs it; don’t bloat graph SDK.

---

### 12. Git-based impact seeds

**CLI:** `graph impact --git`  
**Web:** Backend runs `git diff`, returns resolved seed ids or full `ImpactResult`.

```ts
// FE
const impact = await fetch("/api/graph/impact-from-diff", { method: "POST", body: diffText });
// Or BE returns seeds:
const seeds = await fetch("/api/graph/git-seeds").then(r => r.json());
const impact = session.impactFromOrigins(seeds);
```

---

## Suggested `ProjectSession` facade

Unify multi-file load on the frontend:

```ts
export interface ProjectBundle {
  graph: TraceabilityGraph;
  impactRules?: ImpactRulesFile;
  knowledge?: AnalysisKnowledge | null;
  registry?: SectionRegistry;
  config?: DocflowConfig;
  state?: ProjectState;
}

export class ProjectSession {
  static fromBundle(bundle: ProjectBundle): ProjectSession;

  readonly graph: GraphSession;

  knowledgeStats(): KnowledgeStats | null;
  knowledgeCoverage(): CoverageRow[];
  sectionLabel(sectionId: string): string;
  languages(): LanguageConfig[];
  layerAudit(opts?: { existingPaths?: Set<string> }): LayerAuditReport;
}
```

FE loads bundle:

```ts
const bundle = await fetch("/api/project/bundle").then(r => r.json());
const project = ProjectSession.fromBundle(bundle);
```

Backend aggregates one response — fewer round trips.

---

## API design for backend

### Option A — Per-file (simple)

```
GET /api/files/traceability.graph.json
GET /api/files/knowledge.json
GET /api/files/section-registry.json
GET /api/files/docflow.config.json
GET /api/repo/file?path=docs/srs/en/01-overview.md
```

### Option B — Project bundle (recommended for FE)

```
GET /api/project/traceability
→ {
    graph: TraceabilityGraph,
    knowledge: AnalysisKnowledge | null,
    registry: SectionRegistry,
    config: DocflowConfig,
    state: ProjectState,
    impactRules: ImpactRulesFile,
    meta: { graphUpdatedAt, indexUpdatedAt }
  }
```

### Option C — GraphQL / BFF

Single schema; FE requests only fields needed per screen.

---

## Recommended rollout

| Phase | Ship | SDK module |
|-------|------|------------|
| **Done** | Graph query, impact, stats, path nodes | `GraphSession` |
| **Done (v0.2)** | Knowledge stats + graph coverage diff | `knowledge.ts` |
| **Done (v0.2)** | Section registry labels + doc tree | `registry.ts` |
| **Done (v0.2)** | `ProjectSession` multi-file facade | `project.ts` |
| **Done (v0.3)** | `docflow.config.json` parser | `config.ts` |
| **Done (v0.3)** | `state.json` parser | `state.ts` |
| **Done (v0.3)** | Layer audit (graph-only + `existingPaths`) | `layer-audit.ts` |
| **Done (v0.3)** | Patch simulate (preview merge) | `patch.ts` |
| **Done (v0.4)** | Translation queue parse + stats + impact link | `translation-queue.ts` |
| **Done (v0.4)** | Graph health summary (validation + layers) | `health.ts` |
| **Later** | Translation queue, prototype | separate packages |

---

## What to keep CLI-only

| Capability | Reason |
|------------|--------|
| `merge`, `bootstrap`, `index` pipeline | Writes graph + filesystem |
| `doc-extract` (remark) | Heavy; belongs on BE if needed |
| Git hooks, pre-commit | Node + git |
| Ajv full schema validate | Optional v2 in browser |

---

## Summary

**Yes — web should use more than the graph file.** The highest-value additions are:

1. **`knowledge.json`** — analyze progress + “in graph?” coverage table  
2. **`section-registry.json`** — readable labels and doc tree  
3. **`docflow.config.json`** — languages and paths  
4. **Repo markdown via API** — projection previews (paths already come from SDK)  
5. **`ProjectSession`** — one bundle, one facade for FE  

See [ai-spector-graph usage](./ai-spector-graph.md) for current graph-only API.
