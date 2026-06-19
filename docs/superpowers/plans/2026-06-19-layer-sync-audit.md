# Layer Sync Audit Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Proactive on-demand / CI audit that detects which SRS, basic-design, and detail-design files changed since an explicit sync baseline, attaches git diffs and graph impact hints, and hands off to an agent for semantic update planning.

**Architecture:** New `src/core/sync/` module stores `baseline.json` (per-file hashes + graph hash + `gitRef`). `sync snapshot` writes baseline; `sync audit` re-hashes files, diffs vs baseline, runs `git diff <gitRef> -- <path>` for changed files, merges `computeImpact` across seeds, and runs a graph gap scan. CLI + MCP expose both commands; agent skill consumes JSON output.

**Tech Stack:** TypeScript, Vitest, Commander CLI, MCP (Zod schemas), existing `discoverDocSourceFiles`, `contentHash`, `computeImpact` / `mergeImpactResults`, `resolveImpactOrigins`.

**Spec:** [`docs/superpowers/specs/2026-06-19-layer-sync-audit-design.md`](../specs/2026-06-19-layer-sync-audit-design.md)

---

## File map

| File | Responsibility |
|------|----------------|
| `src/core/sync/types.ts` | `SyncBaseline`, `LayerDrift`, `SyncAuditResult` types |
| `src/core/sync/constants.ts` | Design layer roots + baseline path helper |
| `src/core/sync/baseline.ts` | Load/save baseline; graph file hash |
| `src/core/sync/discover.ts` | Discover + hash all design-layer markdown files |
| `src/core/sync/hash-diff.ts` | Compare baseline file maps → modified/added/deleted |
| `src/core/sync/git-diff.ts` | `resolveGitRef`, `gitDiffFromRef`, unified-diff line counts |
| `src/core/sync/snapshot.ts` | `runSyncSnapshot` |
| `src/core/sync/gaps.ts` | `scanTraceabilityGaps` graph walk |
| `src/core/sync/impact.ts` | `computeAuditImpact` — merge impact for changed paths |
| `src/core/sync/audit.ts` | `runSyncAudit` orchestration |
| `src/cli.ts` | Top-level `sync snapshot` / `sync audit` subcommands |
| `src/interfaces/mcp/schemas.ts` | `SyncSnapshotSchema`, `SyncAuditSchema` |
| `src/interfaces/mcp/tools/sync.ts` | MCP tool handlers |
| `src/interfaces/mcp/server.ts` | Register `sync_snapshot`, `sync_audit` |
| `scaffold/cursor/skills/ai-spector-sync-audit/` | Skill + runbook (P3) |
| `scaffold/cursor/skills/_skill-router.md` | Route sync audit phrases (P3) |
| `src/core/operations/check.ts` | Optional `SYNC-001` drift hint (P3) |
| `tests/sync/*.test.ts` | Unit + integration tests |

---

## Phase P1 — Baseline + hash diff + git diff + CLI

### Task 1: Sync types + baseline path helpers

**Files:**
- Create: `src/core/sync/types.ts`
- Create: `src/core/sync/constants.ts`
- Create: `src/core/sync/baseline.ts`
- Test: `tests/sync/baseline.test.ts`

- [ ] **Step 1: Write failing baseline round-trip test**

```typescript
// tests/sync/baseline.test.ts
import { describe, expect, it } from "vitest";
import { mkdtemp, mkdir, writeFile, readFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  baselinePath,
  loadBaseline,
  saveBaseline,
  type SyncBaseline,
} from "@/core/sync/baseline.js";

describe("sync baseline", () => {
  it("round-trips baseline.json", async () => {
    const root = await mkdtemp(join(tmpdir(), "sync-"));
    await mkdir(join(root, ".ai-spector/.docflow/sync"), { recursive: true });

    const baseline: SyncBaseline = {
      version: 1,
      createdAt: "2026-06-19T10:00:00Z",
      label: "test",
      gitRef: "abc123",
      gitRefType: "commit",
      graphHash: "deadbeef",
      layers: {
        srs: { root: "docs/srs", files: {} },
        "basic-design": { root: "docs/basic-design", files: {} },
        "detail-design": { root: "docs/detail-design", files: {} },
      },
      totals: { files: 0, bytes: 0 },
    };

    await saveBaseline(root, baseline);
    const loaded = await loadBaseline(root);
    expect(loaded?.label).toBe("test");
    expect(baselinePath(root)).toContain("baseline.json");
  });

  it("returns null when baseline missing", async () => {
    const root = await mkdtemp(join(tmpdir(), "sync-missing-"));
    expect(await loadBaseline(root)).toBeNull();
  });
});
```

- [ ] **Step 2: Run test — expect FAIL**

Run: `npm test -- tests/sync/baseline.test.ts`  
Expected: FAIL — module not found

- [ ] **Step 3: Implement types + baseline I/O**

```typescript
// src/core/sync/types.ts
export type DesignLayer = "srs" | "basic-design" | "detail-design";

export interface BaselineFileEntry {
  hash: string;
  sizeBytes: number;
}

export interface BaselineLayer {
  root: string;
  files: Record<string, BaselineFileEntry>;
}

export interface SyncBaseline {
  version: 1;
  createdAt: string;
  label?: string;
  gitRef: string | null;
  gitRefType: "commit" | null;
  graphHash: string;
  layers: Record<DesignLayer, BaselineLayer>;
  totals: { files: number; bytes: number };
}

export type DiffSource = "git" | "none";

export interface DriftFileEntry {
  path: string;
  baselineHash?: string;
  currentHash?: string;
  diff?: string;
  diffSource: DiffSource;
  linesAdded?: number;
  linesRemoved?: number;
}

export interface LayerDrift {
  modified: DriftFileEntry[];
  added: DriftFileEntry[];
  deleted: DriftFileEntry[];
  unchanged: number;
}

export interface TraceabilityGaps {
  missingDownstream: Array<{ domainId: string; layer: string; message: string }>;
  missingUpstream: Array<{ domainId: string; layer: string; message: string }>;
  orphanFiles: string[];
}

export interface SyncAuditResult {
  baseline: {
    createdAt: string;
    label?: string;
    gitRef: string | null;
    totals: { files: number };
  };
  drift: {
    hasDrift: boolean;
    graphChanged: boolean;
    byLayer: Record<DesignLayer, LayerDrift>;
  };
  traceabilityGaps: TraceabilityGaps;
  impact: {
    regenerate: Array<{ id: string; projectionPath?: string; reason: string }>;
    syncUpstream: Array<{ id: string; projectionPath?: string; reason: string }>;
    review: Array<{ id: string; projectionPath?: string; reason: string }>;
    noTraceabilityImpact?: boolean;
  };
  suggestedNext: string;
  warnings?: string[];
}
```

```typescript
// src/core/sync/constants.ts
import { join } from "node:path";
import type { DesignLayer } from "./types.js";

export const DESIGN_LAYERS: DesignLayer[] = ["srs", "basic-design", "detail-design"];

export const DESIGN_LAYER_ROOTS: Record<DesignLayer, string> = {
  srs: "docs/srs",
  "basic-design": "docs/basic-design",
  "detail-design": "docs/detail-design",
};

export function baselinePath(projectRoot: string): string {
  return join(projectRoot, ".ai-spector/.docflow/sync/baseline.json");
}
```

```typescript
// src/core/sync/baseline.ts
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { baselinePath } from "./constants.js";
import { pathExists, writeJson, readJson } from "../util/fs.js";
import type { SyncBaseline } from "./types.js";

export { baselinePath };

export async function loadBaseline(root: string): Promise<SyncBaseline | null> {
  const path = baselinePath(root);
  if (!(await pathExists(path))) return null;
  const raw = await readJson<SyncBaseline>(path);
  if (raw?.version !== 1) return null;
  return raw;
}

export async function saveBaseline(root: string, baseline: SyncBaseline): Promise<void> {
  await writeJson(baselinePath(root), baseline);
}

export async function hashGraphFile(absGraphPath: string): Promise<string> {
  const bytes = await readFile(absGraphPath);
  return createHash("sha256").update(bytes).digest("hex").slice(0, 16);
}
```

- [ ] **Step 4: Run test — expect PASS**

Run: `npm test -- tests/sync/baseline.test.ts`

- [ ] **Step 5: Commit**

```bash
git add src/core/sync/types.ts src/core/sync/constants.ts src/core/sync/baseline.ts tests/sync/baseline.test.ts
git commit -m "feat(sync): add baseline types and persistence"
```

---

### Task 2: Design-layer discovery + hash diff

**Files:**
- Create: `src/core/sync/discover.ts`
- Create: `src/core/sync/hash-diff.ts`
- Test: `tests/sync/hash-diff.test.ts`

- [ ] **Step 1: Write failing hash-diff test**

```typescript
// tests/sync/hash-diff.test.ts
import { describe, expect, it } from "vitest";
import { diffLayerFileMaps } from "@/core/sync/hash-diff.js";
import type { BaselineFileEntry } from "@/core/sync/types.js";

const entry = (hash: string): BaselineFileEntry => ({ hash, sizeBytes: 10 });

describe("diffLayerFileMaps", () => {
  it("detects modified, added, deleted", () => {
    const baseline = {
      "docs/srs/a.md": entry("1111"),
      "docs/srs/b.md": entry("2222"),
    };
    const current = {
      "docs/srs/a.md": entry("9999"),
      "docs/srs/c.md": entry("3333"),
    };
    const result = diffLayerFileMaps(baseline, current);
    expect(result.modified.map((f) => f.path)).toEqual(["docs/srs/a.md"]);
    expect(result.added.map((f) => f.path)).toEqual(["docs/srs/c.md"]);
    expect(result.deleted.map((f) => f.path)).toEqual(["docs/srs/b.md"]);
    expect(result.unchanged).toBe(0);
  });
});
```

- [ ] **Step 2: Run test — expect FAIL**

Run: `npm test -- tests/sync/hash-diff.test.ts`

- [ ] **Step 3: Implement discover + hash-diff**

```typescript
// src/core/sync/discover.ts
import { discoverDocSourceFiles } from "../index/docs-build.js";
import { contentHash } from "../reviews/staleness.js";
import { DESIGN_LAYERS, DESIGN_LAYER_ROOTS } from "./constants.js";
import type { BaselineFileEntry, DesignLayer } from "./types.js";

export async function discoverDesignLayerFiles(
  projectRoot: string,
): Promise<Record<DesignLayer, Record<string, BaselineFileEntry>>> {
  const out = {} as Record<DesignLayer, Record<string, BaselineFileEntry>>;
  for (const layer of DESIGN_LAYERS) {
    const root = DESIGN_LAYER_ROOTS[layer];
    const files = await discoverDocSourceFiles(projectRoot, { root, glob: "**/*.md" });
    const map: Record<string, BaselineFileEntry> = {};
    for (const f of files) {
      map[f.relativePath.replace(/\\/g, "/")] = {
        hash: f.contentHash,
        sizeBytes: f.sizeBytes,
      };
    }
    out[layer] = map;
  }
  return out;
}

export function totalsForLayers(
  layers: Record<DesignLayer, Record<string, BaselineFileEntry>>,
): { files: number; bytes: number } {
  let files = 0;
  let bytes = 0;
  for (const map of Object.values(layers)) {
    for (const e of Object.values(map)) {
      files++;
      bytes += e.sizeBytes;
    }
  }
  return { files, bytes };
}
```

```typescript
// src/core/sync/hash-diff.ts
import type { BaselineFileEntry, DriftFileEntry } from "./types.js";

export interface HashDiffResult {
  modified: DriftFileEntry[];
  added: DriftFileEntry[];
  deleted: DriftFileEntry[];
  unchanged: number;
}

export function diffLayerFileMaps(
  baseline: Record<string, BaselineFileEntry>,
  current: Record<string, BaselineFileEntry>,
): HashDiffResult {
  const modified: DriftFileEntry[] = [];
  const added: DriftFileEntry[] = [];
  const deleted: DriftFileEntry[] = [];
  let unchanged = 0;

  for (const [path, cur] of Object.entries(current)) {
    const base = baseline[path];
    if (!base) {
      added.push({ path, currentHash: cur.hash, diffSource: "none" });
    } else if (base.hash !== cur.hash) {
      modified.push({
        path,
        baselineHash: base.hash,
        currentHash: cur.hash,
        diffSource: "none",
      });
    } else {
      unchanged++;
    }
  }

  for (const path of Object.keys(baseline)) {
    if (!current[path]) {
      deleted.push({ path, baselineHash: baseline[path].hash, diffSource: "none" });
    }
  }

  modified.sort((a, b) => a.path.localeCompare(b.path));
  added.sort((a, b) => a.path.localeCompare(b.path));
  deleted.sort((a, b) => a.path.localeCompare(b.path));

  return { modified, added, deleted, unchanged };
}
```

- [ ] **Step 4: Run test — expect PASS**

Run: `npm test -- tests/sync/hash-diff.test.ts`

- [ ] **Step 5: Commit**

```bash
git add src/core/sync/discover.ts src/core/sync/hash-diff.ts tests/sync/hash-diff.test.ts
git commit -m "feat(sync): discover design layers and diff file hashes"
```

---

### Task 3: Git ref + per-path diff

**Files:**
- Create: `src/core/sync/git-diff.ts`
- Test: `tests/sync/git-diff.test.ts`

- [ ] **Step 1: Write failing git diff test (uses temp git repo)**

```typescript
// tests/sync/git-diff.test.ts
import { describe, expect, it } from "vitest";
import { mkdtemp, writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { resolveGitRef, gitDiffFromRef } from "@/core/sync/git-diff.js";

const exec = promisify(execFile);

async function git(cwd: string, args: string[]) {
  await exec("git", args, { cwd });
}

describe("sync git-diff", () => {
  it("resolves HEAD and diffs changed file", async () => {
    const root = await mkdtemp(join(tmpdir(), "sync-git-"));
    await git(root, ["init"]);
    await git(root, ["config", "user.email", "t@example.com"]);
    await git(root, ["config", "user.name", "Test"]);
    await mkdir(join(root, "docs/srs"), { recursive: true });
    const file = "docs/srs/a.md";
    await writeFile(join(root, file), "# v1\n");
    await git(root, ["add", "."]);
    await git(root, ["commit", "-m", "baseline"]);
    const ref = await resolveGitRef(root, "HEAD");
    expect(ref).toBeTruthy();
    await writeFile(join(root, file), "# v2\n");
    const { diff, linesAdded, linesRemoved } = await gitDiffFromRef(root, ref!, file);
    expect(diff).toContain("v2");
    expect(linesAdded + linesRemoved).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Run test — expect FAIL**

Run: `npm test -- tests/sync/git-diff.test.ts`

- [ ] **Step 3: Implement git-diff helpers**

```typescript
// src/core/sync/git-diff.ts
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const exec = promisify(execFile);

export async function isGitRepo(cwd: string): Promise<boolean> {
  try {
    const { stdout } = await exec("git", ["rev-parse", "--is-inside-work-tree"], {
      cwd,
      encoding: "utf8",
    });
    return stdout.trim() === "true";
  } catch {
    return false;
  }
}

export async function resolveGitRef(cwd: string, ref = "HEAD"): Promise<string | null> {
  if (!(await isGitRepo(cwd))) return null;
  try {
    const { stdout } = await exec("git", ["rev-parse", ref], { cwd, encoding: "utf8" });
    return stdout.trim() || null;
  } catch {
    return null;
  }
}

export function countUnifiedDiffLines(diff: string): { linesAdded: number; linesRemoved: number } {
  let linesAdded = 0;
  let linesRemoved = 0;
  for (const line of diff.split("\n")) {
    if (line.startsWith("+++") || line.startsWith("---")) continue;
    if (line.startsWith("+")) linesAdded++;
    else if (line.startsWith("-")) linesRemoved++;
  }
  return { linesAdded, linesRemoved };
}

export async function gitDiffFromRef(
  cwd: string,
  ref: string,
  path: string,
): Promise<{ diff: string; linesAdded: number; linesRemoved: number }> {
  try {
    const { stdout } = await exec("git", ["diff", ref, "--", path], {
      cwd,
      encoding: "utf8",
      maxBuffer: 10 * 1024 * 1024,
    });
    const counts = countUnifiedDiffLines(stdout);
    return { diff: stdout, ...counts };
  } catch {
    return { diff: "", linesAdded: 0, linesRemoved: 0 };
  }
}
```

- [ ] **Step 4: Run test — expect PASS**

Run: `npm test -- tests/sync/git-diff.test.ts`

- [ ] **Step 5: Commit**

```bash
git add src/core/sync/git-diff.ts tests/sync/git-diff.test.ts
git commit -m "feat(sync): git ref resolution and per-path diff"
```

---

### Task 4: `runSyncSnapshot`

**Files:**
- Create: `src/core/sync/snapshot.ts`
- Test: `tests/sync/snapshot.test.ts`

- [ ] **Step 1: Write failing snapshot integration test**

```typescript
// tests/sync/snapshot.test.ts
import { describe, expect, it } from "vitest";
import { mkdtemp, writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { runSyncSnapshot } from "@/core/sync/snapshot.js";
import { loadBaseline } from "@/core/sync/baseline.js";

const exec = promisify(execFile);

describe("runSyncSnapshot", () => {
  it("writes baseline with file hashes and gitRef", async () => {
    const root = await mkdtemp(join(tmpdir(), "sync-snap-"));
    await exec("git", ["init"], { cwd: root });
    await exec("git", ["config", "user.email", "t@example.com"], { cwd: root });
    await exec("git", ["config", "user.name", "Test"], { cwd: root });
    await mkdir(join(root, "docs/basic-design"), { recursive: true });
    await writeFile(join(root, "docs/basic-design/api.md"), "# API\n");
    await exec("git", ["add", "."], { cwd: root });
    await exec("git", ["commit", "-m", "init"], { cwd: root });
    await mkdir(join(root, ".ai-spector/.docflow"), { recursive: true });
    await writeFile(
      join(root, ".ai-spector/docflow.config.json"),
      JSON.stringify({ paths: { graph: ".ai-spector/graph.json" } }),
    );
    await writeFile(join(root, ".ai-spector/graph.json"), '{"nodes":[],"edges":[]}');

    const result = await runSyncSnapshot({ root, label: "test", force: true });
    expect(result.totals.files).toBeGreaterThanOrEqual(1);
    const baseline = await loadBaseline(root);
    expect(baseline?.gitRef).toBeTruthy();
    expect(baseline?.layers["basic-design"].files["docs/basic-design/api.md"]).toBeDefined();
  });
});
```

- [ ] **Step 2: Run test — expect FAIL**

Run: `npm test -- tests/sync/snapshot.test.ts`

- [ ] **Step 3: Implement snapshot**

```typescript
// src/core/sync/snapshot.ts
import { join } from "node:path";
import { loadDocflowConfig } from "../config/load.js";
import { pathExists } from "../util/fs.js";
import { DESIGN_LAYERS, DESIGN_LAYER_ROOTS } from "./constants.js";
import { loadBaseline, saveBaseline, hashGraphFile } from "./baseline.js";
import { discoverDesignLayerFiles, totalsForLayers } from "./discover.js";
import { resolveGitRef } from "./git-diff.js";
import type { SyncBaseline } from "./types.js";

export interface SyncSnapshotOptions {
  root?: string;
  label?: string;
  gitRef?: string;
  force?: boolean;
}

export interface SyncSnapshotResult {
  createdAt: string;
  label?: string;
  gitRef: string | null;
  graphHash: string;
  totals: { files: number; bytes: number };
  warnings: string[];
}

export async function runSyncSnapshot(
  opts: SyncSnapshotOptions = {},
): Promise<SyncSnapshotResult> {
  const { root, config } = await loadDocflowConfig(opts.root);
  const warnings: string[] = [];

  if (!opts.force && (await loadBaseline(root))) {
    throw new Error(
      "Sync baseline already exists — use --force to overwrite or run sync audit first",
    );
  }

  const graphPath = join(root, config.paths.graph);
  if (!(await pathExists(graphPath))) {
    warnings.push("Traceability graph missing — run index before snapshot");
  }
  const graphHash = (await pathExists(graphPath))
    ? await hashGraphFile(graphPath)
    : "0000000000000000";

  const layerFiles = await discoverDesignLayerFiles(root);
  const totals = totalsForLayers(layerFiles);
  const gitRef = await resolveGitRef(root, opts.gitRef ?? "HEAD");

  if (!gitRef) {
    warnings.push("Not a git repo — baseline saved without gitRef; audit will not include content diffs");
  }

  const baseline: SyncBaseline = {
    version: 1,
    createdAt: new Date().toISOString(),
    label: opts.label,
    gitRef,
    gitRefType: gitRef ? "commit" : null,
    graphHash,
    layers: {
      srs: { root: DESIGN_LAYER_ROOTS.srs, files: layerFiles.srs },
      "basic-design": { root: DESIGN_LAYER_ROOTS["basic-design"], files: layerFiles["basic-design"] },
      "detail-design": { root: DESIGN_LAYER_ROOTS["detail-design"], files: layerFiles["detail-design"] },
    },
    totals,
  };

  await saveBaseline(root, baseline);

  return {
    createdAt: baseline.createdAt,
    label: baseline.label,
    gitRef: baseline.gitRef,
    graphHash: baseline.graphHash,
    totals,
    warnings,
  };
}
```

- [ ] **Step 4: Run test — expect PASS**

Run: `npm test -- tests/sync/snapshot.test.ts`

- [ ] **Step 5: Commit**

```bash
git add src/core/sync/snapshot.ts tests/sync/snapshot.test.ts
git commit -m "feat(sync): implement sync snapshot command core"
```

---

### Task 5: `runSyncAudit` (hash + git diff; impact stub)

**Files:**
- Create: `src/core/sync/audit.ts`
- Test: `tests/sync/audit.test.ts`

- [ ] **Step 1: Write failing audit test**

```typescript
// tests/sync/audit.test.ts
import { describe, expect, it } from "vitest";
import { mkdtemp, writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { runSyncSnapshot } from "@/core/sync/snapshot.js";
import { runSyncAudit } from "@/core/sync/audit.js";

const exec = promisify(execFile);

async function setupGitProject() {
  const root = await mkdtemp(join(tmpdir(), "sync-audit-"));
  await exec("git", ["init"], { cwd: root });
  await exec("git", ["config", "user.email", "t@example.com"], { cwd: root });
  await exec("git", ["config", "user.name", "Test"], { cwd: root });
  await mkdir(join(root, "docs/basic-design"), { recursive: true });
  await writeFile(join(root, "docs/basic-design/api.md"), "# v1\n");
  await mkdir(join(root, ".ai-spector/.docflow"), { recursive: true });
  await writeFile(
    join(root, ".ai-spector/docflow.config.json"),
    JSON.stringify({ paths: { graph: ".ai-spector/graph.json" } }),
  );
  await writeFile(join(root, ".ai-spector/graph.json"), '{"nodes":[],"edges":[]}');
  await exec("git", ["add", "."], { cwd: root });
  await exec("git", ["commit", "-m", "init"], { cwd: root });
  return root;
}

describe("runSyncAudit", () => {
  it("reports no drift when unchanged", async () => {
    const root = await setupGitProject();
    await runSyncSnapshot({ root, force: true });
    const result = await runSyncAudit({ root });
    expect(result.drift.hasDrift).toBe(false);
  });

  it("reports modified file with git diff", async () => {
    const root = await setupGitProject();
    await runSyncSnapshot({ root, force: true });
    await writeFile(join(root, "docs/basic-design/api.md"), "# v2\n");
    const result = await runSyncAudit({ root });
    expect(result.drift.hasDrift).toBe(true);
    const mod = result.drift.byLayer["basic-design"].modified;
    expect(mod[0]?.path).toBe("docs/basic-design/api.md");
    expect(mod[0]?.diffSource).toBe("git");
    expect(mod[0]?.diff).toContain("v2");
  });

  it("throws when baseline missing", async () => {
    const root = await mkdtemp(join(tmpdir(), "sync-no-base-"));
    await expect(runSyncAudit({ root })).rejects.toThrow(/sync snapshot/i);
  });
});
```

- [ ] **Step 2: Run test — expect FAIL**

Run: `npm test -- tests/sync/audit.test.ts`

- [ ] **Step 3: Implement audit (P1 — empty impact/gaps)**

```typescript
// src/core/sync/audit.ts
import { join } from "node:path";
import { loadDocflowConfig } from "../config/load.js";
import { DESIGN_LAYERS } from "./constants.js";
import { loadBaseline, hashGraphFile } from "./baseline.js";
import { discoverDesignLayerFiles } from "./discover.js";
import { diffLayerFileMaps } from "./hash-diff.js";
import { gitDiffFromRef } from "./git-diff.js";
import type { DesignLayer, DriftFileEntry, SyncAuditResult } from "./types.js";

export interface SyncAuditOptions {
  root?: string;
  direction?: "downstream" | "upstream" | "both";
  failOnDrift?: boolean;
  verifyGitRef?: boolean;
}

export class SyncAuditError extends Error {
  constructor(
    message: string,
    readonly exitCode: number,
  ) {
    super(message);
  }
}

async function attachGitDiffs(
  root: string,
  gitRef: string | null,
  entries: DriftFileEntry[],
): Promise<void> {
  if (!gitRef) return;
  for (const entry of entries) {
    const { diff, linesAdded, linesRemoved } = await gitDiffFromRef(root, gitRef, entry.path);
    entry.diff = diff;
    entry.diffSource = "git";
    entry.linesAdded = linesAdded;
    entry.linesRemoved = linesRemoved;
  }
}

function defaultDirection(changedPaths: string[]): "downstream" | "both" {
  return changedPaths.some(
    (p) => p.startsWith("docs/basic-design/") || p.startsWith("docs/detail-design/"),
  )
    ? "both"
    : "downstream";
}

export async function runSyncAudit(opts: SyncAuditOptions = {}): Promise<SyncAuditResult> {
  const { root, config } = await loadDocflowConfig(opts.root);
  const baseline = await loadBaseline(root);
  if (!baseline) {
    throw new SyncAuditError("No sync baseline — run: npx ai-spector sync snapshot", 2);
  }

  const warnings: string[] = [];
  const currentLayers = await discoverDesignLayerFiles(root);
  const graphPath = join(root, config.paths.graph);
  const currentGraphHash = await hashGraphFile(graphPath).catch(() => "0000000000000000");
  const graphChanged = currentGraphHash !== baseline.graphHash;

  const byLayer = {} as SyncAuditResult["drift"]["byLayer"];
  const allChangedPaths: string[] = [];

  for (const layer of DESIGN_LAYERS) {
    const diff = diffLayerFileMaps(baseline.layers[layer].files, currentLayers[layer]);
    await attachGitDiffs(root, baseline.gitRef, diff.modified);
    await attachGitDiffs(root, baseline.gitRef, diff.added);
    byLayer[layer] = diff;
    allChangedPaths.push(
      ...diff.modified.map((f) => f.path),
      ...diff.added.map((f) => f.path),
      ...diff.deleted.map((f) => f.path),
    );
  }

  const hasFileDrift = allChangedPaths.length > 0;
  const hasDrift = hasFileDrift || graphChanged;

  const result: SyncAuditResult = {
    baseline: {
      createdAt: baseline.createdAt,
      label: baseline.label,
      gitRef: baseline.gitRef,
      totals: baseline.totals,
    },
    drift: { hasDrift, graphChanged, byLayer },
    traceabilityGaps: { missingDownstream: [], missingUpstream: [], orphanFiles: [] },
    impact: { regenerate: [], syncUpstream: [], review: [] },
    suggestedNext:
      "Review drift and impact buckets; run resolve-task or generate for affected paths; then sync snapshot",
    warnings,
  };

  if (opts.failOnDrift && hasDrift) {
    throw new SyncAuditError("Design layer drift detected", 1);
  }

  return result;
}

export { defaultDirection };
```

- [ ] **Step 4: Run test — expect PASS**

Run: `npm test -- tests/sync/audit.test.ts`

- [ ] **Step 5: Commit**

```bash
git add src/core/sync/audit.ts tests/sync/audit.test.ts
git commit -m "feat(sync): implement sync audit hash and git diff"
```

---

### Task 6: CLI `sync snapshot` / `sync audit`

**Files:**
- Modify: `src/cli.ts`
- Modify: `src/interfaces/sdk/index.ts` (export `runSyncSnapshot`, `runSyncAudit`)

- [ ] **Step 1: Add CLI commands**

Add after existing top-level commands (before `graph`):

```typescript
import { runSyncSnapshot } from "./core/sync/snapshot.js";
import { runSyncAudit, SyncAuditError } from "./core/sync/audit.js";

const syncCmd = program.command("sync").description("Design layer sync baseline and audit");

syncCmd
  .command("snapshot")
  .description("Record sync baseline when SRS, basic-design, and detail-design are aligned")
  .option("--label <text>", "Human label for this baseline")
  .option("--git-ref <ref>", "Git ref to store (default: HEAD)")
  .option("--force", "Overwrite existing baseline")
  .option("--json", "JSON output")
  .action(async (opts, cmd) => {
    const root = projectRootOpt(cmd);
    try {
      const result = await runSyncSnapshot({
        root,
        label: opts.label,
        gitRef: opts.gitRef,
        force: opts.force,
      });
      if (opts.json) {
        process.stdout.write(JSON.stringify(result, null, 2) + "\n");
      } else {
        process.stdout.write(
          `Sync baseline saved: ${result.totals.files} files, graph ${result.graphHash.slice(0, 8)}…, git ${result.gitRef?.slice(0, 7) ?? "none"}\n`,
        );
        for (const w of result.warnings) process.stdout.write(`  warn: ${w}\n`);
      }
    } catch (err) {
      process.stderr.write(err instanceof Error ? err.message : String(err));
      process.stderr.write("\n");
      process.exit(1);
    }
  });

syncCmd
  .command("audit")
  .description("Audit design layers against sync baseline")
  .option("--json", "JSON output")
  .option("--fail-on-drift", "Exit 1 when drift detected (CI)")
  .option("--direction <dir>", "downstream | upstream | both")
  .option("--verify-git-ref", "Warn if HEAD is not descendant of baseline gitRef")
  .action(async (opts, cmd) => {
    const root = projectRootOpt(cmd);
    try {
      const result = await runSyncAudit({
        root,
        direction: opts.direction,
        failOnDrift: opts.failOnDrift,
        verifyGitRef: opts.verifyGitRef,
      });
      if (opts.json) {
        process.stdout.write(JSON.stringify(result, null, 2) + "\n");
      } else {
        process.stdout.write(
          result.drift.hasDrift
            ? `Drift detected (${result.drift.graphChanged ? "graph + files" : "files"})\n`
            : "Aligned with baseline\n",
        );
      }
    } catch (err) {
      if (err instanceof SyncAuditError) {
        if (opts.json) {
          process.stdout.write(JSON.stringify({ error: err.message }, null, 2) + "\n");
        } else {
          process.stderr.write(err.message + "\n");
        }
        process.exit(err.exitCode);
      }
      throw err;
    }
  });
```

- [ ] **Step 2: Smoke test CLI**

Run: `npm run build && npx ai-spector sync audit 2>&1 | head -1`  
Expected: message containing `sync snapshot`

- [ ] **Step 3: Commit**

```bash
git add src/cli.ts src/interfaces/sdk/index.ts
git commit -m "feat(sync): add sync snapshot and audit CLI commands"
```

---

## Phase P2 — Graph impact merge + traceability gaps

### Task 7: Audit impact merge

**Files:**
- Create: `src/core/sync/impact.ts`
- Modify: `src/core/sync/audit.ts`
- Test: `tests/sync/impact.test.ts`

- [ ] **Step 1: Write failing impact merge test**

Reuse graph fixture pattern from `tests/graph/impact-upstream.test.ts` — BD document node, feature, SRS doc; changed BD path resolves to section seed; `computeAuditImpact` returns non-empty `syncUpstream`.

- [ ] **Step 2: Implement `computeAuditImpact`**

```typescript
// src/core/sync/impact.ts
import { loadInMemoryGraph } from "../graph/loadGraph.js";
import { computeImpact, mergeImpactResults } from "../graph/impact.js";
import { loadImpactRules } from "../graph/impact-loader.js";
import { resolveImpactOrigins } from "../graph/resolve.js";
import type { ImpactDirection } from "../graph/impact.js";

export async function computeAuditImpact(opts: {
  graphPath: string;
  rulesPath: string;
  changedPaths: string[];
  direction: ImpactDirection;
}) {
  const g = await loadInMemoryGraph(opts.graphPath);
  const rules = await loadImpactRules(opts.rulesPath);
  const results = [];

  for (const file of opts.changedPaths) {
    const origins = resolveImpactOrigins(g, { file });
    for (const origin of origins) {
      results.push(computeImpact(g, origin.id, "content_change", rules, opts.direction));
    }
  }

  if (results.length === 0) {
    return {
      regenerate: [],
      syncUpstream: [],
      review: [],
      noTraceabilityImpact: true,
    };
  }

  return mergeImpactResults(results);
}
```

Wire into `runSyncAudit` after hash diff:

```typescript
import { computeAuditImpact } from "./impact.js";
import { defaultDirection } from "./audit.js";

const direction = opts.direction ?? defaultDirection(allChangedPaths);
const impact = await computeAuditImpact({
  graphPath,
  rulesPath: join(root, ".ai-spector/.docflow/config/graph/rules.impact.json"),
  changedPaths: allChangedPaths,
  direction,
});
result.impact = {
  regenerate: impact.regenerate,
  syncUpstream: impact.syncUpstream ?? [],
  review: impact.review,
  noTraceabilityImpact: impact.noTraceabilityImpact,
};
```

- [ ] **Step 3: Run tests — expect PASS**

Run: `npm test -- tests/sync/impact.test.ts tests/sync/audit.test.ts`

- [ ] **Step 4: Commit**

```bash
git add src/core/sync/impact.ts src/core/sync/audit.ts tests/sync/impact.test.ts
git commit -m "feat(sync): merge graph impact for changed paths in audit"
```

---

### Task 8: Traceability gap scan

**Files:**
- Create: `src/core/sync/gaps.ts`
- Modify: `src/core/sync/audit.ts`
- Test: `tests/sync/gaps.test.ts`

- [ ] **Step 1: Write failing gap test**

Feature with `listedIn` SRS + BD but no detail-design `document` with `tracesTo` → `missingDownstream`.

- [ ] **Step 2: Implement `scanTraceabilityGaps`**

Walk `useCase` / `feature` / `requirement` nodes:

- `hasSrs` = outgoing `listedIn`/`definedIn` to SRS-layer sections/docs
- `hasBd` = `satisfies` or BD `definedIn`
- `hasDd` = `tracesTo` detail-design document or DD section

Flag `missingDownstream` when `hasSrs && hasBd && !hasDd`.

For `orphanFiles`: compare `discoverDesignLayerFiles` paths vs graph `document` nodes' `output` fields.

- [ ] **Step 3: Wire into audit + run tests**

Run: `npm test -- tests/sync/gaps.test.ts`

- [ ] **Step 4: Commit**

```bash
git add src/core/sync/gaps.ts src/core/sync/audit.ts tests/sync/gaps.test.ts
git commit -m "feat(sync): traceability gap scan in sync audit"
```

---

## Phase P3 — MCP, agent skill, workspace hint

### Task 9: MCP tools `sync_snapshot` / `sync_audit`

**Files:**
- Create: `src/interfaces/mcp/tools/sync.ts`
- Modify: `src/interfaces/mcp/schemas.ts`
- Modify: `src/interfaces/mcp/tool-names.ts`
- Modify: `src/interfaces/mcp/tool-descriptions.ts`
- Modify: `src/interfaces/mcp/server.ts`

- [ ] **Step 1: Add Zod schemas**

```typescript
export const SyncSnapshotSchema = z.object({
  label: z.string().optional(),
  gitRef: z.string().optional(),
  force: z.boolean().optional(),
});

export const SyncAuditSchema = z.object({
  failOnDrift: z.boolean().optional(),
  direction: z.enum(["downstream", "upstream", "both"]).optional(),
  verifyGitRef: z.boolean().optional(),
});
```

- [ ] **Step 2: Register tools** (mirror `adopt_validate` pattern)

- [ ] **Step 3: Commit**

```bash
git add src/interfaces/mcp/
git commit -m "feat(sync): add sync_snapshot and sync_audit MCP tools"
```

---

### Task 10: Agent skill + router

**Files:**
- Create: `scaffold/cursor/skills/ai-spector-sync-audit/SKILL.md`
- Create: `scaffold/cursor/skills/ai-spector-sync-audit/references/runbook.md`
- Modify: `scaffold/cursor/skills/_skill-router.md`
- Run: `npm run sync-cursor` (or project scaffold sync) to mirror to Claude

Skill runbook steps (from spec §8):

1. `sync_audit` MCP or `npx ai-spector sync audit --json`
2. Present drift by layer
3. Present impact buckets — never invent paths
4. Offer `ai-spector-resolve-task` or `generate-*`
5. After updates: `index` → `sync snapshot --force`

Router phrases: *sync audit*, *check doc drift*, *what changed since baseline*, *layer sync*.

- [ ] **Commit**

```bash
git add scaffold/cursor/skills/ai-spector-sync-audit/ scaffold/cursor/skills/_skill-router.md
git commit -m "docs(sync): add ai-spector-sync-audit skill and router"
```

---

### Task 11: `workspace_check` drift hint (optional lightweight)

**Files:**
- Modify: `src/core/operations/check.ts`
- Test: `tests/operations/check-sync-hint.test.ts`

When `baseline.json` exists, compare **file counts + aggregate hash** (xor of layer file hashes) — do not run full audit. Emit finding:

```json
{ "id": "SYNC-001", "severity": "info", "message": "Design layer drift detected — run sync audit" }
```

- [ ] **Commit**

```bash
git add src/core/operations/check.ts tests/operations/check-sync-hint.test.ts
git commit -m "feat(sync): workspace_check SYNC-001 drift hint"
```

---

### Task 12: Docs + CHANGELOG

**Files:**
- Modify: `scaffold/cursor/skills/ai-spector/references/cli-reference.md`
- Modify: `CHANGELOG.md`
- Modify: `README.md` (one-line under workflows if present)

Document:

```bash
npx ai-spector sync snapshot --label "sprint-12"
npx ai-spector sync audit --json
npx ai-spector sync audit --fail-on-drift   # CI
```

- [ ] **Commit**

```bash
git add scaffold/cursor/skills/ai-spector/references/cli-reference.md CHANGELOG.md README.md
git commit -m "docs(sync): document sync snapshot and audit commands"
```

---

## Spec coverage checklist (self-review)

| Spec requirement | Task |
|------------------|------|
| `sync snapshot` with hashes + graph + gitRef | Task 4, 6 |
| `sync audit` hash diff | Task 5 |
| Git content diffs | Task 3, 5 |
| `--fail-on-drift` exit 1 | Task 5, 6 |
| No baseline exit 2 | Task 5 |
| Graph impact merge | Task 7 |
| `syncUpstream` with `--direction both` | Task 7 |
| Traceability gaps | Task 8 |
| MCP tools | Task 9 |
| Agent skill + router | Task 10 |
| workspace_check hint | Task 11 |
| CI docs | Task 12 |
| `--verify-git-ref` optional | Task 5 (wire in audit using `git merge-base --is-ancestor`) |

---

## Testing summary

Run full sync test suite after each phase:

```bash
npm test -- tests/sync/
```

E2E manual smoke:

```bash
# in a fixture project with graph indexed
npx ai-spector sync snapshot --label smoke
# edit docs/basic-design/...
npx ai-spector sync audit --json
npx ai-spector sync snapshot --force
npx ai-spector sync audit --fail-on-drift   # exit 0
```
