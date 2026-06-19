# Derive Downstream Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let projects with existing basic + detail design backfill SRS via `sourceMode: derive-downstream` on generate tasks — extract pass first, optional expand pass — without requiring `knowledge.json` or prior analyze.

**Architecture:** Extend the existing generate task engine with `sourceMode` / `deriveFrom` / `derivePhase` on `TaskSnapshot`. Add a workflow-dependencies evaluator that reads `workflow.dependencies.json` mode blocks. Add a `derive-from-downstream` readiness tailoring profile with new probes. Agent runbooks branch on mode; ripple sync (upstream impact) ships in P3.

**Tech Stack:** TypeScript, Vitest, Commander CLI, MCP (Zod schemas), existing task engine + readiness + graph impact modules.

**Spec:** [`docs/superpowers/specs/2026-06-19-derive-downstream-design.md`](../specs/2026-06-19-derive-downstream-design.md)

---

## File map

| File | Responsibility |
|------|----------------|
| `src/core/operations/derive.ts` | `SourceMode`, `DeriveLayer`, `DerivePhase`; bootstrap validation; SRS completeness guard |
| `src/core/operations/task.ts` | Snapshot fields; bootstrap/create opts; expand-phase gate |
| `src/core/workflow/dependencies.ts` | Load + evaluate `workflow.dependencies.json` checks per mode |
| `src/core/operations/check.ts` | `STRUCT-DERIVE-*` findings when derive prerequisites fail |
| `src/core/readiness/probes.ts` | `downstreamDocsIndexed`, `graphDomainNodesFromDownstream` probes |
| `src/core/readiness/assess.ts` | `sourceMode` / `deriveFrom` options; auto-select derive profile |
| `scaffold/.../readiness/profiles/derive-from-downstream.json` | Tailoring overlay — DER-001..003 criteria |
| `scaffold/.../workspace/workflow.dependencies.json` | `modes.derive-downstream` for generate-srs + generate-basic-design |
| `src/core/graph/impact.ts` | `pass1_upstream`, `syncUpstream` bucket, `direction` option (P3) |
| `src/core/graph/rules/default-impact.json` | Upstream rules (P3) |
| `src/core/adopt/validate.ts` | Emit derive suggestion gaps (P2) |
| `src/interfaces/mcp/schemas.ts` | Bootstrap + readiness + workspace_check fields |
| `scaffold/cursor/skills/ai-spector-generate-srs/` | Mode branch in SKILL + runbook (P1) |
| `scaffold/cursor/skills/ai-spector-generate/` | Router phrases for backfill (P2) |
| `tests/derive/*.test.ts` | Unit + fixture tests |

---

## Phase P1 — Task schema + prerequisites + derive readiness + SRS extract docs

### Task 1: Derive types + bootstrap validation

**Files:**
- Create: `src/core/operations/derive.ts`
- Test: `tests/derive/derive.test.ts`

- [ ] **Step 1: Write failing validation tests**

```typescript
// tests/derive/derive.test.ts
import { describe, expect, it } from "vitest";
import {
  validateDeriveBootstrap,
  type DeriveBootstrapInput,
} from "@/core/operations/derive.js";

describe("validateDeriveBootstrap", () => {
  it("rejects derive-downstream without deriveFrom", () => {
    const input: DeriveBootstrapInput = {
      sourceMode: "derive-downstream",
      workflow: "generate-srs",
    };
    expect(() => validateDeriveBootstrap(input)).toThrow(/deriveFrom/);
  });

  it("accepts forward mode without deriveFrom", () => {
    expect(
      validateDeriveBootstrap({ sourceMode: "forward", workflow: "generate-srs" }),
    ).toEqual({ sourceMode: "forward", derivePhase: "extract" });
  });

  it("defaults derivePhase to extract", () => {
    const result = validateDeriveBootstrap({
      sourceMode: "derive-downstream",
      workflow: "generate-srs",
      deriveFrom: ["basic-design", "detail-design"],
    });
    expect(result.derivePhase).toBe("extract");
  });

  it("rejects expand without priorDeriveTaskId when no active extract task", () => {
    expect(() =>
      validateDeriveBootstrap({
        sourceMode: "derive-downstream",
        workflow: "generate-srs",
        deriveFrom: ["basic-design"],
        derivePhase: "expand",
      }),
    ).toThrow(/priorDeriveTaskId|completed extract/);
  });
});
```

- [ ] **Step 2: Run test — expect FAIL**

Run: `npm test -- tests/derive/derive.test.ts`  
Expected: FAIL — module not found

- [ ] **Step 3: Implement derive module**

```typescript
// src/core/operations/derive.ts
export type SourceMode = "forward" | "derive-downstream";
export type DeriveLayer = "basic-design" | "detail-design";
export type DerivePhase = "extract" | "expand";

export interface DeriveBootstrapInput {
  sourceMode?: SourceMode;
  workflow: string;
  deriveFrom?: DeriveLayer[];
  derivePhase?: DerivePhase;
  priorDeriveTaskId?: string;
}

export interface ValidatedDeriveBootstrap {
  sourceMode: SourceMode;
  deriveFrom?: DeriveLayer[];
  derivePhase: DerivePhase;
  priorDeriveTaskId?: string;
}

const SRS_MINIMUM_PATHS = [
  "docs/srs/1-introduction.md",
  "docs/srs/4-system-features.md",
] as const;

export function validateDeriveBootstrap(
  input: DeriveBootstrapInput,
): ValidatedDeriveBootstrap {
  const sourceMode = input.sourceMode ?? "forward";
  const derivePhase = input.derivePhase ?? "extract";

  if (sourceMode === "forward") {
    return { sourceMode, derivePhase: "extract" };
  }

  if (!input.deriveFrom?.length) {
    throw new Error(
      'derive-downstream requires non-empty deriveFrom (e.g. ["basic-design","detail-design"])',
    );
  }

  if (derivePhase === "expand" && !input.priorDeriveTaskId) {
    throw new Error(
      "derivePhase expand requires priorDeriveTaskId linking a completed extract task",
    );
  }

  return {
    sourceMode,
    deriveFrom: input.deriveFrom,
    derivePhase,
    priorDeriveTaskId: input.priorDeriveTaskId,
  };
}

export function defaultDeriveFromForWorkflow(workflow: string): DeriveLayer[] {
  if (workflow === "generate-srs") return ["basic-design", "detail-design"];
  if (workflow === "generate-basic-design") return ["detail-design"];
  return [];
}
```

- [ ] **Step 4: Run test — expect PASS**

Run: `npm test -- tests/derive/derive.test.ts`

- [ ] **Step 5: Commit**

```bash
git add src/core/operations/derive.ts tests/derive/derive.test.ts
git commit -m "feat(derive): add sourceMode bootstrap validation types"
```

---

### Task 2: Persist derive fields on task snapshot + bootstrap

**Files:**
- Modify: `src/core/operations/task.ts`
- Modify: `src/interfaces/mcp/schemas.ts`
- Test: `tests/derive/task-derive.test.ts`

- [ ] **Step 1: Write failing snapshot persistence test**

```typescript
// tests/derive/task-derive.test.ts
import { describe, expect, it } from "vitest";
import { mkdtemp, writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { runTaskCreate, runTaskList } from "@/core/operations/task.js";

async function minimalProject(root: string) {
  await mkdir(join(root, ".ai-spector/.docflow/tasks"), { recursive: true });
  await writeFile(
    join(root, ".ai-spector/.docflow/tasks/index.json"),
    JSON.stringify({ version: 1, active: {}, recent: [] }),
  );
}

describe("derive task bootstrap", () => {
  it("persists sourceMode on snapshot via task_list bootstrap", async () => {
    const root = await mkdtemp(join(tmpdir(), "derive-task-"));
    await minimalProject(root);

    const result = await runTaskList({
      root,
      bootstrap: {
        kind: "generate",
        workflow: "generate-srs",
        docType: "srs",
        trigger: "backfill SRS from basic design",
        sourceMode: "derive-downstream",
        deriveFrom: ["basic-design", "detail-design"],
      } as Parameters<typeof runTaskList>[0]["bootstrap"],
    });

    expect(result.bootstrapped?.task.snapshot.sourceMode).toBe("derive-downstream");
    expect(result.bootstrapped?.task.snapshot.deriveFrom).toEqual([
      "basic-design",
      "detail-design",
    ]);
    expect(result.bootstrapped?.task.snapshot.derivePhase).toBe("extract");
  });
});
```

- [ ] **Step 2: Run test — expect FAIL**

Run: `npm test -- tests/derive/task-derive.test.ts`

- [ ] **Step 3: Extend TaskSnapshot + bootstrap interfaces**

In `src/core/operations/task.ts`:

```typescript
import {
  validateDeriveBootstrap,
  type DeriveLayer,
  type DerivePhase,
  type SourceMode,
} from "./derive.js";

// TaskSnapshot — add:
sourceMode?: SourceMode;
deriveFrom?: DeriveLayer[];
derivePhase?: DerivePhase;
priorDeriveTaskId?: string;
deriveExpandOfferedAt?: string;

// TaskListBootstrap + TaskCreateOptions — add:
sourceMode?: SourceMode;
deriveFrom?: DeriveLayer[];
derivePhase?: DerivePhase;
priorDeriveTaskId?: string;
```

In `maybeBootstrapFromList`, after `validateDeriveBootstrap`, merge into `runTaskCreate` opts and set `task.snapshot` on create:

```typescript
const derive = validateDeriveBootstrap({
  sourceMode: bootstrap.sourceMode,
  workflow: bootstrap.workflow,
  deriveFrom: bootstrap.deriveFrom,
  derivePhase: bootstrap.derivePhase,
  priorDeriveTaskId: bootstrap.priorDeriveTaskId,
});

// In runTaskCreate, after building task:
snapshot: {
  sourceMode: derive.sourceMode,
  ...(derive.deriveFrom ? { deriveFrom: derive.deriveFrom } : {}),
  derivePhase: derive.derivePhase,
  ...(derive.priorDeriveTaskId ? { priorDeriveTaskId: derive.priorDeriveTaskId } : {}),
},
```

In `src/interfaces/mcp/schemas.ts`, extend `TaskListBootstrapSchema` and `TaskCreateSchema`:

```typescript
const DeriveLayerEnum = z.enum(["basic-design", "detail-design"]);
const SourceModeEnum = z.enum(["forward", "derive-downstream"]);
const DerivePhaseEnum = z.enum(["extract", "expand"]);

// Add to both bootstrap + create schemas:
sourceMode: SourceModeEnum.optional(),
deriveFrom: z.array(DeriveLayerEnum).optional(),
derivePhase: DerivePhaseEnum.optional(),
priorDeriveTaskId: z.string().optional(),
```

- [ ] **Step 4: Run test — expect PASS**

Run: `npm test -- tests/derive/task-derive.test.ts`

- [ ] **Step 5: Commit**

```bash
git add src/core/operations/task.ts src/interfaces/mcp/schemas.ts tests/derive/task-derive.test.ts
git commit -m "feat(derive): persist sourceMode on generate task snapshot"
```

---

### Task 3: Workflow dependencies evaluator (derive mode checks)

**Files:**
- Create: `src/core/workflow/dependencies.ts`
- Modify: `scaffold/.ai-spector/.docflow/config/workspace/workflow.dependencies.json`
- Test: `tests/derive/workflow-dependencies.test.ts`

- [ ] **Step 1: Write failing dependency evaluation test**

```typescript
// tests/derive/workflow-dependencies.test.ts
import { describe, expect, it } from "vitest";
import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { evaluateWorkflowStep } from "@/core/workflow/dependencies.js";

describe("evaluateWorkflowStep derive-downstream", () => {
  it("passes generate-srs derive mode when downstream docs exist", async () => {
    const root = await mkdtemp(join(tmpdir(), "wf-dep-"));
    await mkdir(join(root, "docs/basic-design/en"), { recursive: true });
    await writeFile(join(root, "docs/basic-design/en/screen-list.md"), "# Screens\n");
    // copy workflow.dependencies.json from scaffold into project (test helper)
    const result = await evaluateWorkflowStep(root, {
      stepId: "generate-srs",
      sourceMode: "derive-downstream",
    });
    expect(result.ok).toBe(true);
  });
});
```

- [ ] **Step 2: Run test — expect FAIL**

Run: `npm test -- tests/derive/workflow-dependencies.test.ts`

- [ ] **Step 3: Implement evaluator + JSON mode block**

`src/core/workflow/dependencies.ts` — load JSON from `workspaceWorkflowDependenciesPath(root)`, resolve step config:

- `sourceMode === "derive-downstream"` → use `step.modes["derive-downstream"]` if present
- Implement check types: `hasFilesAny`, `graphNodeCount` (load graph, count node types)
- Return `{ ok, failures: string[] }`

Add to `workflow.dependencies.json` under `generate-srs`:

```json
"modes": {
  "derive-downstream": {
    "requires": ["index-downstream"],
    "checks": [
      {
        "id": "downstream-docs-exist",
        "type": "hasFilesAny",
        "paths": ["docs/basic-design", "docs/detail-design"],
        "glob": "**/*.md",
        "min": 1,
        "fail": "Need basic-design or detail-design markdown before deriving SRS."
      },
      {
        "id": "graph-domain-nodes",
        "type": "graphNodeCount",
        "types": ["useCase", "feature", "actor"],
        "min": 1,
        "fail": "Graph has no domain nodes from downstream docs — run index first."
      }
    ]
  }
}
```

- [ ] **Step 4: Run test — expect PASS**

Run: `npm test -- tests/derive/workflow-dependencies.test.ts`

- [ ] **Step 5: Commit**

```bash
git add src/core/workflow/dependencies.ts scaffold/.ai-spector/.docflow/config/workspace/workflow.dependencies.json tests/derive/workflow-dependencies.test.ts
git commit -m "feat(derive): evaluate workflow.dependencies derive-downstream mode"
```

---

### Task 4: Workspace check integration

**Files:**
- Modify: `src/core/operations/check.ts`
- Modify: `src/interfaces/mcp/schemas.ts` (`WorkspaceCheckSchema`)
- Test: `tests/derive/check-derive.test.ts`

- [ ] **Step 1: Write failing check test**

Fixture: project with BD markdown, no `knowledge.json`, forward `generate-srs` blocked, derive mode passes.

- [ ] **Step 2: Run test — expect FAIL**

Run: `npm test -- tests/derive/check-derive.test.ts`

- [ ] **Step 3: Wire `evaluateWorkflowStep` into `runCheck`**

When `opts.workflow` + `opts.sourceMode` provided, emit finding `DERIVE-001` (error) per failed check, `DERIVE-002` (info) when derive mode available for missing SRS.

Extend `WorkspaceCheckSchema`:

```typescript
sourceMode: SourceModeEnum.optional(),
workflow: z.string().optional(),
```

- [ ] **Step 4: Run test — expect PASS**

- [ ] **Step 5: Commit**

```bash
git add src/core/operations/check.ts src/interfaces/mcp/schemas.ts tests/derive/check-derive.test.ts
git commit -m "feat(derive): workspace_check respects derive-downstream prerequisites"
```

---

### Task 5: Readiness derive profile + probes

**Files:**
- Create: `scaffold/.ai-spector/.docflow/config/readiness/profiles/derive-from-downstream.json`
- Modify: `src/core/readiness/probes.ts`
- Modify: `src/core/readiness/assess.ts`
- Modify: `src/core/operations/readiness.ts` (MCP `readiness_assess` opts)
- Test: `tests/derive/readiness-derive.test.ts`

- [ ] **Step 1: Write failing readiness test**

Fixture: BD+DD files + graph with feature nodes, no knowledge.json — `readiness_assess({ docType: "srs", sourceMode: "derive-downstream" })` → `ready: true`, applied profile includes `derive-from-downstream`.

- [ ] **Step 2: Run test — expect FAIL**

- [ ] **Step 3: Add tailoring profile**

```json
{
  "id": "derive-from-downstream",
  "title": "Derive from downstream design",
  "description": "Input gates when generating SRS/basic-design from existing lower layers.",
  "extends": "srs",
  "addGlobalCriteria": [
    {
      "id": "DER-001",
      "dimension": "inputs",
      "severity": "blocking",
      "question": "Are downstream design documents indexed?",
      "graphProbe": "downstreamDocsIndexed"
    },
    {
      "id": "DER-002",
      "dimension": "graph",
      "severity": "blocking",
      "question": "Does the graph contain domain nodes from downstream docs?",
      "graphProbe": "graphDomainNodesFromDownstream",
      "minGraphCount": 1
    },
    {
      "id": "DER-003",
      "dimension": "inputs",
      "severity": "should-ask",
      "question": "Is docs/data-source/ available to supplement gaps in expand pass?",
      "graphProbe": "dataSourcePresent"
    }
  ],
  "disableAssumptions": ["knowledge-populated", "analysis-complete"]
}
```

In `probes.ts`, handle new `graphProbe` strings:

```typescript
if (criterion.graphProbe === "downstreamDocsIndexed") {
  // inventory.deriveFrom layers — pass via extended ProbeInventory
}
if (criterion.graphProbe === "graphDomainNodesFromDownstream") {
  const types = ["useCase", "feature", "actor"];
  const count = types.reduce((n, t) => n + (inventory.nodeCounts[t] ?? 0), 0);
  // compare to minGraphCount
}
```

In `assess.ts`:

```typescript
export interface ReadinessAssessOptions {
  // existing...
  sourceMode?: SourceMode;
  deriveFrom?: DeriveLayer[];
  derivePhase?: DerivePhase;
}

// When sourceMode === "derive-downstream" && derivePhase !== "expand":
//   profile override = "derive-from-downstream"
```

- [ ] **Step 4: Run test — expect PASS**

Run: `npm test -- tests/derive/readiness-derive.test.ts`

- [ ] **Step 5: Commit**

```bash
git add scaffold/.ai-spector/.docflow/config/readiness/profiles/derive-from-downstream.json src/core/readiness/probes.ts src/core/readiness/assess.ts src/core/operations/readiness.ts tests/derive/readiness-derive.test.ts
git commit -m "feat(derive): derive-from-downstream readiness profile and probes"
```

---

### Task 6: SRS overwrite guard

**Files:**
- Modify: `src/core/operations/derive.ts`
- Modify: `src/core/operations/task.ts` (call guard in `runTaskCreate`)
- Test: `tests/derive/derive.test.ts` (extend)

- [ ] **Step 1: Write failing guard test**

```typescript
import { assertDeriveNotBlockedByCompleteSrs } from "@/core/operations/derive.js";

it("blocks derive when SRS minimum already complete", async () => {
  const root = /* fixture with docs/srs/1-introduction.md + 4-system-features.md */;
  await expect(assertDeriveNotBlockedByCompleteSrs(root, "generate-srs")).rejects.toThrow(
    /complete SRS/,
  );
});
```

- [ ] **Step 2–4: Implement + pass**

`assertDeriveNotBlockedByCompleteSrs(root, workflow)` — all `SRS_MINIMUM_PATHS` exist and index populated → throw with resolve-task suggestion.

Call from `runTaskCreate` when `sourceMode === "derive-downstream"` and workflow is `generate-srs`.

- [ ] **Step 5: Commit**

```bash
git commit -m "feat(derive): block derive-downstream when SRS already complete"
```

---

### Task 7: Generate SRS skill — derive mode branch (scaffold)

**Files:**
- Modify: `scaffold/cursor/skills/ai-spector-generate-srs/SKILL.md`
- Modify: `scaffold/cursor/skills/ai-spector-generate-srs/references/runbook.md`
- Modify: `scaffold/claude/.claude/skills/ai-spector-generate-srs/skill.md` (sync via existing scaffold copy or manual mirror)

- [ ] **Step 1: Add Step 0b — Derive mode detection**

After task_list bootstrap, document:

```
When user intent is backfill / derive / "from basic design":
  sourceMode: "derive-downstream"
  deriveFrom: ["basic-design", "detail-design"]
  derivePhase: "extract"
```

- [ ] **Step 2: Add briefing + plan table columns**

Mandatory plan columns when derive: `Mode | Sources | Gaps expected`

- [ ] **Step 3: Add generate prompt constraints**

Extract pass only:
- Do not invent business context
- Use `[DERIVE-GAP: reason]` for silent downstream sources
- Add `tracesTo` references to basic/detail sections

- [ ] **Step 4: Add `readiness_assess` call shape**

```
readiness_assess({ docType: "srs", sourceMode: "derive-downstream", deriveFrom: [...] })
```

- [ ] **Step 5: Commit**

```bash
git add scaffold/cursor/skills/ai-spector-generate-srs/ scaffold/claude/.claude/skills/ai-spector-generate-srs/
git commit -m "docs(derive): generate-srs skill derive-downstream mode runbook"
```

---

### Task 8: P1 E2E fixture test

**Files:**
- Create: `tests/fixtures/derive-bd-dd-no-srs/` (minimal BD+DD, graph, no SRS)
- Create: `tests/derive/e2e-fixture.test.ts`

- [ ] **Step 1: Add fixture** — `docs/basic-design/en/screen-list.md`, `docs/detail-design/en/feature-list.md`, `.ai-spector/graph/traceability.graph.json` with feature nodes linked to docs

- [ ] **Step 2: Test workflow deps + readiness pass on fixture**

```typescript
it("fixture passes derive-downstream gates without knowledge.json", async () => {
  const root = fixturePath("derive-bd-dd-no-srs");
  const wf = await evaluateWorkflowStep(root, { stepId: "generate-srs", sourceMode: "derive-downstream" });
  expect(wf.ok).toBe(true);
  const readiness = await assessReadiness({ root, docType: "srs", sourceMode: "derive-downstream" });
  expect(readiness.ready).toBe(true);
});
```

- [ ] **Step 3: Run + commit**

```bash
npm test -- tests/derive/
git commit -m "test(derive): add bd+dd no-srs fixture and e2e gate tests"
```

---

## Phase P2 — Expand pass + adopt handoff + routing

### Task 9: Expand phase task transition

**Files:**
- Modify: `src/core/operations/task.ts`
- Modify: `src/core/operations/task-gates.ts`
- Test: `tests/derive/task-expand.test.ts`

- [ ] **Step 1: Test expand bootstrap requires completed extract task**

When `derivePhase: "expand"` + `priorDeriveTaskId`:
- Load prior task; assert `status === "complete"` and `snapshot.derivePhase === "extract"`
- New task snapshot: `derivePhase: "expand"`, copy `deriveFrom`

- [ ] **Step 2: On extract `task_complete`, set `deriveExpandOfferedAt`**

In `runTaskComplete`, when `snapshot.sourceMode === "derive-downstream"` && `derivePhase === "extract"`:

```typescript
task.snapshot.deriveExpandOfferedAt = new Date().toISOString();
```

- [ ] **Step 3: Expand uses forward readiness profile**

`assessReadiness` with `derivePhase: "expand"` → default profile (not derive overlay)

- [ ] **Step 4: Commit**

```bash
git commit -m "feat(derive): expand phase task linking and completion offer"
```

---

### Task 10: Adopt validate derive suggestion

**Files:**
- Modify: `src/core/adopt/validate.ts`
- Modify: `src/core/adopt/types.ts` (extend `AdoptValidationGap` if needed)
- Test: `tests/adopt/validate-derive.test.ts`

- [ ] **Step 1: Detect missing SRS with BD+DD present**

After structural checks, if:
- `docs/srs/**` empty or missing minimum
- `docs/basic-design/**` and `docs/detail-design/**` have files

Push gap:

```typescript
{
  id: "derive.srs-missing",
  severity: "warning",
  message: "SRS missing but basic + detail design exist.",
  fix: 'Say "generate SRS from basic design" (sourceMode: derive-downstream, extract pass)',
  layer: "srs",
  suggestion: "generate-srs",
  deriveFrom: ["basic-design", "detail-design"],
}
```

- [ ] **Step 2: Update adopt runbook** — post-validate message from spec §9

- [ ] **Step 3: Commit**

```bash
git commit -m "feat(derive): adopt validate suggests derive-downstream for missing SRS"
```

---

### Task 11: Routing + WORKFLOW.md

**Files:**
- Modify: `scaffold/cursor/skills/ai-spector-generate/SKILL.md`
- Modify: `scaffold/cursor/skills/_skill-router.md`
- Modify: `scaffold/cursor/WORKFLOW.md`
- Modify: `src/core/workflow/route-intent-examples.ts`
- Test: `tests/workflow/route-intent-derive.test.ts`

- [ ] **Step 1: Add route examples**

```typescript
{ message: "backfill SRS from basic design", skill: "ai-spector-generate-srs", bootstrap: { sourceMode: "derive-downstream" } },
{ message: "expand SRS to full", skill: "ai-spector-generate-srs", bootstrap: { derivePhase: "expand" } },
```

- [ ] **Step 2: WORKFLOW.md row**

| Backfill SRS from design | "generate SRS from basic design", "backfill SRS" | `ai-spector-generate-srs` | `sourceMode: derive-downstream`, extract pass first |

- [ ] **Step 3: Run route tests + commit**

```bash
npm test -- tests/workflow/route-intent-derive.test.ts
git commit -m "docs(derive): routing and WORKFLOW entries for backfill SRS"
```

---

### Task 12: Spec provenance on extract

**Files:**
- Modify: `src/core/operations/spec.ts` (or spec_record handler)
- Test: `tests/derive/spec-provenance.test.ts`

- [ ] **Step 1: Allow `provenance: "derive-downstream"` on spec_record**

- [ ] **Step 2: spec_list shows provenance field**

- [ ] **Step 3: Commit**

```bash
git commit -m "feat(derive): spec_record provenance for derive-downstream"
```

---

## Phase P3 — Basic design derive + upstream impact

### Task 13: Basic design derive mode

**Files:**
- Modify: `workflow.dependencies.json` — `generate-basic-design.modes.derive-downstream`
- Modify: `scaffold/cursor/skills/ai-spector-generate-basic-design/SKILL.md`
- Test: `tests/derive/basic-design-derive.test.ts`

- [ ] **Step 1: Mode checks** — detail-design files + graph feature/screen nodes

- [ ] **Step 2: Skill branch** — same pattern as SRS Task 7

- [ ] **Step 3: Commit**

```bash
git commit -m "feat(derive): basic-design derive-downstream from detail design"
```

---

### Task 14: Upstream graph impact

**Files:**
- Modify: `src/core/graph/impact.ts`
- Modify: `src/core/graph/rules/default-impact.json`
- Modify: `schemas/rules.impact.json`
- Modify: `src/cli.ts` (`graph impact --direction both`)
- Modify: `scaffold/cursor/skills/ai-spector-graph/references/impact.md`
- Test: `tests/graph/impact-upstream.test.ts`

- [ ] **Step 1: Write failing upstream test**

Graph: SRS feature ← tracesTo ← BD section. Edit BD seed → `syncUpstream` contains SRS path.

- [ ] **Step 2: Extend ImpactRulesFile**

```typescript
pass1_upstream?: Record<string, EdgeRule>;
buckets: {
  regenerate: NodeType[];
  review: NodeType[];
  syncUpstream?: NodeType[];
};
```

- [ ] **Step 3: Add `direction` param to `computeImpact`**

`"downstream" | "upstream" | "both"` — default `"downstream"` for backward compat.

- [ ] **Step 4: Extend ImpactResult**

```typescript
syncUpstream: ImpactEntry[];
```

- [ ] **Step 5: CLI flag**

```bash
npx ai-spector graph impact --git --direction both --json
```

- [ ] **Step 6: Run tests + commit**

```bash
npm test -- tests/graph/impact-upstream.test.ts
git commit -m "feat(derive): graph impact upstream sync-upstream bucket"
```

---

### Task 15: After-doc-edits + graph skill docs

**Files:**
- Modify: `scaffold/cursor/rules/after-doc-edits.mdc`
- Modify: `scaffold/claude/.claude/rules/after-doc-edits.mdc`

- [ ] **Step 1: Document `--direction both` when editing basic-design**

When `syncUpstream` non-empty → offer resolve-task Standard plan (suggest-only, no auto regen).

- [ ] **Step 2: Commit**

```bash
git commit -m "docs(derive): upstream impact handoff in after-doc-edits rule"
```

---

## Verification checklist (end of P1–P3)

Run before marking complete:

```bash
npm test -- tests/derive/
npm test -- tests/graph/impact-upstream.test.ts
npm test -- tests/adopt/validate-derive.test.ts
npm run build
npx ai-spector check --workflow generate-srs --source-mode derive-downstream  # after CLI wired
```

Manual agent smoke (fixture project):

1. `task_list` bootstrap with `sourceMode: derive-downstream`
2. `workspace_check` passes without knowledge.json
3. `readiness_assess` returns DER-* criteria, `ready: true`
4. Plan table shows extract mode
5. After mock generate + `task_complete`, expand offer present

---

## Spec coverage map

| Spec § | Task(s) |
|--------|---------|
| §4 Task bootstrap schema | 1, 2 |
| §5 Prerequisite overrides | 3, 4 |
| §6 Two-pass generation | 7, 9, 12 |
| §7 Readiness profile | 5 |
| §8 Routing | 11 |
| §9 Adopt handoff | 10 |
| §10 Upstream impact | 14, 15 |
| §11 Error handling | 6, 1 |
| §14 Testing | 8, all test tasks |
