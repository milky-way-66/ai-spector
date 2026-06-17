# Detail Design Parity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bring builtin detail design to parity with SRS and basic design — registry, graph seeds, doc-extract, index, readiness, agent guides, and workflow integration.

**Architecture:** Mirror the basic-design layer: `documents-detail-design.json` + `dag.graph-seeds.json` for bootstrap; `classifyDetailDesignDetailFile` + instance patches in `doc-extract.ts`; `detailDesignAnchorStructurePatch` at index time; extend index pipeline and `workflow.dependencies.json`; add `readiness-criteria.json` and `dd-context/` for agent quality.

**Tech Stack:** TypeScript, Vitest, existing `index` / `graph merge` / `readiness_assess` / scaffold copy via `init`.

**Spec:** [`docs/superpowers/specs/2026-06-17-detail-design-parity-design.md`](../specs/2026-06-17-detail-design-parity-design.md)

---

## File map

| File | Responsibility |
|------|----------------|
| `documents-detail-design.json` | Builtin DD list-chapter registry (7 documents) |
| `scaffold/.../detail-design/dag.graph-seeds.json` | DAG → graph seeds + `perFeature` expansion |
| `scaffold/.../detail-design/readiness-criteria.json` | Readiness targets per DAG node |
| `scaffold/.../workspace/index.docs.json` | `detailDesign` source + output |
| `scaffold/.../workspace/workflow.dependencies.json` | `summary-detail-design`, pipeline, graphUsage |
| `src/core/config/load.ts` | `loadDetailDesignListManifest()` |
| `src/core/registry/build.ts` | `scanDetailDesignListDocuments()` |
| `src/core/graph/defaults.ts` | `DEFAULT_DD_LIST_DOC`, `PER_DOMAIN_TEMPLATE_DOC_DD` |
| `src/core/graph/doc-extract.ts` | Classify + patch DD files |
| `src/core/graph/detail-sections.ts` | DD list chapter + `featureDetail` instance detection |
| `src/core/index/docs-build.ts` | `detailDesign` index kind |
| `src/core/index/docs-config.ts` | Extend `outputs` type |
| `src/core/index/doc-semantics.ts` | Scan `docs/detail-design/` |
| `src/core/operations/index.ts` | Build `detail-design.md` index |
| `src/core/readiness/config.ts` | Add `detail-design` to `DEFAULT_DOC_TYPES` |
| `src/core/readiness/criteria-path.ts` | Resolve DD criteria path |
| `src/core/readiness/scan-docs.ts` | List DD markdown for assess |
| `.cursor/skills/ai-spector-generate-detail-design/` | SKILL, runbook, `dd-context/*` |
| `scaffold/cursor/skills/...` | Mirror cursor skills |
| `scaffold/claude/.claude/skills/...` | Mirror claude skills (or `npm run build:claude-scaffold`) |
| `tests/graph/doc-extract-detail-design.test.ts` | DD extract unit tests |
| `tests/fixtures/detail-design-parity/` | Integration fixture |
| `package.json` | Add `documents-detail-design.json` to `files` |
| `CHANGELOG.md` | Unreleased entry |

---

### Task 1: Detail design document manifest

**Files:**
- Create: `documents-detail-design.json`
- Modify: `src/core/config/load.ts`
- Modify: `package.json` (`files` array)
- Test: `tests/core/load-detail-design-manifest.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// tests/core/load-detail-design-manifest.test.ts
import { describe, expect, it } from "vitest";
import { loadDetailDesignListManifest } from "@/core/config/load.js";

describe("loadDetailDesignListManifest", () => {
  it("loads builtin detail design documents", async () => {
    const manifest = await loadDetailDesignListManifest();
    expect(manifest.nodePrefix).toBe("doc.dd");
    expect(manifest.perDomainTemplates?.featureDetail).toBe("doc.dd.detail-feature");
    const ids = manifest.documents.map((d) => d.documentId);
    expect(ids).toContain("doc.dd.feature-list");
    expect(ids).toContain("doc.dd.architecture-overview");
    expect(manifest.documents).toHaveLength(7);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/core/load-detail-design-manifest.test.ts`  
Expected: FAIL — `loadDetailDesignListManifest` not exported

- [ ] **Step 3: Create manifest and loader**

Create `documents-detail-design.json` at repo root (content from spec §3.1).

Add to `src/core/config/load.ts`:

```typescript
export async function loadDetailDesignListManifest(): Promise<DocumentsManifest> {
  const bundleRoot = packageBundleRoot();
  const manifest = await readJson<DocumentsManifest>(
    join(bundleRoot, "documents-detail-design.json"),
  );
  if (!manifest.templatesDir || !Array.isArray(manifest.documents)) {
    throw new Error(`Invalid documents-detail-design.json in ${bundleRoot}`);
  }
  return manifest;
}
```

Add `"documents-detail-design.json"` to `package.json` → `files`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- tests/core/load-detail-design-manifest.test.ts`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add documents-detail-design.json src/core/config/load.ts package.json tests/core/load-detail-design-manifest.test.ts
git commit -m "feat: add documents-detail-design.json manifest and loader"
```

---

### Task 2: Graph seeds and defaults

**Files:**
- Create: `scaffold/.ai-spector/.docflow/config/doc-types/detail-design/dag.graph-seeds.json`
- Modify: `src/core/graph/defaults.ts`
- Test: `tests/graph/detail-design-defaults.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// tests/graph/detail-design-defaults.test.ts
import { describe, expect, it } from "vitest";
import {
  DEFAULT_DD_LIST_DOC,
  DETAIL_DESIGN_LIST_DOCUMENT_IDS,
  PER_DOMAIN_TEMPLATE_DOC_DD,
} from "@/core/graph/defaults.js";

describe("detail design defaults", () => {
  it("exports list and template doc ids", () => {
    expect(DEFAULT_DD_LIST_DOC.featureList).toBe("doc.dd.feature-list");
    expect(PER_DOMAIN_TEMPLATE_DOC_DD.feature).toBe("doc.dd.detail-feature");
    expect(DETAIL_DESIGN_LIST_DOCUMENT_IDS.has("doc.dd.feature-list")).toBe(true);
  });
});
```

- [ ] **Step 2: Run test — expect FAIL**

Run: `npm test -- tests/graph/detail-design-defaults.test.ts`

- [ ] **Step 3: Implement defaults + graph seeds file**

`defaults.ts` additions per spec §3.4.

Create `dag.graph-seeds.json` per spec §3.3 (`seeds`, `perDomain.perFeature`, `documentNodes` for list + common chapters).

- [ ] **Step 4: Run test — expect PASS**

- [ ] **Step 5: Commit**

```bash
git add src/core/graph/defaults.ts scaffold/.ai-spector/.docflow/config/doc-types/detail-design/dag.graph-seeds.json tests/graph/detail-design-defaults.test.ts
git commit -m "feat: add detail design graph seeds and default doc ids"
```

---

### Task 3: Registry scan for detail design list documents

**Files:**
- Modify: `src/core/registry/build.ts`
- Modify: `src/core/config/load.ts` (`resolveActiveManifests`)
- Test: `tests/registry/detail-design-scan.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// tests/registry/detail-design-scan.test.ts
import { describe, expect, it } from "vitest";
import { mkdtemp, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { writeJson } from "../helpers/write-json.js";
import { scanDetailDesignListDocuments } from "@/core/registry/build.js";

describe("scanDetailDesignListDocuments", () => {
  it("scans seven detail design list templates", async () => {
    const root = await mkdtemp(join(tmpdir(), "dd-scan-"));
    await mkdir(join(root, ".ai-spector/templates/detail_design/common"), { recursive: true });
    await writeJson(join(root, ".ai-spector/docflow.config.json"), {
      version: 1,
      languages: [{ code: "en", label: "English" }],
      paths: { templates: ".ai-spector/templates" },
      packs: { srs: "builtin", basicDesign: "builtin" },
    });
    const docs = await scanDetailDesignListDocuments(root);
    expect(docs.length).toBe(7);
    expect(docs.some((d) => d.documentId === "doc.dd.feature-list")).toBe(true);
  });
});
```

(Use existing test helper pattern from other registry tests if `write-json` helper differs.)

- [ ] **Step 2: Run test — expect FAIL**

- [ ] **Step 3: Implement `scanDetailDesignListDocuments`**

In `build.ts`:
- Extend `resolveTemplatesSubdir` subfolder union: `"srs" | "basic_design" | "detail_design"`
- Add `scanDetailDesignListDocuments` mirroring `scanBasicDesignListDocuments` but calling `loadDetailDesignListManifest()`

In `load.ts` → `resolveActiveManifests`, append third entry:

```typescript
const ddEntry = await resolvePackManifest(root, "builtin", async () => {
  const bundleRoot = packageBundleRoot();
  const manifest = await loadDetailDesignListManifest();
  return { bundleRoot, manifest };
});
return [srsEntry, bdEntry, ddEntry];
```

- [ ] **Step 4: Run test — expect PASS**

- [ ] **Step 5: Commit**

```bash
git add src/core/registry/build.ts src/core/config/load.ts tests/registry/detail-design-scan.test.ts
git commit -m "feat: scan detail design list documents for registry bootstrap"
```

---

### Task 4: Doc-extract — classify and patch detail design files

**Files:**
- Modify: `src/core/graph/doc-extract.ts`
- Modify: `src/core/graph/detail-sections.ts`
- Modify: `src/core/graph/InMemoryGraph.ts` (if `featureDetail` not recognized)
- Create: `tests/graph/doc-extract-detail-design.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
// tests/graph/doc-extract-detail-design.test.ts
import { describe, expect, it } from "vitest";
import {
  classifyDetailDesignDetailFile,
  detailDesignDetailFileToPatch,
  detailFileToPatch,
} from "@/core/graph/doc-extract.js";

describe("classifyDetailDesignDetailFile", () => {
  it("classifies feature detail paths and skips list/common", () => {
    expect(classifyDetailDesignDetailFile("docs/detail-design/feature-list.md")).toBeNull();
    expect(classifyDetailDesignDetailFile("docs/detail-design/en/common/architecture-overview.md")).toBeNull();
    expect(
      classifyDetailDesignDetailFile("docs/detail-design/en/features/f-01-checkout.md"),
    ).toBe("featureDetail");
  });
});

describe("detailDesignDetailFileToPatch", () => {
  it("emits doc.dd.f-01 with tracesTo and contains from list", () => {
    const patch = detailDesignDetailFileToPatch(
      "docs/detail-design/en/features/f-01-checkout.md",
      `# Detail Design: Checkout

**Feature Name:** Checkout

## 1. Feature Implementation Overview
`,
    );
    expect(patch.nodes.some((n) => n.id === "doc.dd.f-01")).toBe(true);
    expect(patch.edges).toContainEqual({
      type: "tracesTo",
      from: "F-01",
      to: "doc.dd.f-01",
    });
    expect(patch.edges).toContainEqual({
      type: "contains",
      from: "doc.dd.feature-list",
      to: "doc.dd.f-01",
    });
  });
});

describe("detailFileToPatch routes detail design", () => {
  it("handles detail design after basic design branch", () => {
    const patch = detailFileToPatch(
      "docs/detail-design/en/features/f-02-login.md",
      `**Feature Name:** Login\n\n## 1. Feature Implementation Overview\n`,
    );
    expect(patch.nodes.some((n) => n.id === "doc.dd.f-02")).toBe(true);
  });
});
```

- [ ] **Step 2: Run tests — expect FAIL**

Run: `npm test -- tests/graph/doc-extract-detail-design.test.ts`

- [ ] **Step 3: Implement extraction**

In `doc-extract.ts`:

1. `export type DetailDesignDetailKind = "featureDetail"`
2. `classifyDetailDesignDetailFile(relativePath)` — path rules from spec §4.1
3. `documentIdForDetailDesignDetail(kind, relativePath, content)` — slug from `f-{nn}` filename
4. `extractDetailDesignDetailMeta(content, relativePath)` — title from `**Feature Name:**`, feature id from filename/body
5. `buildDetailDesignDetailInstancePatch(...)` — mirror BD patch; `perDomain: "featureDetail"`
6. `detailDesignListChapterFileToPatch` — delegate to new helper in `detail-sections.ts` for `feature-list.md`
7. `detailDesignPerDomainTemplateNodes()` — template shell node
8. `detailDesignAnchorStructurePatch(projectRoot)` — mirror `basicDesignAnchorStructurePatch`
9. Update `detailFileToPatch` to call DD branch before empty return
10. Extend `DocExtractResult` with `ddDetailDocuments`; increment in `buildDocExtractPatch`

In `detail-sections.ts`:
- `detailDesignListChapterDocumentId(relativePath)`
- `detailDesignListChapterFileToPatch`
- Extend `isPerDomainInstanceDocument` for `featureDetail` + `/features/` path
- `isDetailDesignListChapterDocumentId` + section upsert allowance

Scan BD API/screen markdown links in DD content for `references` edges to `doc.bd.api-*` / `doc.bd.screen-*`.

- [ ] **Step 4: Run tests — expect PASS**

Run: `npm test -- tests/graph/doc-extract-detail-design.test.ts tests/graph/doc-extract.test.ts`

- [ ] **Step 5: Commit**

```bash
git add src/core/graph/doc-extract.ts src/core/graph/detail-sections.ts src/core/graph/InMemoryGraph.ts tests/graph/doc-extract-detail-design.test.ts
git commit -m "feat: doc-extract for detail design feature files and list chapter"
```

---

### Task 5: Doc-semantics index integration

**Files:**
- Modify: `src/core/index/doc-semantics.ts`
- Test: extend `tests/graph/doc-extract-detail-design.test.ts` or add `tests/index/doc-semantics-detail-design.test.ts`

- [ ] **Step 1: Write failing integration test**

Fixture markdown under temp dir with `docs/detail-design/en/features/f-01-x.md`; run `runDocSemanticMerge`; assert graph patch includes `doc.dd.f-01`.

- [ ] **Step 2: Run test — expect FAIL**

- [ ] **Step 3: Wire doc-semantics**

In `doc-semantics.ts`:
- Loop `["srs", "basicDesign", "detailDesign"]`
- After BD structure patch, call `detailDesignAnchorStructurePatch` when DD list chapters need sections (mirror BD pattern)
- Update stats logging for `ddDetailDocuments`

- [ ] **Step 4: Run test — expect PASS**

- [ ] **Step 5: Commit**

```bash
git add src/core/index/doc-semantics.ts tests/index/doc-semantics-detail-design.test.ts
git commit -m "feat: index doc-semantics scans docs/detail-design"
```

---

### Task 6: Index collection and workflow dependencies

**Files:**
- Modify: `scaffold/.ai-spector/.docflow/config/workspace/index.docs.json`
- Modify: `src/core/index/docs-build.ts`
- Modify: `src/core/index/docs-config.ts`
- Modify: `src/core/operations/index.ts`
- Modify: `scaffold/.ai-spector/.docflow/config/workspace/workflow.dependencies.json`
- Modify: `scaffold/.ai-spector/index/README.md`
- Test: `tests/index/detail-design-index.test.ts`

- [ ] **Step 1: Write failing test**

```typescript
// tests/index/detail-design-index.test.ts
import { describe, expect, it } from "vitest";
import { buildDocIndex, DOC_INDEX_DEFAULT_OUTPUTS } from "@/core/index/docs-build.js";

describe("detail design doc index", () => {
  it("includes detailDesign in default outputs", () => {
    expect(DOC_INDEX_DEFAULT_OUTPUTS.detailDesign).toBe(
      ".ai-spector/index/detail-design.md",
    );
  });

  it("builds index markdown for detail design files", async () => {
    const built = await buildDocIndex({
      kind: "detailDesign",
      config: {
        outputs: { srs: "", basicDesign: "", detailDesign: ".ai-spector/index/detail-design.md" },
        sources: { detailDesign: { root: "docs/detail-design" } },
      },
      projectRoot: "/tmp",
      files: [{
        relativePath: "docs/detail-design/en/feature-list.md",
        absolutePath: "/tmp/docs/detail-design/en/feature-list.md",
        basename: "feature-list.md",
        sizeBytes: 10,
        contentHash: "abc",
      }],
      graph: null,
    });
    expect(built.title).toContain("Detail Design");
    expect(built.markdown).toContain("feature-list.md");
  });
});
```

- [ ] **Step 2: Run test — expect FAIL**

- [ ] **Step 3: Implement index + workflow**

`docs-build.ts`: add `detailDesign` to all `DocIndexKind` records; title `"Detail Design Document Index"`.

`docs-config.ts`: add optional `detailDesign` to `outputs` type.

`index.ts`: add `"detailDesign"` to index loop (after `basicDesign`).

`index.docs.json`: add `detailDesign` source/output per spec §5.1.

`workflow.dependencies.json`:
- Add `summary-detail-design` block
- Append to `pipeline`
- Extend `graphUsage.rule` with `docs/detail-design/`
- Add `indexUsage.afterGenerateDetailDesign`

`index/README.md`: add `detail-design.md` row.

- [ ] **Step 4: Run test — expect PASS**

- [ ] **Step 5: Commit**

```bash
git add scaffold/.ai-spector/.docflow/config/workspace/index.docs.json scaffold/.ai-spector/.docflow/config/workspace/workflow.dependencies.json scaffold/.ai-spector/index/README.md src/core/index/docs-build.ts src/core/index/docs-config.ts src/core/operations/index.ts tests/index/detail-design-index.test.ts
git commit -m "feat: detail design document index and workflow pipeline step"
```

---

### Task 7: Readiness criteria for detail design

**Files:**
- Create: `scaffold/.ai-spector/.docflow/config/doc-types/detail-design/readiness-criteria.json`
- Modify: `src/core/readiness/criteria-path.ts`
- Modify: `src/core/readiness/config.ts`
- Modify: `src/core/readiness/scan-docs.ts`
- Test: `tests/core/readiness-detail-design.test.ts`

- [ ] **Step 1: Write failing test**

```typescript
// tests/core/readiness-detail-design.test.ts
import { describe, expect, it } from "vitest";
import { mkdtemp, mkdir, copyFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { packageBundleRoot } from "@/core/config/load.js";
import { resolveCriteriaFilePath } from "@/core/readiness/criteria-path.js";
import { writeJson } from "../helpers/write-json.js";

describe("detail design readiness", () => {
  it("resolves builtin detail-design criteria path", async () => {
    const root = await mkdtemp(join(tmpdir(), "dd-ready-"));
    const cfgDir = join(root, ".ai-spector/.docflow/config/doc-types/detail-design");
    await mkdir(cfgDir, { recursive: true });
    const src = join(
      packageBundleRoot(),
      "scaffold/.ai-spector/.docflow/config/doc-types/detail-design/readiness-criteria.json",
    );
    await copyFile(src, join(cfgDir, "readiness-criteria.json"));
    await writeJson(join(root, ".ai-spector/docflow.config.json"), {
      version: 1,
      languages: [{ code: "en", label: "English" }],
      packs: { srs: "builtin", basicDesign: "builtin" },
    });
    const resolved = await resolveCriteriaFilePath(root, (await import("@/core/config/load.js")).loadDocflowConfig(root).then(r => r.config), "detail-design");
    expect(resolved.docType).toBe("detail-design");
    expect(resolved.path).toContain("detail-design/readiness-criteria.json");
  });
});
```

- [ ] **Step 2: Run test — expect FAIL**

- [ ] **Step 3: Create criteria file and wire resolution**

`readiness-criteria.json` structure:

```json
{
  "version": 1,
  "docType": "detail-design",
  "globalCriteria": [],
  "targets": [
    {
      "dagNode": "dd.feature-list",
      "criteria": [{
        "id": "DD-FL-001",
        "severity": "blocking",
        "question": "Confirm the complete feature inventory (F-xx ids + titles) matches the traceability graph.",
        "graphProbe": "graph nodes where type === \"feature\""
      }]
    },
    {
      "dagNode": "dd.feature-details",
      "perEntity": "feature",
      "criteria": [{
        "id": "DD-FD-001",
        "severity": "blocking",
        "question": "For each feature, confirm implementation approach and which BD API/screen docs apply.",
        "perEntity": "feature"
      }]
    }
  ]
}
```

Add targets for each `dd.common.*` node with one blocking question each (stack, auth model, error strategy, etc.).

`criteria-path.ts` — add early return:

```typescript
if (effectiveDocType === "detail-design") {
  return {
    path: docTypeReadinessCriteriaPath(root, "detail-design"),
    docType: "detail-design",
    packName: null,
  };
}
```

`config.ts`: `DEFAULT_DOC_TYPES = ["srs", "basic-design", "detail-design"]`

`scan-docs.ts`: handle `docType === "detail-design"` → `docs/detail-design/{lang}`

- [ ] **Step 4: Run test — expect PASS**

Run: `npm test -- tests/core/readiness-detail-design.test.ts`

- [ ] **Step 5: Commit**

```bash
git add scaffold/.ai-spector/.docflow/config/doc-types/detail-design/readiness-criteria.json src/core/readiness/criteria-path.ts src/core/readiness/config.ts src/core/readiness/scan-docs.ts tests/core/readiness-detail-design.test.ts
git commit -m "feat: readiness criteria for detail design doc type"
```

---

### Task 8: Agent guides and skill parity

**Files:**
- Create: `.cursor/skills/ai-spector-generate-detail-design/references/dd-context/common-chapters.md`
- Create: `.cursor/skills/ai-spector-generate-detail-design/references/dd-context/feature-list.md`
- Create: `.cursor/skills/ai-spector-generate-detail-design/references/dd-context/feature-detail.md`
- Modify: `.cursor/skills/ai-spector-generate-detail-design/SKILL.md`
- Modify: `.cursor/skills/ai-spector-generate-detail-design/references/runbook.md`
- Modify: `.cursor/skills/ai-spector/references/generate-graph.md`
- Copy to `scaffold/cursor/skills/...` and run `npm run build:claude-scaffold` OR mirror `scaffold/claude` manually

- [ ] **Step 1: Add `dd-context` guides**

`common-chapters.md` — graph query seeds per common DAG node; section → graph source table (mirror `bd-context/api-detail.md` tone).

`feature-list.md` — build §1 table from graph `F-*` nodes; link pattern `features/f-{nn}-{slug}.md`.

`feature-detail.md` — per-feature graph query (`F-01`, depth 4); map template sections to SRS feature detail + BD APIs/screens + common chapters; rule: reference BD specs, add implementation detail (sequences, components).

- [ ] **Step 2: Update SKILL.md**

Add rows matching `ai-spector-generate-basic-design/SKILL.md`:

- `context-readiness.md`, `incremental-continuation.md`, `output-compliance.md`, `language-picker.md`, `context-management.md`
- `dd-context/*` for writing phases

- [ ] **Step 3: Update runbook + generate-graph.md**

Runbook: add readiness_scan + output compliance per wave.

`generate-graph.md` — new subsection **Detail design (perFeature)** per spec §5.5.

- [ ] **Step 4: Sync scaffold**

```bash
cp -R .cursor/skills/ai-spector-generate-detail-design/references/dd-context scaffold/cursor/skills/ai-spector-generate-detail-design/references/
cp .cursor/skills/ai-spector-generate-detail-design/SKILL.md scaffold/cursor/skills/ai-spector-generate-detail-design/
cp .cursor/skills/ai-spector-generate-detail-design/references/runbook.md scaffold/cursor/skills/ai-spector-generate-detail-design/references/
cp .cursor/skills/ai-spector/references/generate-graph.md scaffold/cursor/skills/ai-spector/references/
npm run build:claude-scaffold
```

- [ ] **Step 5: Commit**

```bash
git add .cursor/skills/ai-spector-generate-detail-design .cursor/skills/ai-spector/references/generate-graph.md scaffold/cursor/skills scaffold/claude/.claude/skills
git commit -m "docs: detail design agent guides and skill parity"
```

---

### Task 9: TASK-003 check and integration fixture

**Files:**
- Modify: `tests/operations/check.test.ts` (or create `tests/operations/check-detail-design.test.ts`)
- Create: `tests/fixtures/detail-design-parity/` (minimal SRS + BD + DD markdown)
- Test: `tests/graph/detail-design-parity.integration.test.ts`

- [ ] **Step 1: Add TASK-003 test**

Assert `generateSlotFromDocPath("docs/detail-design/en/features/f-01-x.md")` → `generate:detail-design` (may already exist — add explicit test if missing).

- [ ] **Step 2: Create fixture + integration test**

Fixture files:
- `docs/srs/en/4-system-features.md` with F-01 row
- `docs/basic-design/en/api-list.md`
- `docs/detail-design/en/feature-list.md`
- `docs/detail-design/en/features/f-01-checkout.md`

Run `buildDocExtractPatch` or `runDocSemanticMerge` on fixture; assert `doc.dd.f-01` node and `tracesTo` from `F-01`.

- [ ] **Step 3: Run full test suite**

Run: `npm test`  
Expected: all pass

- [ ] **Step 4: Commit**

```bash
git add tests/fixtures/detail-design-parity tests/graph/detail-design-parity.integration.test.ts tests/operations/check-detail-design.test.ts
git commit -m "test: detail design parity integration fixture"
```

---

### Task 10: CHANGELOG and spec cross-links

**Files:**
- Modify: `CHANGELOG.md`
- Modify: `docs/superpowers/specs/2026-06-17-detail-design-parity-design.md` (link to plan)

- [ ] **Step 1: Add CHANGELOG entry under `[Unreleased]` → `Added`**

```markdown
- **Detail design parity** — `documents-detail-design.json`, graph seeds, doc-extract for `docs/detail-design/features/`, `.ai-spector/index/detail-design.md`, `readiness-criteria.json`, `dd-context/` agent guides, `summary-detail-design` workflow step.
```

- [ ] **Step 2: Link plan from spec**

Add under spec header: `**Plan:** [2026-06-17-detail-design-parity.md](../plans/2026-06-17-detail-design-parity.md)`

- [ ] **Step 3: Final verification**

```bash
npm run build
npm test
```

- [ ] **Step 4: Commit**

```bash
git add CHANGELOG.md docs/superpowers/specs/2026-06-17-detail-design-parity-design.md
git commit -m "docs: changelog for detail design parity"
```

---

## Spec coverage checklist

| Spec section | Task |
|--------------|------|
| §3 Registry + seeds | 1, 2, 3 |
| §4 Doc-extract | 4, 5 |
| §5 Index + workflow | 6 |
| §6 Agent quality | 7, 8 |
| §7 Testing | 1–9 |
| §8 Phases | Tasks ordered 1→10 |

## Execution handoff

Plan saved to `docs/superpowers/plans/2026-06-17-detail-design-parity.md`.

**Two execution options:**

1. **Subagent-driven (recommended)** — fresh subagent per task, review between tasks  
2. **Inline execution** — implement tasks in this session with checkpoints

Which approach do you want?
