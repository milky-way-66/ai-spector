# Adopt v2 Gated Workflow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Upgrade `ai-spector-adopt` to a first-class gated task workflow (`kind: adopt`) with `task_approve_adopt_plan`, server gates on adopt CLI/MCP tools, and full detail-design scan/plan/apply/validate parity.

**Architecture:** Mirror `template-import-gates.ts` + `task_approve_import_plan` pattern. Extend existing `src/core/adopt/*` (scan/classify/plan/apply) — no new top-level workflow skill. Task engine owns step order; disk artifacts (`plan.json`, `scan-result.json`) stay authoritative for moves.

**Tech Stack:** TypeScript, Commander CLI, Vitest, existing adopt module + task engine + MCP server.

**Spec:** [`docs/superpowers/specs/2026-06-18-adopt-v2-gated-workflow-design.md`](../specs/2026-06-18-adopt-v2-gated-workflow-design.md)

---

## File map

| File | Responsibility |
|------|----------------|
| `src/core/operations/task-templates.ts` | `adopt` workflow + `ADOPT_STEPS`; extend `TaskKind` |
| `src/core/operations/task.ts` | `StoredPlan` adopt variant; snapshot fields; `runTaskApproveAdoptPlan` |
| `src/core/operations/adopt-plan.ts` | `AdoptPlanSummary`, `buildAdoptPlanSummary()` from `plan.json` |
| `src/core/operations/adopt-gates.ts` | Gate assertions for apply/bootstrap/setup-mark/approve |
| `src/core/operations/task-gates.ts` | Reject `task_approve_plan` when `kind === "adopt"` |
| `src/core/adopt/types.ts` | `detail-design` layer + `classification.detailDesign` |
| `src/core/adopt/scan.ts` | DD scan dir + legacy alias inventory |
| `src/core/adopt/classify.ts` | DD manifest scoring |
| `src/core/adopt/plan.ts` | DD move targets |
| `src/core/adopt/tasks.ts` | Completed `generate-detail-design` adopt tasks |
| `src/core/adopt/apply.ts` | Call `assertAdoptApplyAllowed` |
| `src/core/adopt/bootstrap.ts` | Call `assertAdoptBootstrapAllowed` |
| `src/core/adopt/setup.ts` | Call gate on `migration.complete` |
| `src/core/operations/adopt.ts` | `--legacy` flags on subcommands |
| `src/cli.ts` | `task approve-adopt-plan` |
| `src/interfaces/mcp/tools/adopt.ts` | Pass legacy + load active task for gates |
| `src/interfaces/mcp/server.ts` | Register `task_approve_adopt_plan` |
| `src/core/workflow/route-intent-examples.ts` | "align legacy docs" → adopt |
| `scaffold/cursor/skills/ai-spector-adopt/` | Gated runbook |
| `scaffold/cursor/WORKFLOW.md` | Legacy alignment row |
| `scaffold/cursor/skills/_skill-router.md` | Triggers |
| `scaffold/cursor/rules/ai-spector-routing.mdc` | Triggers |
| `tests/adopt/gates.test.ts` | Gate unit tests |
| `tests/adopt/detail-design.test.ts` | DD scan/plan tests |
| `tests/adopt/task-adopt.test.ts` | Task template + approve flow |

---

### Task 1: Adopt workflow template + task kind

**Files:**
- Modify: `src/core/operations/task-templates.ts`
- Test: `tests/adopt/task-adopt.test.ts`

- [ ] **Step 1: Write failing template test**

```typescript
// tests/adopt/task-adopt.test.ts
import { describe, expect, it } from "vitest";
import {
  activeSlotFor,
  getWorkflowTemplate,
  WORKFLOW_TEMPLATES,
} from "@/core/operations/task-templates.js";

describe("adopt workflow template", () => {
  it("registers adopt workflow with 7 steps", () => {
    expect(WORKFLOW_TEMPLATES.adopt).toBeDefined();
    expect(WORKFLOW_TEMPLATES.adopt.kind).toBe("adopt");
    const steps = getWorkflowTemplate("adopt").steps.map((s) => s.id);
    expect(steps).toEqual([
      "check",
      "clarify",
      "plan",
      "apply",
      "bootstrap",
      "validate",
      "complete",
    ]);
  });

  it("uses adopt slot", () => {
    expect(activeSlotFor("adopt", "adopt")).toBe("adopt");
  });
});
```

- [ ] **Step 2: Run test — expect FAIL**

Run: `npm test -- tests/adopt/task-adopt.test.ts`

- [ ] **Step 3: Implement template**

```typescript
// src/core/operations/task-templates.ts — add to TaskKind
export type TaskKind = "generate" | "resolve" | "import" | "adopt";

// Add BuiltinWorkflowId union member: | "adopt"

const ADOPT_STEPS: TemplateStep[] = [
  { id: "check", phase: "check", description: "Validate workspace; confirm adopt candidate" },
  { id: "clarify", phase: "clarify", description: "Scan + resolve blocking classification questions" },
  { id: "plan", phase: "plan", description: "Present move mapping table; user approves" },
  { id: "apply", phase: "execute", description: "Execute approved file moves" },
  { id: "bootstrap", phase: "execute", description: "Index, optional analyze, prototype, review registry" },
  { id: "validate", phase: "verify", description: "Workspace + graph readiness gate" },
  { id: "complete", phase: "report", description: "Mark migration complete; unlock pipeline" },
];

// In WORKFLOW_TEMPLATES:
adopt: { id: "adopt", kind: "adopt", steps: ADOPT_STEPS },

// In activeSlotFor, before generate branches:
if (kind === "adopt") return "adopt";
```

- [ ] **Step 4: Run test — expect PASS**

Run: `npm test -- tests/adopt/task-adopt.test.ts`

- [ ] **Step 5: Commit**

```bash
git add src/core/operations/task-templates.ts tests/adopt/task-adopt.test.ts
git commit -m "feat(adopt): register adopt as first-class task workflow"
```

---

### Task 2: Adopt plan summary + StoredPlan variant

**Files:**
- Create: `src/core/operations/adopt-plan.ts`
- Modify: `src/core/operations/task.ts`
- Test: `tests/adopt/task-adopt.test.ts` (extend)

- [ ] **Step 1: Write failing summary test**

```typescript
// append to tests/adopt/task-adopt.test.ts
import { buildAdoptPlanSummary } from "@/core/operations/adopt-plan.js";
import type { AdoptPlan } from "@/core/adopt/types.js";

describe("buildAdoptPlanSummary", () => {
  it("counts moves per layer including detail-design", () => {
    const plan: AdoptPlan = {
      version: 1,
      status: "draft",
      approvedAt: null,
      approvedBy: null,
      moves: [
        {
          from: "docs/srs/a.md",
          to: "docs/srs/en/a.md",
          layer: "srs",
          confidence: "high",
          reason: "test",
        },
        {
          from: "docs/dd/f.md",
          to: "docs/detail-design/en/features/f.md",
          layer: "detail-design",
          confidence: "medium",
          reason: "test",
        },
      ],
      configPatches: [],
      prototypeActions: [],
      warnings: [],
      blockingIssues: [],
    };
    const summary = buildAdoptPlanSummary(plan, {
      srs: "reshaped",
      basicDesign: "missing",
      detailDesign: "reshaped",
      prototype: "missing",
      languages: { detected: ["en"], strategy: "flat" },
      dataSource: "absent",
      activePack: "builtin",
    });
    expect(summary.moveCount).toBe(2);
    expect(summary.layers.detailDesign).toBe(1);
    expect(summary.lowConfidenceCount).toBe(0);
  });
});
```

- [ ] **Step 2: Run test — expect FAIL**

- [ ] **Step 3: Implement adopt-plan.ts + extend types**

```typescript
// src/core/operations/adopt-plan.ts
import type { AdoptPlan, AdoptScanResult } from "../adopt/types.js";

export interface AdoptPlanSummary {
  moveCount: number;
  layers: { srs: number; basicDesign: number; detailDesign: number; prototype: number };
  lowConfidenceCount: number;
  classification: AdoptScanResult["classification"];
  warnings: string[];
}

export function buildAdoptPlanSummary(
  plan: AdoptPlan,
  classification: AdoptScanResult["classification"],
): AdoptPlanSummary {
  const layers = { srs: 0, basicDesign: 0, detailDesign: 0, prototype: 0 };
  let lowConfidenceCount = 0;
  for (const move of plan.moves) {
    if (move.layer === "srs") layers.srs++;
    else if (move.layer === "basic-design") layers.basicDesign++;
    else if (move.layer === "detail-design") layers.detailDesign++;
    else if (move.layer === "prototype") layers.prototype++;
    if (move.confidence === "low") lowConfidenceCount++;
  }
  return {
    moveCount: plan.moves.length,
    layers,
    lowConfidenceCount,
    classification,
    warnings: plan.warnings,
  };
}
```

```typescript
// src/core/operations/task.ts — StoredPlan
import type { AdoptPlanSummary } from "./adopt-plan.js";

export type StoredPlan =
  | { kind: "resolve"; plan: TaskPlan }
  | { kind: "generate"; plan: GeneratePlan }
  | { kind: "import"; plan: ImportPlan }
  | { kind: "adopt"; plan: AdoptPlanSummary };

// TaskSnapshot — add fields:
adoptScanAt?: string;
adoptClarifyCompleteAt?: string;
adoptPlanPresentedAt?: string;
adoptApplyAt?: string;
adoptBootstrapAt?: string;
adoptValidateReadyAt?: string;
adoptForkedToImportAt?: string;
```

Update `src/core/adopt/types.ts` — extend `AdoptMove.layer` and inventory `layer` to include `"detail-design"`; add `detailDesign` to `classification` in `AdoptScanResult`.

- [ ] **Step 4: Run test — expect PASS**

- [ ] **Step 5: Commit**

```bash
git add src/core/operations/adopt-plan.ts src/core/operations/task.ts src/core/adopt/types.ts tests/adopt/task-adopt.test.ts
git commit -m "feat(adopt): add AdoptPlanSummary and StoredPlan adopt variant"
```

---

### Task 3: Adopt gates module

**Files:**
- Create: `src/core/operations/adopt-gates.ts`
- Test: `tests/adopt/gates.test.ts`

- [ ] **Step 1: Write failing gate tests**

```typescript
// tests/adopt/gates.test.ts
import { describe, expect, it } from "vitest";
import { TaskPreconditionError } from "@/core/operations/task-gates.js";
import {
  assertTaskApproveAdoptPlanAllowed,
  assertAdoptApplyAllowed,
} from "@/core/operations/adopt-gates.js";
import type { TaskState } from "@/core/operations/task.js";
import { getWorkflowTemplate } from "@/core/operations/task-templates.js";

function makeAdoptTask(overrides: Partial<TaskState> = {}): TaskState {
  const now = new Date().toISOString();
  const template = getWorkflowTemplate("adopt");
  return {
    version: 1,
    id: "task-adopt-test",
    kind: "adopt",
    workflow: "adopt",
    status: "active",
    createdAt: now,
    updatedAt: now,
    trigger: "test",
    phase: "plan",
    phaseStatus: "in_progress",
    goal: null,
    plan: null,
    planApprovedAt: null,
    steps: template.steps.map((s) => ({
      ...s,
      status: "pending" as const,
      blocker: null,
      artifacts: [],
    })),
    currentStepId: "plan",
    nextAction: "plan",
    blockers: [],
    contextRefs: {},
    snapshot: {},
    ...overrides,
  };
}

describe("assertTaskApproveAdoptPlanAllowed", () => {
  it("rejects when check/clarify incomplete", () => {
    const task = makeAdoptTask();
    expect(() => assertTaskApproveAdoptPlanAllowed(task)).toThrow(TaskPreconditionError);
  });

  it("allows when gates satisfied", () => {
    const task = makeAdoptTask({
      snapshot: {
        workspaceCheckAt: "t",
        adoptClarifyCompleteAt: "t",
        adoptPlanPresentedAt: "t",
      },
      plan: {
        kind: "adopt",
        plan: {
          moveCount: 1,
          layers: { srs: 1, basicDesign: 0, detailDesign: 0, prototype: 0 },
          lowConfidenceCount: 0,
          classification: {
            srs: "reshaped",
            basicDesign: "missing",
            detailDesign: "missing",
            prototype: "missing",
            languages: { detected: ["en"], strategy: "flat" },
            dataSource: "absent",
            activePack: "builtin",
          },
          warnings: [],
        },
      },
      steps: makeAdoptTask().steps.map((s) => ({
        ...s,
        status: s.id === "check" || s.id === "clarify" ? "done" : s.status,
      })),
    });
    expect(() => assertTaskApproveAdoptPlanAllowed(task)).not.toThrow();
  });
});

describe("assertAdoptApplyAllowed", () => {
  it("rejects without plan approval", () => {
    const task = makeAdoptTask();
    expect(() => assertAdoptApplyAllowed(task, { legacy: false })).toThrow(TaskPreconditionError);
  });

  it("allows legacy bypass", () => {
    expect(() => assertAdoptApplyAllowed(null, { legacy: true })).not.toThrow();
  });
});
```

- [ ] **Step 2: Run test — expect FAIL**

- [ ] **Step 3: Implement adopt-gates.ts**

```typescript
// src/core/operations/adopt-gates.ts
import type { TaskState } from "./task.js";
import { TaskPreconditionError } from "./task-gates.js";
import { readJson } from "../util/fs.js";
import { adoptArtifactPaths } from "../adopt/paths.js";
import type { AdoptPlan } from "../adopt/types.js";

function stepStatus(task: TaskState, stepId: string): string {
  return task.steps.find((s) => s.id === stepId)?.status ?? "missing";
}

export function assertTaskApproveAdoptPlanAllowed(
  task: TaskState,
): asserts task is TaskState & { plan: { kind: "adopt" } } {
  if (task.kind !== "adopt") {
    throw new TaskPreconditionError(
      "step_premature",
      `task_approve_adopt_plan is only for adopt tasks (got kind "${task.kind}").`,
      "Use task_approve_plan for generate/resolve; task_approve_import_plan for import.",
      ["task_approve_plan", "task_approve_import_plan"],
      task,
    );
  }
  if (task.planApprovedAt) {
    throw new TaskPreconditionError(
      "plan_already_approved",
      `Adopt task "${task.id}" plan already approved.`,
      "Continue with adopt_apply. Do not call task_approve_adopt_plan again.",
      ["adopt_apply", "task_get"],
      task,
    );
  }
  if (!task.plan || task.plan.kind !== "adopt") {
    throw new TaskPreconditionError(
      "plan_missing",
      `Adopt task "${task.id}" has no adopt plan summary.`,
      "Run adopt_plan, store summary via task_update, present mapping table.",
      ["adopt_plan", "task_update"],
      task,
      "plan",
    );
  }
  if (stepStatus(task, "check") !== "done" || !task.snapshot.workspaceCheckAt) {
    throw new TaskPreconditionError(
      "step_incomplete",
      `Adopt task "${task.id}" — complete check first.`,
      "Run workspace_check, set snapshot.workspaceCheckAt, mark check done.",
      ["workspace_check", "task_update"],
      task,
      "check",
    );
  }
  if (stepStatus(task, "clarify") !== "done" || !task.snapshot.adoptClarifyCompleteAt) {
    throw new TaskPreconditionError(
      "step_incomplete",
      `Adopt task "${task.id}" — complete clarify first.`,
      "Resolve adopt_scan blocking questions, set adoptClarifyCompleteAt.",
      ["adopt_scan", "adopt_context_record", "task_update"],
      task,
      "clarify",
    );
  }
  if (!task.snapshot.adoptPlanPresentedAt) {
    throw new TaskPreconditionError(
      "snapshot_missing",
      `Adopt task "${task.id}" — mapping table not presented.`,
      "Show mapping table in chat, set snapshot.adoptPlanPresentedAt.",
      ["task_update"],
      task,
      "plan",
    );
  }
  if (stepStatus(task, "plan") === "done") {
    throw new TaskPreconditionError(
      "step_premature",
      `Adopt task "${task.id}" plan step done without task_approve_adopt_plan.`,
      "Wait for user yes, then task_approve_adopt_plan — not task_update on plan.",
      ["task_approve_adopt_plan"],
      task,
      "plan",
    );
  }
}

export function assertAdoptApplyAllowed(
  task: TaskState | null,
  opts: { legacy?: boolean },
): void {
  if (opts.legacy) return;
  if (!task || task.kind !== "adopt") {
    throw new TaskPreconditionError(
      "step_incomplete",
      "adopt_apply requires an active adopt task or --legacy.",
      'task_create({ kind: "adopt", workflow: "adopt" }) then task_approve_adopt_plan.',
      ["task_create", "task_approve_adopt_plan"],
      task ?? ({ id: "none", kind: "adopt", workflow: "adopt" } as TaskState),
      "apply",
    );
  }
  if (!task.planApprovedAt || stepStatus(task, "plan") !== "done") {
    throw new TaskPreconditionError(
      "plan_not_approved",
      `Cannot apply — adopt plan not approved for task "${task.id}".`,
      "Present mapping table and call task_approve_adopt_plan after user confirms.",
      ["task_approve_adopt_plan"],
      task,
      "plan",
    );
  }
}

export async function assertAdoptPlanApprovedOnDisk(root: string): Promise<AdoptPlan> {
  const { plan: planPath } = adoptArtifactPaths(root);
  const plan = await readJson<AdoptPlan>(planPath);
  if (plan.status !== "approved" && plan.status !== "applied") {
    throw new Error(`adopt plan status is "${plan.status}" — expected approved`);
  }
  return plan;
}

export function assertAdoptBootstrapAllowed(
  task: TaskState | null,
  opts: { legacy?: boolean },
): void {
  if (opts.legacy) return;
  if (!task || task.kind !== "adopt") {
    throw new Error("adopt_bootstrap requires active adopt task or --legacy");
  }
  if (stepStatus(task, "apply") !== "done" || !task.snapshot.adoptApplyAt) {
    throw new TaskPreconditionError(
      "step_incomplete",
      `Adopt task "${task.id}" — complete apply before bootstrap.`,
      "Run adopt_apply after plan approval, mark apply done.",
      ["adopt_apply", "task_update"],
      task,
      "bootstrap",
    );
  }
}

export function assertAdoptMigrationCompleteAllowed(
  task: TaskState | null,
  opts: { legacy?: boolean; validateReady: boolean },
): void {
  if (opts.legacy) return;
  if (!task || task.kind !== "adopt") {
    throw new Error("migration.complete requires active adopt task or --legacy");
  }
  if (!opts.validateReady) {
    throw new Error("adopt_validate must report ready: true before migration.complete");
  }
  if (stepStatus(task, "validate") !== "done" || !task.snapshot.adoptValidateReadyAt) {
    throw new TaskPreconditionError(
      "step_incomplete",
      `Adopt task "${task.id}" — complete validate before migration.complete.`,
      "Run adopt_validate until ready, mark validate done.",
      ["adopt_validate", "task_update"],
      task,
      "complete",
    );
  }
}
```

- [ ] **Step 4: Run test — expect PASS**

- [ ] **Step 5: Commit**

```bash
git add src/core/operations/adopt-gates.ts tests/adopt/gates.test.ts
git commit -m "feat(adopt): add server gate assertions for adopt workflow"
```

---

### Task 4: task_approve_adopt_plan + reject in task_approve_plan

**Files:**
- Modify: `src/core/operations/task.ts`
- Modify: `src/core/operations/task-gates.ts`
- Modify: `src/cli.ts`
- Modify: `src/interfaces/mcp/server.ts`
- Modify: `src/interfaces/mcp/tool-names.ts`
- Test: `tests/adopt/task-adopt.test.ts` (extend)

- [ ] **Step 1: Write failing approve integration test**

Use `withTempDir` + write minimal task file under `.ai-spector/.docflow/tasks/`. Call `runTaskApproveAdoptPlan` after seeding scan-result + plan.json draft; expect `planApprovedAt` set and `approveAdoptPlan` called (mock or verify plan.json status).

- [ ] **Step 2: Implement `runTaskApproveAdoptPlan`**

Mirror `runTaskApproveImportPlan`:

```typescript
export async function runTaskApproveAdoptPlan(opts: {
  root?: string;
  taskId: string;
  plan?: StoredPlan;
  by?: string;
}): Promise<TaskApprovePlanResult> {
  const root = await resolveRoot(opts.root);
  const task = parseTask(await loadTask(root, opts.taskId));
  if (opts.plan) task.plan = opts.plan;
  assertTaskApproveAdoptPlanAllowed(task);

  const { approveAdoptPlan } = await import("../adopt/plan.js");
  await approveAdoptPlan({ root, by: opts.by });

  const now = new Date().toISOString();
  task.planApprovedAt = now;
  const planStep = task.steps.find((s) => s.id === "plan");
  if (planStep) {
    planStep.status = "done";
    planStep.completedAt = now;
  }
  const next = task.steps.find((s) => s.id === "apply");
  if (next) {
    next.status = "in-progress";
    task.currentStepId = next.id;
    task.phase = next.phase;
    task.phaseStatus = "in_progress";
    task.nextAction = defaultNextAction("adopt", "apply");
  }
  touchTask(task);
  const taskPath = await saveTask(root, task);
  return { task, taskPath, workflowGuidance: buildTaskApprovePlanWorkflowGuidance(task) };
}
```

- [ ] **Step 3: Block adopt in `assertTaskApprovePlanAllowed`**

```typescript
if (task.kind === "adopt") {
  throw new TaskPreconditionError(
    "step_premature",
    `Task "${task.id}" is an adopt task — use task_approve_adopt_plan.`,
    "Present mapping table, wait for explicit yes, then task_approve_adopt_plan.",
    ["task_approve_adopt_plan"],
    task,
    "plan",
  );
}
```

- [ ] **Step 4: CLI + MCP**

```bash
# src/cli.ts
.command("approve-adopt-plan <taskId>")
.option("--by <email>", "Approver")
```

Register MCP tool `task_approve_adopt_plan` in `server.ts` with handler calling `runTaskApproveAdoptPlan`.

- [ ] **Step 5: Run tests + commit**

```bash
npm test -- tests/adopt/task-adopt.test.ts tests/adopt/gates.test.ts
git commit -m "feat(adopt): add task_approve_adopt_plan MCP and CLI"
```

---

### Task 5: Wire gates into adopt apply / bootstrap / setup-mark

**Files:**
- Modify: `src/core/adopt/apply.ts`
- Modify: `src/core/adopt/bootstrap.ts`
- Modify: `src/core/adopt/setup.ts`
- Modify: `src/core/operations/adopt.ts`
- Modify: `src/interfaces/mcp/tools/adopt.ts`
- Test: `tests/adopt/gates.test.ts` (integration with temp project)

- [ ] **Step 1: Extend `runAdoptApply` signature**

```typescript
export async function runAdoptApply(opts: {
  root?: string;
  dryRun?: boolean;
  legacy?: boolean;
  activeTask?: TaskState | null;
}): Promise<...> {
  assertAdoptApplyAllowed(opts.activeTask ?? null, { legacy: opts.legacy });
  if (!opts.legacy) await assertAdoptPlanApprovedOnDisk(root);
  // existing apply logic...
}
```

- [ ] **Step 2: MCP adopt_apply loads active adopt task**

```typescript
const task = await findActiveTask(root, "adopt");
return runAdoptApply({ root, dryRun, legacy, activeTask: task });
```

- [ ] **Step 3: Add `--legacy` to adopt subcommands in `registerAdoptCommand`**

- [ ] **Step 4: Integration test — apply blocked without approval**

```typescript
it("runAdoptApply throws without approved plan", async () => {
  await withTempDir(async (root) => {
    // scaffold init + draft plan.json
    await expect(runAdoptApply({ root })).rejects.toThrow();
  });
});
```

- [ ] **Step 5: Commit**

```bash
git commit -m "feat(adopt): enforce gates on apply, bootstrap, and setup-mark"
```

---

### Task 6: Detail design — scan + classify

**Files:**
- Modify: `src/core/adopt/scan.ts`
- Modify: `src/core/adopt/classify.ts`
- Test: `tests/adopt/detail-design.test.ts`

- [ ] **Step 1: Write failing DD scan test**

```typescript
// tests/adopt/detail-design.test.ts
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { runAdoptScan } from "@/core/adopt/scan.js";
import { withTempDir } from "../helpers/temp-project.js";

async function scaffoldInit(root: string) {
  await mkdir(join(root, ".ai-spector/.docflow/adopt"), { recursive: true });
  await writeFile(
    join(root, ".ai-spector/docflow.config.json"),
    JSON.stringify({ languages: [{ code: "en", label: "English" }] }),
    "utf8",
  );
}

describe("detail-design scan", () => {
  it("inventories docs/dd legacy alias", async () => {
    await withTempDir(async (root) => {
      await scaffoldInit(root);
      await mkdir(join(root, "docs/dd/features"), { recursive: true });
      await writeFile(
        join(root, "docs/dd/features/checkout.md"),
        "# Checkout Feature\n\nF-01 details.\n",
        "utf8",
      );
      const result = await runAdoptScan({ root });
      expect(
        result.inventory.some(
          (i) => i.layer === "detail-design" && i.path.includes("docs/dd/"),
        ),
      ).toBe(true);
      expect(result.classification.detailDesign).not.toBe("missing");
    });
  });
});
```

- [ ] **Step 2: Implement scan changes**

In `scan.ts`:

```typescript
const SCAN_LAYER_DIRS = [
  // existing...
  { relativeDir: "docs/detail-design", layer: "detail-design" as const },
];

const LEGACY_ALIAS_DIRS = [
  { relativeDir: "docs/dd", layer: "detail-design" as const },
  { relativeDir: "docs/detail_design", layer: "detail-design" as const },
];
```

Walk alias dirs in a second pass; tag inventory items with `signals.legacyAlias: true` (optional field on inventory item).

In `classify.ts`:

```typescript
function getManifestEntries(layer: "srs" | "basic-design" | "detail-design"): ManifestEntry[] {
  if (layer === "detail-design") {
    // load documents-detail-design.json via readManifestSync
  }
  // existing...
}

export function classifyDetailDesignLayer(files: AdoptClassifyFile[]): AdoptLayerClass {
  // mirror classifyBasicDesignLayer using doc.dd manifest
}
```

Set `classification.detailDesign` in `runAdoptScan` aggregate.

- [ ] **Step 3: Run tests — expect PASS**

Run: `npm test -- tests/adopt/detail-design.test.ts tests/adopt/scan.test.ts tests/adopt/classify.test.ts`

- [ ] **Step 4: Commit**

```bash
git commit -m "feat(adopt): scan and classify detail-design legacy paths"
```

---

### Task 7: Detail design — plan moves + bootstrap tasks

**Files:**
- Modify: `src/core/adopt/plan.ts`
- Modify: `src/core/adopt/tasks.ts`
- Test: `tests/adopt/detail-design.test.ts` (extend)
- Test: `tests/adopt/plan.test.ts`

- [ ] **Step 1: Write failing plan test for DD move**

```typescript
it("plans move from docs/dd to canonical detail-design path", async () => {
  // fixture: docs/dd/features/checkout.md + lang-primary context
  const plan = await runAdoptPlan({ root });
  const move = plan.moves.find((m) => m.layer === "detail-design");
  expect(move?.to).toMatch(/^docs\/detail-design\/en\//);
});
```

- [ ] **Step 2: Extend plan.ts**

- Add `detail-design` branch in `inventoryToClassifyFile` prefix map
- Load DD manifest documents for `documentId` resolution
- Target pattern: `docs/detail-design/{lang}/features/{slug}.md` for per-domain; `common/` and `feature-list.md` for list chapters

- [ ] **Step 3: Extend adopt/tasks.ts**

```typescript
type AdoptDocType = "srs" | "basic-design" | "detail-design";

const CANONICAL_DOC_RE = {
  // ...
  "detail-design": /^docs\/detail-design\/[^/]+\/.+\.md$/i,
};

const WORKFLOW_FOR_DOC = {
  // ...
  "detail-design": "generate-detail-design",
};
```

`createAdoptCompletedTasks` creates DD task when canonical DD paths exist.

- [ ] **Step 4: Run tests + commit**

```bash
git commit -m "feat(adopt): plan moves and bootstrap tasks for detail-design"
```

---

### Task 8: task_create support for adopt kind

**Files:**
- Modify: `src/core/operations/task.ts` (`runTaskCreate` / validation)
- Modify: `src/core/workflow/active-worker.ts` (if workflow map needed)
- Modify: `src/core/workflow/guidance.ts`
- Test: `tests/adopt/task-adopt.test.ts`

- [ ] **Step 1: Allow `task_create({ kind: "adopt", workflow: "adopt" })`**

Ensure `parseTask` / `runTaskCreate` accepts `kind: "adopt"` and initializes steps from `getWorkflowTemplate("adopt")`.

- [ ] **Step 2: Add workflow guidance for adopt steps**

In `guidance.ts`, map adopt step ids to suggested tools (`adopt_scan`, `task_approve_adopt_plan`, etc.).

- [ ] **Step 3: Test task_create round-trip**

```typescript
it("creates adopt task with 7 pending steps", async () => {
  await withTempDir(async (root) => {
    const { task } = await runTaskCreate({
      root,
      kind: "adopt",
      workflow: "adopt",
      trigger: "align legacy docs",
    });
    expect(task.kind).toBe("adopt");
    expect(task.steps).toHaveLength(7);
  });
});
```

- [ ] **Step 4: Commit**

```bash
git commit -m "feat(adopt): support task_create for adopt workflow"
```

---

### Task 9: task_update gates for adopt (mirror import)

**Files:**
- Modify: `src/core/operations/task-gates.ts` (`assertTaskUpdateAllowed` or equivalent)
- Test: `tests/adopt/gates.test.ts`

- [ ] **Step 1: Forbid marking `plan` done via task_update on adopt tasks**

Same pattern as import `manifest-plan`:

```typescript
if (task.kind === "adopt" && patch.step?.id === "plan" && patch.step.status === "done") {
  throw new TaskPreconditionError(/* use task_approve_adopt_plan */);
}
```

- [ ] **Step 2: Require snapshot fields when marking clarify/validate done**

- `clarify` done → requires `adoptClarifyCompleteAt`
- `validate` done → requires `adoptValidateReadyAt`

- [ ] **Step 3: Run gates tests + commit**

---

### Task 10: Agent skill + routing docs

**Files:**
- Modify: `scaffold/cursor/skills/ai-spector-adopt/references/runbook.md`
- Modify: `scaffold/cursor/skills/ai-spector-adopt/SKILL.md`
- Modify: `scaffold/cursor/WORKFLOW.md`
- Modify: `scaffold/cursor/skills/_skill-router.md`
- Modify: `scaffold/cursor/rules/ai-spector-routing.mdc`
- Run: `npx ai-spector sync-claude` (or project sync script) to mirror Claude scaffold

- [ ] **Step 1: Replace runbook phases 0–6 with gated task-step table** (from spec §4.2)

Include forbidden table:

| Forbidden | Use instead |
|-----------|-------------|
| `task_approve_plan` | `task_approve_adopt_plan` |
| `adopt_plan --approve` without task | `task_approve_adopt_plan` |
| `adopt_apply` before plan approval | `task_approve_adopt_plan` first |
| template-import inside adopt task | pause → template-import → new adopt task |

- [ ] **Step 2: Add WORKFLOW.md row**

```markdown
| Align legacy SRS/BD/DD | "align my legacy docs", "migrate to ai-spector structure", "continue adopt" | `ai-spector-adopt` | `task_create` (adopt) → gated scan/plan/apply/index |
```

- [ ] **Step 3: Update router triggers** — add "align legacy docs"

- [ ] **Step 4: Sync claude scaffold**

```bash
npx ai-spector sync-claude
```

- [ ] **Step 5: Commit**

```bash
git commit -m "docs(adopt): gated runbook, WORKFLOW, and routing for adopt v2"
```

---

### Task 11: MCP tool descriptions + route-intent examples

**Files:**
- Modify: `src/interfaces/mcp/tool-descriptions.ts`
- Modify: `src/core/workflow/route-intent-examples.ts`
- Modify: `src/core/workflow/route-intent.ts` (if adopt triggers missing)

- [ ] **Step 1: Add `task_approve_adopt_plan` description**

WHEN / NOT WHEN blocks mirroring `task_approve_import_plan`.

- [ ] **Step 2: Update adopt tool descriptions** — note task gate requirements

- [ ] **Step 3: Add route examples**

```typescript
{ say: "align my legacy docs", skill: "ai-spector-adopt" },
{ say: "migrate existing SRS to ai-spector structure", skill: "ai-spector-adopt" },
```

- [ ] **Step 4: Run route tests**

```bash
npm test -- tests/workflow/route-intent.test.ts
```

- [ ] **Step 5: Commit**

```bash
git commit -m "feat(adopt): MCP descriptions and route-intent for adopt v2"
```

---

### Task 12: End-to-end integration test

**Files:**
- Create: `tests/fixtures/adopt-legacy-dd/` (minimal project)
- Modify: `tests/adopt/integration.test.ts`

- [ ] **Step 1: Fixture layout**

```
tests/fixtures/adopt-legacy-dd/
  .ai-spector/docflow.config.json
  docs/srs/1-intro.md
  docs/dd/features/f-01-checkout.md
```

- [ ] **Step 2: Integration test flow**

```typescript
it("gated adopt flow: scan → approve → apply → bootstrap → validate", async () => {
  // 1. task_create adopt
  // 2. adopt_scan — expect DD inventory
  // 3. record lang-primary, re-scan
  // 4. adopt_plan
  // 5. task_approve_adopt_plan
  // 6. adopt_apply
  // 7. adopt_bootstrap (skip analyze)
  // 8. adopt_validate — expect ready or document expected gaps
});
```

- [ ] **Step 3: Run full adopt test suite**

```bash
npm test -- tests/adopt/
```

- [ ] **Step 4: Commit**

```bash
git commit -m "test(adopt): integration test for gated adopt v2 with detail-design"
```

---

### Task 13: CHANGELOG entry

**Files:**
- Modify: `CHANGELOG.md`

- [ ] **Step 1: Add under Unreleased**

```markdown
### Adopt v2 (gated legacy alignment)
- Adopt is now a first-class task workflow (`kind: adopt`) with `task_approve_adopt_plan` and server gates on apply/bootstrap/complete.
- Detail design (`docs/detail-design/`) included in scan, plan, apply, and validate; legacy `docs/dd/` paths supported.
- Hard fork to `ai-spector-template-import` when custom pack required (unchanged behavior, clearer runbook).
```

- [ ] **Step 2: Commit**

```bash
git commit -m "docs: CHANGELOG for adopt v2 gated workflow"
```

---

## Spec coverage checklist

| Spec § | Task |
|--------|------|
| §4 Task workflow | Task 1, 8 |
| §5 Plan + approve | Task 2, 4 |
| §6 Clarify | Task 8 snapshot fields; runbook Task 10 |
| §6.3 Template fork | Runbook Task 10 (agent-side) |
| §7 Detail design | Task 6, 7 |
| §8 Server gates | Task 3, 5, 9 |
| §9 Execute | Task 5 |
| §10 Skill/routing | Task 10, 11 |
| §14 Testing | Tasks 1–7, 12 |
| §15 v1 migration | `--legacy` flags Task 5; optional `task adopt-bind-plan` deferred (YAGNI) |

## Deferred (YAGNI)

- `task adopt-bind-plan` CLI for mid-flight v1 projects — document in runbook as manual `task_create` + re-approve if needed
- `signals.legacyAlias` on inventory — optional; path prefix sufficient for v1
- Server gate on unrelated workflows when `migration.complete` missing — spec out of scope
