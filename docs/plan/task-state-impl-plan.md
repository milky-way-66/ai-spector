# Task State — Implementation Plan

> Companion to [task-state-plan.md](task-state-plan.md). Phased, ordered by
> dependency. Each code phase follows the CLAUDE.md "Adding a New Command"
> pattern: core op (typed result, no console.log) → CLI formatter → CLI handler
> → MCP tool + Zod schema → SDK re-export → tests.

## Sequencing overview

```
Phase 0  Types + store IO           ← foundation
Phase 1  Core ops + CLI + MCP       ← agents can persist state
Phase 2  Resume + drift             ← pause/resume works
Phase 3  Wire resolve-task          ← incremental changes file-backed
Phase 4  Wire generate workflow     ← SRS/basic-design file-backed
Phase 5  Skills + docs              ← agent behavior on state
```

Phases 0–2 are prerequisite for 3–4. Phases 3 and 4 are parallelizable.
Phase 5 lands last. Builds on workflow-redesign Phases 1–5 (check, context,
extracted specs, staleness, skill gates).

---

## Phase 0 — Types and store IO

**Goal:** typed task model and atomic read/write under `.ai-spector/.docflow/tasks/`.

| # | Task | File |
|---|------|------|
| 0.1 | `TaskState`, `TaskStep`, `TaskIndex`, `GeneratePlan`, workflow template types | `src/core/operations/task.ts` |
| 0.2 | Re-export / extend `GoalSpec`, `TaskPlan` from `resolve-task.ts` | same |
| 0.3 | Store IO: read/write `tasks/<id>.json`, `tasks/index.json`; `buildTaskId()` | `src/core/operations/task.ts` (+ `core/util/fs.js`) |
| 0.4 | Step template registry: `generate-srs`, `generate-basic-design`, `resolve` | `src/core/operations/task-templates.ts` |
| 0.5 | JSON schema for task store | `schemas/task-state.schema.json` |
| 0.6 | Scaffold empty `tasks/index.json` in setup | `scaffold/.ai-spector/.docflow/tasks/index.json` |
| 0.7 | Tests: create, update, round-trip, index active-slot | `tests/operations/task.test.ts` |

**Acceptance:** can create a task file and index entry programmatically; types
compile; round-trip preserves all fields.

---

## Phase 1 — Core ops and interfaces

**Goal:** full task CRUD surfaced as MCP + CLI.

| # | Task | File |
|---|------|------|
| 1.1 | `runTaskCreate`, `runTaskGet`, `runTaskUpdate`, `runTaskList` | `src/core/operations/task.ts` |
| 1.2 | `runTaskApprovePlan`, `runTaskPause`, `runTaskComplete`, `runTaskAbandon` | same |
| 1.3 | `formatTask*` formatters | `src/interfaces/cli/format/task.ts` |
| 1.4 | CLI `task create|list|get|update|approve|pause|complete|abandon` | `src/cli.ts` |
| 1.5 | MCP tools + Zod schemas | `src/interfaces/mcp/tools/task.ts`, `schemas.ts`, `server.ts` |
| 1.6 | SDK re-exports | `src/interfaces/sdk/index.ts` |
| 1.7 | Tests: CLI + MCP parity, approve-plan unlocks steps | `tests/operations/task.test.ts`, `tests/commands/task.test.ts` |

**Acceptance:** agent can create a task, update step status, approve a plan, and
list active/paused tasks via both CLI and MCP.

---

## Phase 2 — Resume and drift

**Goal:** `task_resume` validates workspace and detects changes since pause.

| # | Task | File |
|---|------|------|
| 2.1 | `runTaskResume` — load task, run `runCheck`, compute drift | `src/core/operations/task.ts` |
| 2.2 | Snapshot artifact hashes on step completion (`snapshot.artifactHashes`) | same |
| 2.3 | Stale context detection via existing context store | integrate `context.ts` |
| 2.4 | `check` rule TASK-001: active/blocked tasks surface in workspace check | `src/core/operations/check.ts` + `workspace.rules.json` |
| 2.5 | `task_approve_plan` writes audit copy to `logs/plan-*.json` | `task.ts` |
| 2.6 | Tests: pause → edit file → resume shows drift; stale context | `tests/operations/task-resume.test.ts` |

**Acceptance:** pausing and resuming returns drift list; blocked when workspace
invalid; audit log written on plan approval.

---

## Phase 3 — Wire resolve-task

**Goal:** incremental change workflow reads/writes task files.

| # | Task | File |
|---|------|------|
| 3.1 | `ResolveTaskOptions.taskId` — load plan from task file when set | `src/core/operations/resolve-task.ts` |
| 3.2 | `runResolveTask` calls `task_update` after each step (injectable hook) | same |
| 3.3 | MCP `resolve_task` accepts optional `taskId` | `src/interfaces/mcp/tools/resolve-task.ts` |
| 3.4 | Update `ai-spector-resolve-task` skill + runbook | `scaffold/cursor/skills/ai-spector-resolve-task/` |
| 3.5 | Tests: resolve flow updates task file step-by-step | `tests/operations/task-resolve.test.ts` |

**Acceptance:** "add login with Google" flow persists GoalSpec + TaskPlan in task
file; execution updates step status; resume continues from last step.

---

## Phase 4 — Wire generate workflow

**Goal:** SRS / basic-design gates persist in task files.

| # | Task | File |
|---|------|------|
| 4.1 | `GeneratePlan` builder from briefing + plan table | `src/core/operations/task.ts` |
| 4.2 | Per-wave dynamic steps (`wave-1`, `wave-2`, …) appended after plan approval | `task-templates.ts` |
| 4.3 | `task_update` records written file paths + hashes per wave | `task.ts` |
| 4.4 | Link extract step to spec queue via `contextRefs` | integrate `extracted.ts` |
| 4.5 | Update `generate-workflow.md` + generate skills | `scaffold/cursor/skills/ai-spector/` |
| 4.6 | Tests: generate task through clarify → plan → one wave | `tests/operations/task-generate.test.ts` |

**Acceptance:** generate SRS run survives session break after plan approval;
agent resumes at correct wave.

---

## Phase 5 — Skills and docs

**Goal:** agents always load task state first; user-facing docs updated.

| # | Task | File |
|---|------|------|
| 5.1 | New skill `ai-spector-task` (create / list / resume) | `scaffold/cursor/skills/ai-spector-task/` |
| 5.2 | Skill router entries for resume / continue intents | `scaffold/cursor/skills/_skill-router.md` |
| 5.3 | `WORKFLOW.md` intent table + pipeline note | `scaffold/cursor/WORKFLOW.md` |
| 5.4 | `ARCHITECTURE.md` MCP tool table | `ARCHITECTURE.md` |
| 5.5 | Cross-link from `workflow-redesign-impl-plan.md` as Phase 6 | `docs/workflow-redesign-impl-plan.md` |

**Acceptance:** "resume my SRS task" routes correctly; every generate/resolve
skill loads task state at start.

---

## Cross-cutting

- **Build/test gates:** `npm run build` + `npm test` green after each phase.
- **Architecture rules:** no `console.log` in `src/core/`; every `run*` returns a
  typed result; update all three interface adapters when result shape changes;
  `.js` import extensions.
- **Impact analysis:** run `gitnexus_impact` before editing `resolve-task.ts`,
  `check.ts`, MCP server registration; `gitnexus_detect_changes` before each
  commit.
- **Atomic writes:** task files use write-to-temp + rename to avoid partial
  reads during concurrent access.

---

## Suggested PR breakdown

| PR | Contents |
|----|----------|
| PR1 | Phase 0–1 — task CRUD via CLI/MCP |
| PR2 | Phase 2 — resume + drift validation |
| PR3 | Phase 3 — resolve-task file-backed |
| PR4 | Phase 4–5 — generate workflow + skills |
| PR5 | Phase 6 — verification + Claude scaffold sync |

---

## Phase 6 — Verification and scaffold sync

**Goal:** prove plan §13 success criteria; fill gaps from phases 1–5.

| # | Task | File |
|---|------|------|
| 6.1 | E2E tests: generate pause/resume after plan, resolve awaiting approval, task_get introspection | `tests/operations/task-e2e.test.ts` |
| 6.2 | CLI formatter tests | `tests/commands/task.test.ts` |
| 6.3 | Claude scaffold: `ai-spector-task`, resolve/generate skill task hooks | `scaffold/claude/.claude/skills/` |
| 6.4 | Live CLI smoke in temp project | manual / CI script |

**Acceptance:** `npm test` green including e2e; CLI `task create|list|get` works on scaffolded project;
success criteria in [task-state-plan.md](task-state-plan.md) §13 covered by tests.
