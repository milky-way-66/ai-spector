# Project Adopt Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship `npx ai-spector adopt` (scan → plan → apply → bootstrap → validate) plus `ai-spector-adopt` agent skill so initialized projects with misplaced SRS/BD/prototype can migrate to canonical layout and unlock the full pipeline.

**Architecture:** New `src/core/adopt/` module mirrors `src/core/template/` (scan types, validate gate, setup-mark). CLI registered via `registerAdoptCommand` in `src/core/operations/adopt.ts`. Human gates enforced in agent runbook; CLI enforces preconditions (`plan.status === "approved"` before apply). Task gate suppression via `TaskSnapshot.adoptedAt` + completed adopt tasks in `tasks/recent`.

**Tech Stack:** TypeScript, Commander CLI, Vitest, existing `index`/`runCheck`/`discoverAndQueueUnreviewed`/`buildPrototypeManifest` integrations.

**Spec:** [`docs/superpowers/specs/2026-06-15-project-adopt-design.md`](../specs/2026-06-15-project-adopt-design.md)

---

## File map

| File | Responsibility |
|------|----------------|
| `src/core/adopt/types.ts` | `AdoptScanResult`, `AdoptPlan`, `AdoptSetupState`, JSON schemas |
| `src/core/adopt/paths.ts` | `.ai-spector/.docflow/adopt/*` path helpers |
| `src/core/adopt/classify.ts` | Builtin manifest matching, language detection, prototype detection |
| `src/core/adopt/scan.ts` | `runAdoptScan()` — inventory + classification + questions |
| `src/core/adopt/plan.ts` | `runAdoptPlan()`, `approveAdoptPlan()` — move mapping |
| `src/core/adopt/apply.ts` | `runAdoptApply()` — git mv / rename + rollback |
| `src/core/adopt/bootstrap.ts` | Config patches, index, review discovery, adopt tasks |
| `src/core/adopt/validate.ts` | `validateAdopt()` — readiness gate |
| `src/core/adopt/setup.ts` | `loadAdoptContext`, `recordAdoptAnswer`, `markAdoptSetupItem` |
| `src/core/adopt/tasks.ts` | `createAdoptCompletedTasks()` |
| `src/core/operations/adopt.ts` | Commander subcommands + JSON output |
| `src/interfaces/cli/format/adopt.ts` | Human-readable formatters |
| `src/interfaces/mcp/tools/adopt.ts` | MCP tool handlers |
| `src/interfaces/mcp/schemas.ts` | Zod schemas (extend) |
| `src/core/operations/check.ts` | ADOPT-001 + adopt task suppression in TASK-002/003 |
| `src/core/operations/task.ts` | Extend `TaskSnapshot` with `adoptedAt?` |
| `tests/adopt/*.test.ts` | Unit + integration tests |
| `.cursor/skills/ai-spector-adopt/` | Agent skill + runbook |
| `scaffold/cursor/skills/ai-spector-adopt/` | Synced via existing scaffold copy |

---

### Task 1: Adopt types and paths

**Files:**
- Create: `src/core/adopt/types.ts`
- Create: `src/core/adopt/paths.ts`
- Test: `tests/adopt/paths.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// tests/adopt/paths.test.ts
import { describe, expect, it } from "vitest";
import { adoptArtifactPaths } from "@/core/adopt/paths.js";

describe("adoptArtifactPaths", () => {
  it("returns paths under .ai-spector/.docflow/adopt/", () => {
    const p = adoptArtifactPaths("/proj");
    expect(p.scanResult).toBe("/proj/.ai-spector/.docflow/adopt/scan-result.json");
    expect(p.plan).toBe("/proj/.ai-spector/.docflow/adopt/plan.json");
    expect(p.setup).toBe("/proj/.ai-spector/.docflow/adopt/adopt-setup.json");
    expect(p.context).toBe("/proj/.ai-spector/.docflow/adopt/context.json");
    expect(p.history).toBe("/proj/.ai-spector/.docflow/adopt/history.jsonl");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/adopt/paths.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Write minimal implementation**

```typescript
// src/core/adopt/paths.ts
import { join } from "node:path";

export function adoptDir(root: string): string {
  return join(root, ".ai-spector", ".docflow", "adopt");
}

export function adoptArtifactPaths(root: string) {
  const dir = adoptDir(root);
  return {
    dir,
    scanResult: join(dir, "scan-result.json"),
    plan: join(dir, "plan.json"),
    setup: join(dir, "adopt-setup.json"),
    context: join(dir, "context.json"),
    history: join(dir, "history.jsonl"),
  };
}
```

```typescript
// src/core/adopt/types.ts — key exports
export type AdoptLayerClass = "builtin-aligned" | "reshaped" | "custom" | "missing";
export type AdoptPrototypeClass = "static-html" | "spa" | "disconnected" | "missing";
export type AdoptLangStrategy = "per-lang-folders" | "flat" | "mixed";
export type AdoptMoveConfidence = "high" | "medium" | "low";
export type AdoptPlanStatus = "draft" | "approved" | "applied";

export interface AdoptQuestion {
  id: string;
  prompt: string;
  blocking: boolean;
}

export interface AdoptInventoryItem {
  path: string;
  layer: "srs" | "basic-design" | "prototype" | "data-source";
  signals: { headings: Array<{ depth: number; text: string }>; ids: string[] };
}

export interface AdoptScanResult {
  scannedAt: string;
  classification: {
    srs: AdoptLayerClass;
    basicDesign: AdoptLayerClass;
    prototype: AdoptPrototypeClass;
    languages: { detected: string[]; strategy: AdoptLangStrategy };
    dataSource: "present" | "partial" | "absent";
    activePack: string;
  };
  inventory: AdoptInventoryItem[];
  questionsForUser: AdoptQuestion[];
}

export interface AdoptMove {
  from: string;
  to: string;
  layer: "srs" | "basic-design" | "prototype";
  documentId?: string;
  confidence: AdoptMoveConfidence;
  reason: string;
}

export interface AdoptPlan {
  version: 1;
  status: AdoptPlanStatus;
  approvedAt: string | null;
  approvedBy: string | null;
  moves: AdoptMove[];
  configPatches: Array<{ path: string; set: Record<string, unknown> }>;
  prototypeActions: Array<{ action: string; from?: string; to?: string; after?: string }>;
  warnings: string[];
  blockingIssues: string[];
}

export interface AdoptSetupItem {
  done: boolean;
  at: string | null;
}

export interface AdoptSetupState {
  version: 1;
  items: Record<string, AdoptSetupItem>;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- tests/adopt/paths.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/core/adopt/types.ts src/core/adopt/paths.ts tests/adopt/paths.test.ts
git commit -m "feat(adopt): add adopt types and artifact paths"
```

---

### Task 2: Classification heuristics

**Files:**
- Create: `src/core/adopt/classify.ts`
- Test: `tests/adopt/classify.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// tests/adopt/classify.test.ts
import { describe, expect, it } from "vitest";
import { scoreBuiltinMatch, detectLanguageLayout } from "@/core/adopt/classify.js";

describe("scoreBuiltinMatch", () => {
  it("scores high when filename and H1 match builtin SRS intro", () => {
    const score = scoreBuiltinMatch(
      { relativePath: "1-introduction.md", headings: [{ depth: 1, text: "Introduction" }] },
      "srs",
    );
    expect(score).toBeGreaterThanOrEqual(0.8);
  });

  it("scores low for unrelated filenames", () => {
    const score = scoreBuiltinMatch(
      { relativePath: "random-notes.md", headings: [{ depth: 1, text: "Notes" }] },
      "srs",
    );
    expect(score).toBeLessThan(0.3);
  });
});

describe("detectLanguageLayout", () => {
  it("detects per-lang folders", () => {
    expect(detectLanguageLayout(["docs/srs/en/foo.md", "docs/srs/vi/foo.md"])).toEqual({
      detected: expect.arrayContaining(["en", "vi"]),
      strategy: "per-lang-folders",
    });
  });

  it("detects flat layout", () => {
    expect(detectLanguageLayout(["docs/srs/1-introduction.md"])).toEqual({
      detected: [],
      strategy: "flat",
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/adopt/classify.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement classify.ts**

Use bundled `documents.json` and `documents-basic-design.json` via existing `loadDocumentsManifest()` / `loadBasicDesignListManifest()` from `@/core/config/load.js`.

Core functions:

```typescript
export function scoreBuiltinMatch(
  file: { relativePath: string; headings: Array<{ depth: number; text: string }> },
  layer: "srs" | "basic-design",
): number;

export function classifyLayer(
  files: Array<{ relativePath: string; headings: Array<{ depth: number; text: string }> }>,
  layer: "srs" | "basic-design",
): AdoptLayerClass;

export function detectLanguageLayout(paths: string[]): {
  detected: string[];
  strategy: AdoptLangStrategy;
};

export function classifyPrototype(root: string): Promise<AdoptPrototypeClass>;

export function extractDomainIds(content: string): string[]; // UC-01, F-02, SCR-01 regex
```

Classification rules (from spec §6.3):
- `builtin-aligned`: ≥70% of inventory files score ≥0.6 against manifest
- `reshaped`: any UC/F/API ids in bodies but builtin score <0.7
- `custom`: active custom pack manifest matches better than builtin
- `missing`: no `.md` under layer roots

- [ ] **Step 4: Run tests**

Run: `npm test -- tests/adopt/classify.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/core/adopt/classify.ts tests/adopt/classify.test.ts
git commit -m "feat(adopt): add classification heuristics for scan"
```

---

### Task 3: Adopt scan command

**Files:**
- Create: `src/core/adopt/scan.ts`
- Create: `src/core/adopt/setup.ts` (context load/save only for now)
- Test: `tests/adopt/scan.test.ts`

- [ ] **Step 1: Write fixture + failing test**

```typescript
// tests/adopt/scan.test.ts
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { runAdoptScan } from "@/core/adopt/scan.js";
import { withTempDir } from "../helpers/temp-project.js";

async function scaffoldInit(root: string) {
  await mkdir(join(root, ".ai-spector/.docflow/adopt"), { recursive: true });
  await mkdir(join(root, ".ai-spector/.docflow/config"), { recursive: true });
  await writeFile(
    join(root, ".ai-spector/docflow.config.json"),
    JSON.stringify({ languages: [{ code: "en", label: "English" }] }),
    "utf8",
  );
}

describe("runAdoptScan", () => {
  it("inventories flat SRS docs and asks language question", async () => {
    await withTempDir(async (root) => {
      await scaffoldInit(root);
      await mkdir(join(root, "docs/srs"), { recursive: true });
      await writeFile(
        join(root, "docs/srs/1-introduction.md"),
        "# Introduction\n\nProject overview.\n",
        "utf8",
      );
      const result = await runAdoptScan({ root });
      expect(result.inventory.some((i) => i.path === "docs/srs/1-introduction.md")).toBe(true);
      expect(result.classification.languages.strategy).toBe("flat");
      expect(result.questionsForUser.some((q) => q.id.startsWith("lang-"))).toBe(true);
    });
  });
});
```

- [ ] **Step 2: Run test — expect FAIL**

Run: `npm test -- tests/adopt/scan.test.ts`

- [ ] **Step 3: Implement runAdoptScan**

```typescript
// src/core/adopt/scan.ts
export async function runAdoptScan(opts: { root?: string }): Promise<AdoptScanResult> {
  // 1. loadDocflowConfig — error if not initialized
  // 2. glob docs/srs/**/*.md, docs/basic-design/**/*.md, prototype/**, docs/data-source/**
  // 3. parse headings + extractDomainIds per file
  // 4. classify layers + prototype + dataSource (any md in data-source?)
  // 5. detectLanguageLayout
  // 6. merge context.json answers to resolve lang-primary if present
  // 7. build questionsForUser (blocking if flat layout and no lang answer)
  // 8. write scan-result.json
  // 9. return result
}
```

```typescript
// src/core/adopt/setup.ts (partial)
export async function loadAdoptContext(root: string): Promise<Record<string, string>>;
export async function recordAdoptAnswer(root: string, id: string, answer: string): Promise<void>;
export async function loadAdoptSetup(root: string): Promise<AdoptSetupState>;
export async function markAdoptSetupItem(root: string, itemId: string): Promise<AdoptSetupState>;
```

- [ ] **Step 4: Run test — expect PASS**

- [ ] **Step 5: Commit**

```bash
git add src/core/adopt/scan.ts src/core/adopt/setup.ts tests/adopt/scan.test.ts
git commit -m "feat(adopt): implement adopt scan with inventory and questions"
```

---

### Task 4: Adopt plan generation

**Files:**
- Create: `src/core/adopt/plan.ts`
- Test: `tests/adopt/plan.test.ts`

- [ ] **Step 1: Write failing test**

```typescript
// tests/adopt/plan.test.ts — flat SRS → docs/srs/en/{filename}
it("maps flat SRS files into primary language folder", async () => {
  // scaffold scan-result with flat layout + context { "lang-primary": "en" }
  const plan = await runAdoptPlan({ root });
  const move = plan.moves.find((m) => m.from === "docs/srs/1-introduction.md");
  expect(move?.to).toBe("docs/srs/en/1-introduction.md");
  expect(move?.confidence).toBe("high");
  expect(plan.configPatches.length).toBeGreaterThan(0);
});
```

- [ ] **Step 2: Run — FAIL**

- [ ] **Step 3: Implement plan.ts**

```typescript
export async function runAdoptPlan(opts: {
  root?: string;
  sync?: boolean;
}): Promise<AdoptPlan>;

export async function approveAdoptPlan(opts: {
  root?: string;
  by?: string;
}): Promise<AdoptPlan>;
```

Logic:
- Read `scan-result.json` + `context.json`
- For each inventory item in srs/basic-design: map to manifest `output` pattern with `{lang}` substitution
- Per-domain detail files (uc-*, f-*): preserve slug in target path under `use-cases/` / `features/`
- Low confidence when multiple manifest candidates tie → `confidence: "medium"`, add warning
- `configPatches`: ensure `languages[]` includes detected/confirmed codes
- `prototypeActions`: relocate if prototype outside `prototype/`
- Write `plan.json` with `status: "draft"`
- `approveAdoptPlan`: validate no `blockingIssues`, set `approvedAt`, update `adopt-setup.json` item `plan.approved`

- [ ] **Step 4: Run tests — PASS**

- [ ] **Step 5: Commit**

```bash
git add src/core/adopt/plan.ts tests/adopt/plan.test.ts
git commit -m "feat(adopt): generate and approve adopt migration plan"
```

---

### Task 5: Adopt apply (moves + rollback)

**Files:**
- Create: `src/core/adopt/apply.ts`
- Test: `tests/adopt/apply.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
it("rejects apply when plan not approved", async () => {
  await expect(runAdoptApply({ root })).rejects.toThrow(/approved/i);
});

it("moves files and sets plan status applied", async () => {
  // plan.status = approved, one move
  await runAdoptApply({ root });
  expect(await pathExists(join(root, "docs/srs/en/1-introduction.md"))).toBe(true);
  const plan = await readJson<AdoptPlan>(paths.plan);
  expect(plan.status).toBe("applied");
});
```

- [ ] **Step 2: Run — FAIL**

- [ ] **Step 3: Implement apply.ts**

```typescript
export async function runAdoptApply(opts: {
  root?: string;
  dryRun?: boolean;
}): Promise<{ moved: number; dryRun: boolean }>;
```

Rules:
- Precondition: `plan.status === "approved"`
- Detect git repo: `git rev-parse --is-inside-work-tree` → use `git mv` else `rename`
- `mkdir` parent of each target before move
- Track completed moves; on error, reverse in LIFO order
- Append `{ at, action: "move", from, to }` lines to `history.jsonl`
- Set `plan.status = "applied"`, mark `adopt-setup.json` item `apply.done`

- [ ] **Step 4: Run tests — PASS**

- [ ] **Step 5: Commit**

```bash
git add src/core/adopt/apply.ts tests/adopt/apply.test.ts
git commit -m "feat(adopt): apply approved migration plan with rollback"
```

---

### Task 6: Adopt completed tasks + TaskSnapshot extension

**Files:**
- Modify: `src/core/operations/task.ts` — add `adoptedAt?: string` to `TaskSnapshot`
- Create: `src/core/adopt/tasks.ts`
- Test: `tests/adopt/tasks.test.ts`

- [ ] **Step 1: Write failing test**

```typescript
it("creates completed srs and basic-design adopt tasks", async () => {
  const ids = await createAdoptCompletedTasks({ root });
  expect(ids.srs).toMatch(/^task-/);
  const task = await readJson(join(root, ".ai-spector/.docflow/tasks", `${ids.srs}.json`));
  expect(task.status).toBe("complete");
  expect(task.snapshot.adoptedAt).toBeTruthy();
  expect(task.planApprovedAt).toBeTruthy();
});
```

- [ ] **Step 2: Run — FAIL**

- [ ] **Step 3: Implement tasks.ts**

```typescript
export async function createAdoptCompletedTasks(opts: { root: string }): Promise<{
  srs?: string;
  basicDesign?: string;
}>;
```

For each layer with migrated docs:
- Create task: `kind: "generate"`, `workflow: "generate-srs"` / `"generate-basic-design"`, `trigger: "adopt:migration"`, `status: "complete"`
- Set all generate steps `status: "done"` based on registry/manifest document list
- Set `planApprovedAt`, `snapshot.adoptedAt`, `snapshot.workspaceCheckAt`
- Push task id to `index.recent` (NOT `index.active`) — suppression logic reads recent

- [ ] **Step 4: Run tests — PASS**

- [ ] **Step 5: Commit**

```bash
git add src/core/operations/task.ts src/core/adopt/tasks.ts tests/adopt/tasks.test.ts
git commit -m "feat(adopt): create completed adopt tasks for generate slots"
```

---

### Task 7: Adopt bootstrap

**Files:**
- Create: `src/core/adopt/bootstrap.ts`
- Test: `tests/adopt/bootstrap.test.ts`

- [ ] **Step 1: Write failing test (mock index if heavy — prefer integration-lite)**

```typescript
it("requires applied plan", async () => {
  await expect(runAdoptBootstrap({ root })).rejects.toThrow(/applied/i);
});
```

- [ ] **Step 2: Run — FAIL**

- [ ] **Step 3: Implement bootstrap.ts**

```typescript
export async function runAdoptBootstrap(opts: {
  root?: string;
  skipAnalyze?: boolean;
}): Promise<{ steps: Array<{ id: string; status: string; detail?: string }> }>;
```

Ordered steps (spec §8.2):
1. Apply `configPatches` — merge into `docflow.config.json` via deep merge
2. `runIndex({ root })` — full index
3. If `dataSource !== "absent"` and `!skipAnalyze`: skip full analyze in v1; document as follow-up gap (spec allows supplement-only analyze later). **v1:** log warning "data-source supplement analyze not automated — run /analyze manually if needed"
4. If `prototypeActions` includes `emit-manifest`: call `buildPrototypeManifest` + `writePrototypeManifestFiles`
5. `runReviewDiscovery(projectRoot)` from `@/core/reviews/register.js`
6. `createAdoptCompletedTasks({ root })`
7. Mark `bootstrap.done` in adopt-setup.json

- [ ] **Step 4: Run tests — PASS**

- [ ] **Step 5: Commit**

```bash
git add src/core/adopt/bootstrap.ts tests/adopt/bootstrap.test.ts
git commit -m "feat(adopt): bootstrap graph, review queue, and adopt tasks"
```

---

### Task 8: Adopt validate + setup-mark gate

**Files:**
- Create: `src/core/adopt/validate.ts`
- Modify: `src/core/adopt/setup.ts` — gate `migration.complete` on validate.ready
- Test: `tests/adopt/validate.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
it("returns ready false when plan not applied", async () => {
  const v = await validateAdopt({ root });
  expect(v.ready).toBe(false);
  expect(v.blockingCount).toBeGreaterThan(0);
});

it("rejects setup-mark migration.complete when not ready", async () => {
  await expect(markAdoptSetupItem(root, "migration.complete")).rejects.toThrow(/ready/i);
});
```

- [ ] **Step 2: Run — FAIL**

- [ ] **Step 3: Implement validate.ts**

```typescript
export interface AdoptValidationResult {
  ready: boolean;
  blockingCount: number;
  gaps: Array<{ id: string; severity: "blocking" | "warning"; message: string; fix?: string }>;
  questionsForUser: string[];
}

export async function validateAdopt(opts: {
  root?: string;
  sync?: boolean;
}): Promise<AdoptValidationResult>;
```

Checks (reuse internals):
- `plan.status === "applied"` — blocking
- Call `runCheck({ root })` — treat STRUCT/CFG errors as blocking gaps
- Call `validateGraph` — graph errors blocking
- Doc coverage — compare manifest outputs vs on-disk (warning)
- Prototype manifest screen match rate (warning)
- Review registry doc count > 0 for migrated paths (warning)

`markAdoptSetupItem("migration.complete")`: call `validateAdopt` first; throw if `!ready`.

- [ ] **Step 4: Run tests — PASS**

- [ ] **Step 5: Commit**

```bash
git add src/core/adopt/validate.ts src/core/adopt/setup.ts tests/adopt/validate.test.ts
git commit -m "feat(adopt): validate gate and migration.complete setup-mark"
```

---

### Task 9: Workspace check — ADOPT-001 + TASK-002/003 suppression

**Files:**
- Modify: `src/core/operations/check.ts`
- Modify: `scaffold/.ai-spector/.docflow/config/workspace/rules.json` (default rules array)
- Test: `tests/commands/check.test.ts` (extend)

- [ ] **Step 1: Write failing tests**

```typescript
it("warns ADOPT-001 when misplaced SRS exists and migration not complete", async () => {
  // init + flat srs file, no migration.complete
  const result = await runCheck({ root });
  expect(result.findings.some((f) => f.ruleId === "ADOPT-001")).toBe(true);
});

it("suppresses TASK-002 when adopt completed task exists in recent", async () => {
  // canonical srs path + createAdoptCompletedTasks + migration.complete
  const result = await runCheck({ root });
  expect(result.findings.some((f) => f.ruleId === "TASK-002")).toBe(false);
});
```

- [ ] **Step 2: Run — FAIL**

- [ ] **Step 3: Modify check.ts**

Add to default rules:
```typescript
{ id: "ADOPT-001", severity: "warning" },
```

ADOPT-001 logic:
- `.ai-spector/docflow.config.json` exists
- `migration.complete` not done in adopt-setup.json (or file missing)
- Any STRUCT-004 finding would trigger OR flat srs/bd md exists

TASK-002/003 suppression — extend `checkGenerateTaskGate`:

```typescript
async function hasAdoptTaskCoverage(root: string, slot: string): Promise<boolean> {
  const setup = await loadAdoptSetup(root).catch(() => null);
  if (setup?.items["migration.complete"]?.done) return true;
  const index = await loadTaskIndexForCheck(root);
  for (const taskId of index.recent ?? []) {
    const task = await loadTaskForCheck(root, taskId);
    if (!task || task.status !== "complete") continue;
    if (!task.snapshot?.adoptedAt) continue;
    const expectedSlot = /* derive from task.workflow */;
    if (expectedSlot === slot) return true;
  }
  return false;
}
```

Early return in `checkGenerateTaskGate` when `hasAdoptTaskCoverage` is true.

- [ ] **Step 4: Run check tests — PASS**

- [ ] **Step 5: Commit**

```bash
git add src/core/operations/check.ts scaffold/.ai-spector/.docflow/config/workspace/rules.json tests/commands/check.test.ts
git commit -m "feat(adopt): ADOPT-001 rule and TASK-002 suppression for adopted projects"
```

---

### Task 10: CLI + MCP registration

**Files:**
- Create: `src/core/operations/adopt.ts`
- Create: `src/interfaces/cli/format/adopt.ts`
- Modify: `src/cli.ts` — `registerAdoptCommand(program)`
- Create: `src/interfaces/mcp/tools/adopt.ts`
- Modify: `src/interfaces/mcp/schemas.ts`
- Modify: `src/interfaces/mcp/server.ts`
- Modify: `src/interfaces/mcp/tool-descriptions.ts`
- Modify: `src/interfaces/sdk/index.ts`

- [ ] **Step 1: Register CLI subcommands**

```typescript
// src/core/operations/adopt.ts
export function registerAdoptCommand(program: Command): void {
  const adopt = program.command("adopt").description("Migrate existing docs to canonical AI Spector layout");
  adopt.command("scan").option("--json").action(/* runAdoptScan */);
  adopt.command("plan").option("--json").option("--approve").option("--by <email>").option("--sync").action(/* */);
  adopt.command("apply").option("--dry-run").action(/* */);
  adopt.command("bootstrap").option("--json").option("--skip-analyze").action(/* */);
  adopt.command("validate").option("--json").option("--sync").action(/* */);
  adopt.command("setup-mark <item-id>").action(/* markAdoptSetupItem */);
  adopt.command("context-record <id> <answer>").description("Record Gate 1 answer").action(/* */);
}
```

Wire in `src/cli.ts` after template import:
```typescript
import { registerAdoptCommand } from "./core/operations/adopt.js";
// ...
registerAdoptCommand(program);
```

- [ ] **Step 2: Add MCP tools** (mirror `src/interfaces/mcp/tools/template.ts` pattern)

Schemas in `schemas.ts`:
```typescript
export const AdoptScanSchema = z.object({ root: z.string().optional() });
export const AdoptPlanSchema = z.object({ root: z.string().optional(), approve: z.boolean().optional(), sync: z.boolean().optional(), by: z.string().optional() });
// adopt_apply, adopt_bootstrap, adopt_validate, adopt_setup_mark, adopt_context_record
```

- [ ] **Step 3: Smoke test CLI**

Run: `npx ai-spector adopt scan --json` in repo root (expect classification output or init error)

- [ ] **Step 4: Commit**

```bash
git add src/core/operations/adopt.ts src/interfaces/cli/format/adopt.ts src/cli.ts src/interfaces/mcp/
git commit -m "feat(adopt): expose adopt commands via CLI and MCP"
```

---

### Task 11: Agent skill + routing

**Files:**
- Create: `.cursor/skills/ai-spector-adopt/SKILL.md`
- Create: `.cursor/skills/ai-spector-adopt/references/runbook.md`
- Modify: `.cursor/skills/_skill-router.md`
- Modify: `.cursor/rules/ai-spector-routing.mdc`
- Modify: `scaffold/cursor/skills/` (copy skill)
- Run: `npx ai-spector sync-claude` (updates claude scaffold)

- [ ] **Step 1: Write SKILL.md**

Frontmatter triggers:
```yaml
name: ai-spector-adopt
description: >-
  Migrate existing SRS, basic design, and prototype into canonical AI Spector layout.
  Use when project was initialized but docs are in wrong folders, or user says
  "migrate project", "adopt existing docs", "move SRS to ai-spector structure".
```

- [ ] **Step 2: Write runbook.md** — copy phases from spec §10.2 with exact CLI/MCP commands and human gate wording

- [ ] **Step 3: Add router entry** (priority before generate, after setup):

```
| Migrate existing docs / wrong SRS layout | ai-spector-adopt |
```

Triggers: "migrate", "adopt project", "wrong folder", "legacy SRS", "move docs to ai-spector structure"

- [ ] **Step 4: Sync scaffolds**

Run: `npx ai-spector sync-cursor && npx ai-spector sync-claude`

- [ ] **Step 5: Commit**

```bash
git add .cursor/skills/ai-spector-adopt .cursor/skills/_skill-router.md .cursor/rules/ai-spector-routing.mdc scaffold/
git commit -m "feat(adopt): add ai-spector-adopt agent skill and routing"
```

---

### Task 12: End-to-end integration test

**Files:**
- Create: `tests/adopt/integration.test.ts`

- [ ] **Step 1: Write integration test**

```typescript
describe("adopt integration", () => {
  it("migrates flat SRS to canonical layout and validates ready", async () => {
    await withTempDir(async (root) => {
      // scaffold init-like dirs
      // write docs/srs/1-introduction.md, docs/srs/use-cases/uc-UC-01-login.md
      // adopt scan → record context lang-primary=en → plan --approve → apply → bootstrap → validate
      const validation = await validateAdopt({ root });
      expect(validation.ready).toBe(true);
      const check = await runCheck({ root });
      expect(check.findings.some((f) => f.ruleId === "STRUCT-004")).toBe(false);
    });
  });
});
```

- [ ] **Step 2: Run full adopt test suite**

Run: `npm test -- tests/adopt/`
Expected: ALL PASS

- [ ] **Step 3: Run full test suite**

Run: `npm test`
Expected: PASS (no regressions)

- [ ] **Step 4: Commit**

```bash
git add tests/adopt/integration.test.ts
git commit -m "test(adopt): add end-to-end migration integration test"
```

---

## Spec coverage checklist

| Spec section | Task |
|--------------|------|
| §4 Human gates | Task 11 runbook |
| §5 CLI commands | Task 10 |
| §6 Scan & classify | Tasks 2–3 |
| §7 Plan & apply | Tasks 4–5 |
| §8 Bootstrap | Tasks 6–7 |
| §9 Validate + ADOPT-001 | Tasks 8–9 |
| §10 Agent skill | Task 11 |
| §12 Error handling (rollback) | Task 5 |
| §13 Testing | All tasks + Task 12 |
| §14 Out of scope | Not implemented (documented in spec) |

**v1 deferral (explicit):** Automated supplement analyze from partial data-source — bootstrap logs manual `/analyze` hint instead (spec §8.2 step 3 supplement path).

---

## Suggested implementation order

1. Tasks 1–2 (foundation + classify)
2. Tasks 3–5 (scan → plan → apply) — **first usable milestone**
3. Tasks 6–8 (bootstrap + validate)
4. Task 9 (check integration)
5. Tasks 10–12 (CLI/MCP/skill/e2e)

---

## Verification before merge

```bash
npm test -- tests/adopt/
npm test -- tests/commands/check.test.ts
npx ai-spector adopt scan --json   # in a fixture or dogfood repo
```
