# Detail Design Parity — Design Spec

> **Status:** Approved  
> **Date:** 2026-06-17  
> **Scope:** ai-spector core — builtin detail design layer parity with SRS and basic design  
> **Approach:** A — mirror basic-design architecture  
> **Plan:** [`2026-06-17-detail-design-parity.md`](../plans/2026-06-17-detail-design-parity.md)

---

## 1. Problem

AI Spector ships scaffolding for detail design (templates, DAG, skill, routing, workflow slot) but the layer is **not operational at parity** with SRS and basic design:

| Capability | SRS | Basic design | Detail design (today) |
|------------|-----|--------------|------------------------|
| `documents-*.json` registry | ✓ | ✓ | ✗ |
| `dag.graph-seeds.json` | ✓ | ✓ | ✗ |
| Doc-extract → graph | ✓ | ✓ | ✗ |
| Index (`.ai-spector/index/*.md`) | ✓ | ✓ | ✗ |
| `readiness-criteria.json` | ✓ | partial (shared profiles) | ✗ |
| Per-layer writing guides (`*-context/`) | ✓ (`srs-context`) | ✓ (`bd-context`) | ✗ |
| Skill reference parity | ✓ | ✓ | thin |
| `summary-*` workflow step | ✓ | ✓ | ✗ |
| `graphUsage` for doc roots | ✓ | ✓ | ✗ |

Agents can route to `ai-spector-generate-detail-design`, but graph enrichment, index fallback, readiness assessment, and downstream impact behave inconsistently. Users with SRS + basic design cannot rely on detail design generation the same way they rely on the upstream layers.

**Validation:** The product owner will validate on a separate project; this spec covers **ai-spector product work only**.

---

## 2. Goals

| Goal | Detail |
|------|--------|
| **Full generate workflow** | Gated clarify → briefing → plan → DAG waves (common → feature list → per-feature), same gates as SRS/BD |
| **Graph parity** | `index` extracts `docs/detail-design/**` into `doc.dd.*` nodes, sections, and traceability edges |
| **Agent quality** | `dd-context/` guides, readiness criteria, output compliance — usable docs without heavy editing |
| **Pipeline integration** | `summary-detail-design`, workflow deps, `graphUsage` extended to `docs/detail-design/` |

### Success criteria (product)

1. `npx ai-spector index` enriches graph from `docs/detail-design/**`
2. `npx ai-spector check --path docs/detail-design/<lang>/features/f-01-*.md` respects TASK-003 when an approved `generate:detail-design` task is active
3. `readiness_assess({ docType: "detail-design" })` returns criteria per DAG node
4. Agent runbook: common wave → feature-list → per-feature, with **reindex after each wave**
5. `graph impact` after a detail-design edit lists dependent docs via existing impact logic

### Out of scope

- Custom template packs for detail design (`packs.detailDesign`) — future work, same pattern as SRS packs
- Overhaul of existing detail-design template **content** (headings/structure stay as shipped)
- External validation project setup

---

## 3. Architecture

### 3.1 Document registry (`documents-detail-design.json`)

New builtin manifest at package root (parallel to `documents-basic-design.json`):

```json
{
  "version": 1,
  "name": "detail-design",
  "packName": "builtin-detail-design",
  "nodePrefix": "doc.dd",
  "perDomainTemplates": {
    "featureDetail": "doc.dd.detail-feature"
  },
  "defaultListedIn": {
    "featureDetail": "doc.dd.feature-list"
  },
  "templatesDir": "templates/detail_design",
  "documents": [
    { "documentId": "doc.dd.architecture-overview", "template": "common/architecture-overview-template.md", "output": "docs/detail-design/common/architecture-overview.md" },
    { "documentId": "doc.dd.security-patterns", "template": "common/security-patterns-template.md", "output": "docs/detail-design/common/security-patterns.md" },
    { "documentId": "doc.dd.error-handling", "template": "common/error-handling-patterns-template.md", "output": "docs/detail-design/common/error-handling-patterns.md" },
    { "documentId": "doc.dd.performance-standards", "template": "common/performance-standards-template.md", "output": "docs/detail-design/common/performance-standards.md" },
    { "documentId": "doc.dd.integration-patterns", "template": "common/integration-patterns-template.md", "output": "docs/detail-design/common/integration-patterns.md" },
    { "documentId": "doc.dd.deployment", "template": "common/deployment-infrastructure-template.md", "output": "docs/detail-design/common/deployment-infrastructure.md" },
    { "documentId": "doc.dd.feature-list", "template": "feature-list-template.md", "output": "docs/detail-design/feature-list.md" }
  ]
}
```

Per-feature instance documents are **not** listed here — they are created by generation and registered at index time via doc-extract (same as `doc.bd.api-*` / `doc.bd.screen-*`).

**Code touchpoints:**

- `src/core/config/load.ts` — `loadDetailDesignListManifest()`
- `src/core/registry/build.ts` — `scanDetailDesignListDocuments()`; merge into registry bootstrap
- `src/core/adopt/classify.ts` — include DD manifest in classification
- `init` / template copy — already installs `templates/detail_design/`

### 3.2 DAG (unchanged structure)

Existing `scaffold/.ai-spector/.docflow/config/doc-types/detail-design/dag.json` is kept:

```
Wave 0 (parallel): dd.common.*  → docs/detail-design/{lang}/common/*.md
Wave 1:            dd.feature-list → feature-list.md
Wave 2:            dd.feature-details (mode: perFeature) → features/f-{nn}-{slug}.md
```

### 3.3 Graph seeds (`dag.graph-seeds.json`) — new

Path: `scaffold/.ai-spector/.docflow/config/doc-types/detail-design/dag.graph-seeds.json`

| DAG node | Graph seed | Rationale |
|----------|------------|-----------|
| `dd.common.architecture-overview` | `doc.bd.db-design` | Data/architecture context from BD |
| `dd.common.security-patterns` | `doc.srs.7-quality-attributes` | Security NFRs |
| `dd.common.error-handling` | `doc.srs.7-quality-attributes` | Error/reliability NFRs |
| `dd.common.performance-standards` | `doc.srs.7-quality-attributes` | Performance NFRs |
| `dd.common.integration-patterns` | `doc.srs.6-external-interfaces` | External systems |
| `dd.common.deployment` | `doc.bd.db-design` | Infra/data deployment context |
| `dd.feature-list` | `doc.srs.4-system-features` | Feature inventory |
| `dd.feature-details` | `doc.srs.4-system-features` | Per-feature expansion |

**`perDomain.perFeature` block** (mirror BD `perEndpoint` / `perScreen`):

```json
"perFeature": {
  "parentDagId": "dd.feature-details",
  "expandFrom": "doc.dd.feature-list",
  "listTableSection": "## 1. List of Features",
  "outputDir": "docs/detail-design/features/",
  "outputSlugFrom": "featureName",
  "oneFilePerRow": true,
  "graphNodeType": "feature",
  "documentPattern": "doc.dd.f-{id}"
}
```

**Per-feature generation (agent):**

1. After wave 1: `index({})` so `doc.dd.feature-list` is in the graph.
2. Read `feature-list.md` §1 table → one row per `F-xx`.
3. For each feature: `graph_query({ seedId: "F-01", depth: 4 })` — includes SRS feature detail, UCs, BD API/screen docs.
4. Write `features/f-01-{slug}.md` from template + graph context (never script over `knowledge.json`).
5. Wave-end merge: `contains` from `doc.dd.feature-list` → each `doc.dd.f-{id}`.

### 3.4 Defaults (`src/core/graph/defaults.ts`)

```ts
export const DEFAULT_DD_LIST_DOC = {
  featureList: "doc.dd.feature-list",
} as const;

export const PER_DOMAIN_TEMPLATE_DOC_DD = {
  feature: "doc.dd.detail-feature",
} as const;

export const DETAIL_DESIGN_LIST_DOCUMENT_IDS: ReadonlySet<string> = new Set(
  Object.values(DEFAULT_DD_LIST_DOC),
);
```

Add template shell node `doc.dd.detail-feature` with `outputPattern: "docs/detail-design/features/"`, `perDomain: "featureDetail"`.

### 3.5 Graph node model

| Node | Type | `perDomain` | Key edges |
|------|------|-------------|-----------|
| `doc.dd.feature-list` | document | — | `contains` → feature detail docs |
| `doc.dd.detail-feature` | document | `featureDetail` | template shell |
| `doc.dd.f-01` | document | `featureDetail` | `tracesTo` ← `F-01`; `partOf` → template |
| Section nodes | section | — | under feature detail docs |

Extend `detail-sections.ts` and `InMemoryGraph.ts` to treat `featureDetail` like `apiDetail` / `screenDetail`.

---

## 4. Doc-extract & graph traceability

### 4.1 File classification

New `classifyDetailDesignDetailFile(relativePath)` in `doc-extract.ts`:

| Path pattern | Kind | Handler |
|--------------|------|---------|
| `…/feature-list.md` | `null` | List chapter patch |
| `…/common/*.md` | `null` | Registry anchor only (sections from index if needed) |
| `…/features/f-{nn}-*.md` | `featureDetail` | Instance patch |

Language subfolder (`docs/detail-design/en/…`) is ignored for classification logic.

### 4.2 Document IDs

`documentIdForDetailDesignDetail(kind, relativePath, content)`:

1. Filename slug `f-{nn}` → `doc.dd.f-{nn}`
2. Else `**Feature ID:**` bold field
3. Else first `F-\d+` in body (normalized)

### 4.3 Instance patch (`buildDetailDesignDetailInstancePatch`)

Mirror `buildBasicDesignDetailInstancePatch`:

**Nodes:** `document` (`perDomain: "featureDetail"`, title from `**Feature Name:**` or `# Detail Design:`), plus section nodes from headings.

**Edges:**

| Edge | From | To |
|------|------|-----|
| `rendersTo` | `doc.dd.f-01` | file path |
| `rendersTo` | `doc.dd.detail-feature` | file path |
| `partOf` | `doc.dd.f-01` | `doc.dd.detail-feature` |
| `contains` | `doc.dd.feature-list` | `doc.dd.f-01` |
| `tracesTo` | `F-01` | `doc.dd.f-01` |

**Upstream links from markdown:**

- `F-\d+`, `UC-\d+` → existing domain nodes
- Paths/links to `basic-design/api/` and `basic-design/screens/` → `references` / `relatesTo` to `doc.bd.api-*` / `doc.bd.screen-*`
- Do not invent `satisfies` unless explicit in tables

### 4.4 List chapter (`feature-list.md`)

`detailDesignListChapterFileToPatch` — mirror BD list chapter:

- `contains` → each on-disk `doc.dd.f-{id}`
- Parse §1 table (`| F-01 | … |`) for list → instance linkage

### 4.5 Integration chain

```
detailFileToPatch()
  ├─ basicDesignListChapterFileToPatch()
  ├─ srsDetailFileToPatch()
  ├─ basicDesignDetailFileToPatch()
  └─ detailDesignDetailFileToPatch()   // NEW — try after BD, before empty return
```

**`doc-semantics.ts`:** add `detailDesign` source; extend `DocExtractResult` with `ddDetailDocuments`.

**Impact:** no new impact algorithm — existing `graph impact` works once edges exist.

---

## 5. Index & workflow pipeline

### 5.1 Index collection

**`index.docs.json`** (scaffold + init copy):

```json
{
  "outputs": {
    "detailDesign": ".ai-spector/index/detail-design.md"
  },
  "sources": {
    "detailDesign": {
      "root": "docs/detail-design",
      "glob": "**/*.md",
      "dag": ".ai-spector/.docflow/config/doc-types/detail-design/dag.json"
    }
  }
}
```

**`src/core/index/docs-build.ts`:**

- Add `detailDesign` to `DocIndexKind`, `DOC_INDEX_DEFAULT_ROOTS`, `DOC_INDEX_DEFAULT_OUTPUTS`, `DOC_INDEX_TITLES`

**`scaffold/.ai-spector/index/README.md`:** add row for `detail-design.md`.

### 5.2 `workflow.dependencies.json`

Add `summary-detail-design`:

```json
"summary-detail-design": {
  "command": "/summary detail-design",
  "requires": [],
  "checks": [
    {
      "id": "detail-design-any-files",
      "type": "hasFiles",
      "path": "docs/detail-design",
      "glob": "**/*.md",
      "min": 0,
      "warnIfBelow": 1,
      "warn": "No detail design files under docs/detail-design/ yet."
    }
  ],
  "onWarn": {
    "doFirst": ["/generate-detail-design"],
    "why": "Indexing is allowed but summaries need generated detail design files."
  }
}
```

Update pipeline:

```json
"pipeline": [
  "analyze",
  "generate-srs",
  "summary-srs",
  "generate-basic-design",
  "summary-basic-design",
  "generate-detail-design",
  "summary-detail-design"
]
```

Update `generate-detail-design.checks` — optional: require `detail-design` index when DD files exist (`indexPopulatedIfSourceHasFiles` pattern, mirror BD).

Update `graphUsage.rule` to include `docs/detail-design/`.

Update `indexUsage`:

```json
"afterGenerateDetailDesign": "/summary detail-design"
```

### 5.3 CLI / summary command

Ensure `npx ai-spector index` (or summary subcommand if separate) builds `detail-design.md` alongside srs and basic-design indexes. Wire through existing index pipeline in `src/core/index/`.

### 5.4 Task gates

TASK-003 already resolves `docs/detail-design/**` via `generateSlotFromDocPath` → `generate:detail-design`. No change required; add tests to confirm.

### 5.5 `generate-graph.md`

Add subsection **Detail design (perFeature)**:

- Read `feature-list.md` §1; one file per row under `docs/detail-design/features/`
- Seed = domain id `F-01`, not only chapter document
- Ingest `doc.dd.f-*` with `contains` from list chapter in wave-end merge

---

## 6. Agent quality

### 6.1 Readiness criteria

New file: `scaffold/.ai-spector/.docflow/config/doc-types/detail-design/readiness-criteria.json`

Lighter than SRS ISO mapping — focused on **implementation completeness**:

| DAG node | Blocking criteria (examples) |
|----------|------------------------------|
| `dd.common.*` | Confirm stack, deployment target, auth model, error strategy |
| `dd.feature-list` | Confirm full feature inventory matches graph `F-*` nodes |
| `dd.feature-details` | Per `F-xx`: confirm implementation approach, BD API/screen coverage, open technical decisions |

Structure: same `version` / `docType` / `targets[]` shape as SRS readiness file; criteria reference `graphProbe` and template headings.

Wire through existing `readiness_assess` + `loadMergedReadinessCriteria` for `docType: "detail-design"`.

### 6.2 Context store

On `init`, ensure empty `.ai-spector/.docflow/context/detail-design.json` (mirror SRS pattern if not already created by `context_list`).

### 6.3 `dd-context/` writing guides

Add under `ai-spector-generate-detail-design/references/dd-context/` (cursor + scaffold copies):

| File | Purpose |
|------|---------|
| `common-chapters.md` | Graph sources for architecture, security, error, performance, integration, deployment common docs |
| `feature-list.md` | How to build §1 table from graph `F-*` nodes; link convention to `features/f-{nn}-{slug}.md` |
| `feature-detail.md` | Per-feature: map template sections to SRS feature detail, BD APIs/screens, common chapters; sequence diagram rules |

Mirror tone/structure of `bd-context/api-detail.md` (graph query commands + section → source table).

### 6.4 Skill parity

Update `ai-spector-generate-detail-design/SKILL.md` to match basic-design skill:

| Situation | Load |
|-----------|------|
| Readiness assessment | `context-readiness.md` |
| Incremental continuation | `incremental-continuation.md` |
| Output compliance | `output-compliance.md` |
| Language not set | `language-picker.md` |
| Writing common chapters | `dd-context/common-chapters.md` |
| Writing feature list | `dd-context/feature-list.md` |
| Writing feature detail | `dd-context/feature-detail.md` |
| Large runs (10+ features) | `context-management.md` |

Update runbook checklist to reference `readiness_scan` + output compliance per wave.

### 6.5 Review & resolve-task

No new review doc types — `detail-design` already mapped in `doc-type.ts` and `discover.ts`. Ensure custom checklists doc mentions `detail-design/` paths (already in scaffold).

Resolve-task: incremental edits under `docs/detail-design/` follow existing resolve-task gate (unchanged).

---

## 7. Testing & acceptance

### 7.1 Unit tests

| Area | File | Cases |
|------|------|-------|
| Classification | `tests/graph/doc-extract-detail-design.test.ts` | path → `featureDetail` / null |
| Patch | same | nodes, `tracesTo`, `contains`, BD cross-links |
| Routing | `tests/graph/doc-extract.test.ts` | `detailFileToPatch` hits DD branch |
| Index | `tests/index/docs-build.test.ts` | `detailDesign` kind builds markdown |
| Registry | `tests/registry/build.test.ts` | DD list documents scanned |
| Workflow | `tests/workflow/dependencies.test.ts` | pipeline includes `summary-detail-design` |
| Task gate | `tests/operations/check.test.ts` | TASK-003 for `docs/detail-design/en/features/...` |
| Readiness | `tests/core/readiness-assess.test.ts` | `docType: "detail-design"` returns targets |

### 7.2 Integration fixture

Minimal fixture project under `tests/fixtures/detail-design-parity/`:

- `docs/srs/en/4-system-features.md` + one `features/f-01-*.md`
- `docs/basic-design/en/api-list.md` + `api/login.md`
- `docs/detail-design/en/common/architecture-overview.md`
- `docs/detail-design/en/feature-list.md`
- `docs/detail-design/en/features/f-01-checkout.md`

Run `index` → assert graph contains `doc.dd.f-01`, `tracesTo` from `F-01`, `contains` from list.

### 7.3 Manual acceptance checklist

```text
[ ] npx ai-spector init in clean project — DD templates + dag.graph-seeds present
[ ] readiness_assess({ docType: "detail-design" }) — criteria table shown
[ ] Full generate flow (agent): common → list → 1 feature — index after each wave
[ ] graph validate passes
[ ] graph impact --git after DD edit — shows linked nodes
[ ] review_begin for logical path detail-design/... — works
```

---

## 8. Implementation phases

Ordered to minimize broken intermediate states:

| Phase | Work | Delivers |
|-------|------|----------|
| **1 — Foundation** | `documents-detail-design.json`, `loadDetailDesignListManifest`, registry scan, `dag.graph-seeds.json`, `defaults.ts` | Bootstrap knows DD documents |
| **2 — Graph extract** | `classifyDetailDesignDetailFile`, patches, `doc-semantics` loop, `detail-sections` extensions | `index` enriches graph from DD files |
| **3 — Index & workflow** | `index.docs.json`, `docs-build.ts`, `summary-detail-design`, `workflow.dependencies.json`, `generate-graph.md` | Index file + pipeline |
| **4 — Agent quality** | `readiness-criteria.json`, `dd-context/*`, skill + runbook updates, scaffold sync | Agents produce usable DD |
| **5 — Tests & docs** | Unit + fixture tests, `CHANGELOG.md`, index README | Regression safety |

Each phase should pass existing `npm test` before merging.

### Primary files touched

```
documents-detail-design.json                          (new)
scaffold/.../detail-design/dag.graph-seeds.json       (new)
scaffold/.../detail-design/readiness-criteria.json  (new)
scaffold/.../workspace/index.docs.json
scaffold/.../workspace/workflow.dependencies.json
src/core/config/load.ts
src/core/registry/build.ts
src/core/graph/defaults.ts
src/core/graph/doc-extract.ts
src/core/graph/detail-sections.ts
src/core/index/docs-build.ts
src/core/index/doc-semantics.ts
.cursor/skills/ai-spector-generate-detail-design/     (+ dd-context/, SKILL.md, runbook.md)
scaffold/cursor/skills/...                            (mirror)
scaffold/claude/.claude/skills/...                    (mirror)
tests/...
CHANGELOG.md
```

---

## 9. Risks & mitigations

| Risk | Mitigation |
|------|------------|
| Feature detail template is very long (~700 lines) | `dd-context/feature-detail.md` prioritizes mandatory sections; output-compliance allows TBD only where marked |
| Duplicate content vs BD API specs | Feature detail **references** BD endpoint docs; embeds implementation-specific detail (sequences, component boundaries) — documented in `feature-detail.md` |
| `perFeature` not in generate-graph until phase 3 | Phase 2 can land without agent doc; phase 4 blocks “done” |
| Registry build time | DD adds 7 list templates — negligible vs SRS+BD |

---

## 10. Future work (explicitly deferred)

- `packs.detailDesign` + `ai-spector-generate-<pack>` for custom DD layouts
- `documents-detail-design.json` pack import via template-import
- CocoIndex / semantic search tuning for DD-heavy queries
