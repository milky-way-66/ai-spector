# Queue Drift Engine Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Unify translation and review queues with the layer sync audit drift model — git-anchored `DocAnchor` on reconcile, lazy `EnrichmentCache` (git diff + graph impact + optional `layerDrift`) on queue read, legacy snapshot fallback until resolve.

**Architecture:** Extend `src/core/sync/` with `drift-types.ts` and `enrich.ts`. Translation reconcile stops writing `content` and inline diffs; stores anchors only. `runLangQueuePending` and `runReviewQueue` call enrich on read (cached on job). Review quorum writes `baselineAnchor` instead of new snapshot files (legacy fallback retained).

**Tech Stack:** TypeScript, Vitest, existing `git-diff.ts`, `computeAuditImpact`, translation queue (`src/core/lang/`), review queue (`src/core/reviews/`).

**Spec:** [`docs/superpowers/specs/2026-06-19-queue-drift-engine-design.md`](../specs/2026-06-19-queue-drift-engine-design.md)

---

## File map

| File | Responsibility |
|------|----------------|
| `src/core/sync/drift-types.ts` | `DocAnchor`, `EnrichmentCache`, `ImpactBuckets`, `LayerDriftSummary` |
| `src/core/sync/enrich.ts` | `resolveDiffFromAnchor`, `linkLayerDrift`, `enrichTranslationJob`, `enrichReviewJob`, cache helpers |
| `src/core/lang/queue-types.ts` | Optional `anchor` on `FileChangeRecord`; `enrichment` on `TranslationJob`; deprecate required `diff` |
| `src/core/lang/queue.ts` | Reconcile: anchors only; no `content` in fingerprints |
| `src/core/lang/queue-store.ts` | Persist `job.enrichment`; purge legacy on resolve |
| `src/core/operations/lang-queue.ts` | Enrich pending jobs on read; `--no-enrich` option |
| `src/core/reviews/types.ts` | `baselineAnchor` on `ApprovalRecord`; `enrichment` on review job types |
| `src/core/reviews/reconcile.ts` | Defer diff; pending job anchors only |
| `src/core/operations/review.ts` | `finalizeInternalQuorum`: `baselineAnchor`; optional skip `writeSnapshot` |
| `src/cli.ts` | `--no-enrich` on `lang queue pending`, `review queue` |
| `src/interfaces/mcp/tools/` | Enriched queue responses |
| `scaffold/.../ai-spector-resolve-translation/` | Runbook: read `enrichment` |
| `tests/sync/enrich.test.ts` | Core enrich unit tests |
| `tests/lang/queue-enrich.test.ts` | Translation integration |
| `tests/reviews/enrich.test.ts` | Review integration |

---

## Phase P1 — Drift engine + translation anchors + enrich on read

### Task 1: Drift types

**Files:**
- Create: `src/core/sync/drift-types.ts`
- Modify: `src/core/sync/types.ts` — re-export or import shared `DiffSource` if needed (avoid duplicate)
- Test: `tests/sync/drift-types.test.ts` (minimal type guard / JSON round-trip optional)

- [ ] **Step 1: Create `drift-types.ts`** per spec §4 (`DocAnchor`, `EnrichmentCache`, `ImpactBuckets`, `LayerDriftSummary`)

- [ ] **Step 2: Export from `src/interfaces/sdk/index.ts`**

- [ ] **Step 3: Commit**

```bash
git add src/core/sync/drift-types.ts src/interfaces/sdk/index.ts
git commit -m "feat(drift): add DocAnchor and EnrichmentCache types"
```

---

### Task 2: Core enrich module

**Files:**
- Create: `src/core/sync/enrich.ts`
- Test: `tests/sync/enrich.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
// tests/sync/enrich.test.ts
import { describe, expect, it } from "vitest";
import { mkdtemp, writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import {
  resolveDiffFromAnchor,
  invalidateEnrichmentIfStale,
  linkLayerDrift,
} from "@/core/sync/enrich.js";
import type { DocAnchor, EnrichmentCache } from "@/core/sync/drift-types.js";

const exec = promisify(execFile);

describe("resolveDiffFromAnchor", () => {
  it("returns git diff when anchor has gitRef", async () => {
    const root = await mkdtemp(join(tmpdir(), "drift-"));
    await exec("git", ["init"], { cwd: root });
    await exec("git", ["config", "user.email", "t@t.com"], { cwd: root });
    await exec("git", ["config", "user.name", "T"], { cwd: root });
    await mkdir(join(root, "docs/srs"), { recursive: true });
    const path = "docs/srs/a.md";
    await writeFile(join(root, path), "# v1\n");
    await exec("git", ["add", "."], { cwd: root });
    await exec("git", ["commit", "-m", "init"], { cwd: root });
    const { stdout } = await exec("git", ["rev-parse", "HEAD"], { cwd: root });
    const gitRef = stdout.trim();
    await writeFile(join(root, path), "# v2\n");
    const anchor: DocAnchor = {
      path,
      hash: "oldhash",
      gitRef,
      anchoredAt: new Date().toISOString(),
    };
    const result = await resolveDiffFromAnchor(root, anchor);
    expect(result.diffSource).toBe("git");
    expect(result.diff).toContain("v2");
  });

  it("falls back to legacy content", async () => {
    const root = await mkdtemp(join(tmpdir(), "drift-legacy-"));
    const path = "docs/srs/a.md";
    await mkdir(join(root, "docs/srs"), { recursive: true });
    await writeFile(join(root, path), "# v2\n");
    const anchor: DocAnchor = { path, hash: "x", gitRef: null, anchoredAt: "" };
    const result = await resolveDiffFromAnchor(root, anchor, {
      legacyContent: "# v1\n",
    });
    expect(result.diffSource).toBe("legacy_content");
    expect(result.linesAdded + result.linesRemoved).toBeGreaterThan(0);
  });
});

describe("invalidateEnrichmentIfStale", () => {
  it("returns null when anchorHash mismatches", () => {
    const cache: EnrichmentCache = {
      diff: "",
      linesAdded: 0,
      linesRemoved: 0,
      diffSource: "git",
      impact: { regenerate: [], syncUpstream: [], review: [] },
      computedAt: "",
      anchorHash: "aaa",
    };
    expect(invalidateEnrichmentIfStale(cache, "bbb")).toBeNull();
    expect(invalidateEnrichmentIfStale(cache, "aaa")).toBe(cache);
  });
});
```

- [ ] **Step 2: Implement `enrich.ts`**

Key functions:
- `resolveDiffFromAnchor(projectRoot, anchor, legacy?)` — uses `gitDiffFromRef`; fallback `computeLineDiff(legacyContent, readFile)` or `legacySnapshot`
- `linkLayerDrift(projectRoot, changedPaths)` — `loadBaseline` + `discoverDesignLayerFiles` + `diffLayerFileMaps` per layer; intersect modified paths with `changedPaths`
- `invalidateEnrichmentIfStale(cache, currentHash)`

- [ ] **Step 3: Run tests — PASS**

Run: `npm test -- tests/sync/enrich.test.ts`

- [ ] **Step 4: Commit**

```bash
git commit -m "feat(drift): add resolveDiffFromAnchor and linkLayerDrift"
```

---

### Task 3: Translation queue types — anchors

**Files:**
- Modify: `src/core/lang/queue-types.ts`
- Test: update any type-dependent tests

- [ ] **Step 1: Extend types**

```typescript
import type { DocAnchor, EnrichmentCache } from "../sync/drift-types.js";

export interface FileChangeRecord {
  // ... existing fields ...
  /** v2: git anchor at previous version (replaces eager diff as source of truth) */
  anchor?: DocAnchor;
  /** @deprecated v1 — kept for legacy read; enrich uses when anchor missing */
  diff?: string;
  linesAdded?: number;
  linesRemoved?: number;
}

export interface TranslationJob {
  // ... existing ...
  enrichment?: EnrichmentCache;
}
```

- [ ] **Step 2: Commit**

```bash
git commit -m "feat(drift): add anchor and enrichment fields to translation queue types"
```

---

### Task 4: Translation reconcile — anchors only, no content

**Files:**
- Modify: `src/core/lang/queue.ts`
- Test: `tests/lang/queue-reconcile-anchor.test.ts`

- [ ] **Step 1: Write failing test**

Assert after reconcile with file change:
- `fingerprints.files[path].content` is **undefined**
- `job.changes[0].anchor` has `gitRef` when git repo
- `job.changes[0].diff` is **undefined** for new jobs

- [ ] **Step 2: Refactor `detectChanges`**

Replace `computeLineDiff(previous.content, scan.content)` with hash-only compare.

Capture anchor:
```typescript
import { resolveGitRef } from "../sync/git-diff.js";

const gitRef = await resolveGitRef(root);
// per change:
anchor: {
  path: scan.filePath,
  hash: previous.hash,
  gitRef,
  anchoredAt: new Date().toISOString(),
}
```

- [ ] **Step 3: Refactor `updateFingerprints`**

Remove `content: scan.content` — store only `hash`, `version`, `scannedAt`.

- [ ] **Step 4: Run tests**

Run: `npm test -- tests/lang/`

- [ ] **Step 5: Commit**

```bash
git commit -m "feat(drift): translation reconcile stores anchors only"
```

---

### Task 5: `enrichTranslationJob` + wire `runLangQueuePending`

**Files:**
- Modify: `src/core/sync/enrich.ts` — add `enrichTranslationJob`
- Modify: `src/core/operations/lang-queue.ts`
- Test: `tests/lang/queue-enrich.test.ts`

- [ ] **Step 1: Implement `enrichTranslationJob`**

```typescript
export async function enrichTranslationJob(
  projectRoot: string,
  job: TranslationJob,
  opts: { graphPath: string; rulesPath: string; persist?: boolean },
): Promise<EnrichmentCache> {
  const originPath = job.origin.path;
  const currentHash = job.origin.hash;

  if (job.enrichment) {
    const valid = invalidateEnrichmentIfStale(job.enrichment, currentHash);
    if (valid) return valid;
  }

  const latestChange = job.changes[job.changes.length - 1];
  const anchor = latestChange?.anchor ?? {
    path: originPath,
    hash: latestChange?.previousHash ?? "",
    gitRef: null,
    anchoredAt: latestChange?.changedAt ?? "",
  };

  const legacy = latestChange?.diff
    ? { legacyContent: undefined, inlineDiff: latestChange.diff }
    : await loadLegacyFingerprintContent(projectRoot, originPath);

  const diffResult = await resolveDiffFromAnchor(projectRoot, anchor, legacy);

  const changedPaths = [originPath];
  const impactRaw = await computeAuditImpact({
    graphPath: opts.graphPath,
    rulesPath: opts.rulesPath,
    changedPaths,
    direction: "both",
  });

  const enrichment: EnrichmentCache = {
    ...diffResult,
    impact: {
      intraDocTargets: job.targets.filter((t) => t.status === "pending").map((t) => t.path),
      regenerate: impactRaw.regenerate,
      syncUpstream: impactRaw.syncUpstream ?? [],
      review: impactRaw.review,
    },
    layerDrift: await linkLayerDrift(projectRoot, changedPaths),
    computedAt: new Date().toISOString(),
    anchorHash: currentHash,
  };

  return enrichment;
}
```

- [ ] **Step 2: Update `runLangQueuePending`**

```typescript
export interface LangQueuePendingResult {
  job: TranslationJob;
  enrichment?: EnrichmentCache;
}

export async function runLangQueuePending(
  opts: LangQueueOptions & { enrich?: boolean } = {},
): Promise<LangQueuePendingResult[]> {
  const enrich = opts.enrich !== false;
  const { root: projectRoot, config } = await loadDocflowConfig(opts.root);
  // ... load pending ...
  const graphPath = join(projectRoot, config.paths.graph);
  const rulesPath = bundledRulesImpactPath();

  const results: LangQueuePendingResult[] = [];
  for (const job of filterJobsByLang(pending.jobs, opts.lang)) {
    if (!enrich) {
      results.push({ job });
      continue;
    }
    const enrichment = await enrichTranslationJob(projectRoot, job, { graphPath, rulesPath, persist: true });
    job.enrichment = enrichment;
    results.push({ job, enrichment });
  }
  if (enrich) await savePendingQueue(paths, pending);
  return results;
}
```

Update CLI `lang queue pending --json` to output `{ job, enrichment }` array.

- [ ] **Step 3: Tests + commit**

```bash
git commit -m "feat(drift): enrich translation jobs on pending read"
```

---

### Task 6: Purge legacy content on resolve

**Files:**
- Modify: `src/core/lang/queue-store.ts` — `moveJobToResolved`
- Test: extend `tests/lang/queue-enrich.test.ts`

- [ ] **Step 1: On resolve**

- Delete `fingerprints.files[path].content` for all paths in job
- Clear `job.enrichment`
- Optionally strip `changes[].diff` when writing resolved record

- [ ] **Step 2: Commit**

```bash
git commit -m "feat(drift): purge legacy fingerprint content on translation resolve"
```

---

## Phase P2 — Review queue anchors + enrich

### Task 7: Review types + `baselineAnchor`

**Files:**
- Modify: `src/core/reviews/types.ts`
- Test: type compile check

- [ ] **Step 1: Add to `ApprovalRecord`**

```typescript
baselineAnchor?: DocAnchor;
enrichment?: EnrichmentCache; // on pending queue entry if applicable
```

- [ ] **Step 2: Commit**

```bash
git commit -m "feat(drift): add baselineAnchor to approval record"
```

---

### Task 8: Review reconcile — defer diff

**Files:**
- Modify: `src/core/reviews/reconcile.ts`
- Test: `tests/reviews/reconcile-anchor.test.ts`

- [ ] **Step 1: Replace eager diff block**

Instead of `readSnapshot` + `computeLineDiff` + `saveDiff`:
- Set `approval.baselineAnchor` from existing approval or synthesize from `contentHash` at last known state
- Queue pending entry with `baselineAnchor` + `currentHash`
- Skip `saveDiff` on reconcile path (enrich computes on read)

Keep legacy path: if `snapshotRef` exists, enrich fallback still works.

- [ ] **Step 2: Commit**

```bash
git commit -m "feat(drift): defer review diff to enrich on read"
```

---

### Task 9: `finalizeInternalQuorum` — write baselineAnchor

**Files:**
- Modify: `src/core/operations/review.ts`
- Test: `tests/reviews/quorum-anchor.test.ts`

- [ ] **Step 1: In `finalizeInternalQuorum`**

```typescript
import { resolveGitRef } from "../sync/git-diff.js";

approval.baselineAnchor = {
  path: docPath,
  hash: contentHash,
  gitRef: await resolveGitRef(projectRoot),
  anchoredAt: now,
};
```

Add config flag `review.writeLegacySnapshots` (default `true` for v1 migration). When `false`, skip `writeSnapshot`.

- [ ] **Step 2: Commit**

```bash
git commit -m "feat(drift): write baselineAnchor on internal quorum"
```

---

### Task 10: `enrichReviewJob` + wire `runReviewQueue`

**Files:**
- Modify: `src/core/sync/enrich.ts`
- Modify: `src/core/operations/review.ts` — `runReviewQueue`
- Test: `tests/reviews/enrich.test.ts`

- [ ] **Step 1: Implement `enrichReviewJob`**

- `baselineAnchor` from approval or job
- `resolveDiffFromAnchor` with `legacySnapshot` from `readSnapshot` when `snapshotRef` set
- `computeAuditImpact` with `direction: "downstream"` — surface `review` bucket
- `linkLayerDrift` for doc path

- [ ] **Step 2: Wire `runReviewQueue` when `showDiff` or `--json`**

Attach `enrichment` to queue entries.

- [ ] **Step 3: Commit**

```bash
git commit -m "feat(drift): enrich review queue on read"
```

---

### Task 11: Purge review snapshots on re-approve / resolve

**Files:**
- Modify: `src/core/reviews/storage.ts` or resolve handlers
- Test: purge assertion

- [ ] **Step 1: Delete `snapshots/*.md` for logical path when quorum met with `writeLegacySnapshots: false` or on client signoff complete**

- [ ] **Step 2: Commit**

```bash
git commit -m "feat(drift): purge legacy review snapshots on resolve"
```

---

## Phase P3 — Impact hardening + skills

### Task 12: Harden legacy fallbacks

**Files:**
- Modify: `src/core/sync/enrich.ts`
- Test: `tests/sync/enrich-legacy.test.ts`

- [ ] **Step 1: Tests for**

- `legacy_content` from fingerprint
- `legacy_snapshot` from review snapshot
- Inline `changes[].diff` when no anchor
- `git log -1 -- <path>` backfill for `gitRef: null` anchors (optional, non-blocking)

- [ ] **Step 2: Commit**

```bash
git commit -m "feat(drift): harden legacy diff fallbacks"
```

---

### Task 13: Update translation skill runbook

**Files:**
- Modify: `scaffold/cursor/skills/ai-spector-resolve-translation/` (SKILL + runbook)
- Run: `npm run build:claude-scaffold`

- [ ] **Step 1: Replace `changes[].diff` reads with `enrichment.diff`**

- [ ] **Step 2: Document `enrichment.impact` buckets + `layerDrift` handoff to sync audit**

- [ ] **Step 3: Commit**

```bash
git commit -m "docs(drift): update resolve-translation for enrichment"
```

---

### Task 14: Update review references

**Files:**
- Modify review runbooks under `scaffold/cursor/skills/`
- Document `enrichment.impact.review`

- [ ] **Commit**

```bash
git commit -m "docs(drift): document review queue enrichment"
```

---

## Phase P4 — CLI/MCP polish

### Task 15: `--no-enrich` flags

**Files:**
- Modify: `src/cli.ts`
- Modify: `src/interfaces/mcp/schemas.ts` — `enrich?: boolean` on queue tools

- [ ] **Step 1: Add `--no-enrich` to `lang queue pending` and `review queue`**

- [ ] **Step 2: MCP tools pass `enrich: false` when requested**

- [ ] **Step 3: Commit**

```bash
git commit -m "feat(drift): add --no-enrich for fast queue listing"
```

---

### Task 16: CHANGELOG + cli-reference

**Files:**
- Modify: `CHANGELOG.md`
- Modify: `scaffold/cursor/skills/ai-spector/references/cli-reference.md`

- [ ] **Commit**

```bash
git commit -m "docs(drift): document queue enrichment in CHANGELOG and cli-reference"
```

---

## Spec coverage checklist

| Spec requirement | Task |
|------------------|------|
| No new `content` in fingerprints | Task 4 |
| `anchor.gitRef` on reconcile | Task 4 |
| Enrich git diff on pending read | Task 5, 10 |
| Translation impact C | Task 5 |
| Review impact E | Task 10 |
| `layerDrift` link | Task 2, 5, 10 |
| Legacy fallbacks | Task 12 |
| Purge on resolve | Task 6, 11 |
| `baselineAnchor` on quorum | Task 9 |
| `--no-enrich` | Task 15 |
| Agent skill updates | Task 13, 14 |

---

## Testing summary

```bash
npm test -- tests/sync/enrich.test.ts tests/lang/queue-enrich.test.ts tests/reviews/enrich.test.ts
```

Manual smoke:

```bash
# translation
npx ai-spector index
npx ai-spector lang queue scan
npx ai-spector lang queue pending --json   # enrichment.diff present

# review
npx ai-spector review register <path>
# edit doc, index, review queue --json
```
