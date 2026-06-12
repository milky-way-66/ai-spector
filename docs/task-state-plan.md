# Task State — File-Based Workflow Persistence

> Status: **Design proposal** (for review, not yet implemented)
> Date: 2026-06-12
> Companion to [workflow-redesign.md](workflow-redesign.md) and
> [workflow-redesign-impl-plan.md](workflow-redesign-impl-plan.md)

## 1. Goals

Persist **workflow progress in JSON files** so agents work from **state**, not
chat context. A task file answers:

- What work does the user have in flight?
- Does an approved plan exist?
- Which step is the user on, and what is next?
- What is blocked, and what went wrong?

Core flows:

1. **Generate** — user wants SRS (or basic design, etc.) → create task → follow
   workflow gates → finish task.
2. **Resolve** — user wants a change → create task → clarify → plan → execute →
   finish task.
3. **Resume** — user stops mid-task → later, validate workspace drift → confirm
   changes → continue from saved step.

The design keeps the existing architecture (core ops return typed results;
interfaces adapt them — see `CLAUDE.md` rules 1–6).

---

## 2. Current state (baseline)

| Piece | Persistence today | Gap |
|-------|-------------------|-----|
| `resolve-task` | `GoalSpec` + `TaskPlan` passed inline to MCP at execution | No file store; plan lives only in chat |
| Generate workflow | Plan logged to `logs/plan-<docType>-<ts>.json` after approval | Audit only — not resumable task state |
| Context store | `context/<docType>.json` | Clarifications only, not workflow position |
| `state.json` | Analysis/index timestamps | Not task-aware |
| Skills/runbooks | Phase instructions in markdown | Agent must re-derive state each session |

**Problem:** if the user stops mid-task or starts a new chat, the agent loses
track of phase, plan approval, blockers, and partial progress.

---

## 3. Design principles

1. **State over chat** — agent calls `task_get` at session start; never assumes
   prior context.
2. **Minimal context files** — store IDs and pointers, not full doc content
   (reuse context store, graph, plan snapshots).
3. **One active task per slot** (configurable) — avoid two half-finished SRS
   runs (see §11 open decisions).
4. **Validate before resume** — `workspace_check` + artifact hash drift + stale
   context entries.
5. **Same ops pattern** — core op → CLI → MCP → SDK → tests.

---

## 4. User flows

```
User intent
    │
    ├─ generate SRS / basic design ──► task_create(kind: generate)
    │
    └─ add / change feature ──────────► task_create(kind: resolve)
                │
                ▼
        Follow workflow steps (gates)
                │
        ┌───────┴───────┐
        │               │
     pause           continue
        │               │
        ▼               ▼
   write state     advance steps
        │               │
        └───────┬───────┘
                │
         Later: task_resume
                │
         validate + show drift
                │
         user confirms → continue
                │
                ▼
         task_complete (or blocked / abandoned)
```

---

## 5. File layout

```
.ai-spector/.docflow/
├── state.json                    # project timestamps (unchanged)
├── tasks/
│   ├── index.json                # active + recent task registry
│   └── <taskId>.json             # one file per task (authoritative)
├── context/<docType>.json        # clarifications (existing, referenced by task)
├── extracted/<docType>.json      # spec queue (existing)
└── logs/
    └── plan-<docType>-<ts>.json  # audit copy on plan approval (existing)
```

### 5.1 `tasks/index.json`

```jsonc
{
  "version": 1,
  "active": {
    "generate:srs": "task-abc123",
    "resolve": "task-def456"
  },
  "recent": ["task-abc123", "task-def456"]
}
```

`active` maps a **slot** (e.g. `generate:srs`, `resolve`) to the current task
id. Only one active task per slot by default.

### 5.2 `tasks/<taskId>.json` — authoritative task state

```jsonc
{
  "version": 1,
  "id": "task-abc123",
  "kind": "generate",
  "workflow": "generate-srs",
  "status": "active",
  "createdAt": "2026-06-12T10:00:00.000Z",
  "updatedAt": "2026-06-12T10:30:00.000Z",
  "trigger": "generate SRS for checkout",

  "phase": "plan",
  "phaseStatus": "awaiting_approval",

  "goal": null,
  "plan": null,
  "planApprovedAt": null,

  "steps": [
    {
      "id": "check",
      "phase": "check",
      "status": "done",
      "completedAt": "2026-06-12T10:05:00.000Z",
      "blocker": null,
      "artifacts": []
    },
    {
      "id": "clarify",
      "phase": "clarify",
      "status": "in_progress",
      "openContextIds": ["Q-003"],
      "blocker": null,
      "artifacts": []
    }
  ],

  "currentStepId": "clarify",
  "nextAction": "resolve open Q-003 or accept as assumption",

  "blockers": [],

  "contextRefs": {
    "docType": "srs",
    "contextFile": "context/srs.json",
    "planLog": null
  },

  "snapshot": {
    "workspaceCheckAt": "2026-06-12T10:05:00.000Z",
    "artifactHashes": {
      "docs/srs/en/03-use-cases.md": "sha256:..."
    },
    "graphMergedAt": "2026-06-12T09:00:00.000Z"
  }
}
```

**Status values:** `draft` | `active` | `paused` | `blocked` | `complete` |
`abandoned`

**Step status values:** `pending` | `in_progress` | `done` | `blocked` | `skipped`

**Phase status values:** `in_progress` | `awaiting_user` | `done`

### 5.3 Plan shapes (discriminated by `kind`)

**Resolve tasks** — reuse existing types from `src/core/operations/resolve-task.ts`:

- `GoalSpec` — trigger, domain, scope, criteria, notes
- `TaskPlan` — id, goal, steps, impactMap, riskLevel, approvedAt

**Generate tasks** — new `GeneratePlan`:

- `briefing` — per-target context summary (graph, data-source, Q-xxx, assumptions)
- `rows` — output × DAG node × sources × key points
- `waves` — wave assignments + secondary-language status
- `docType`, `language`, `scope` (all | explicit paths | described)

On `task_approve_plan`, write an audit copy to
`.ai-spector/.docflow/logs/plan-<docType>-<ts>.json` (existing convention).

---

## 6. Workflow templates

Step templates are defined per workflow (TS constants or JSON config), not
re-derived in chat each session.

| Workflow ID | Phases / steps |
|-------------|----------------|
| `generate-srs` | check → clarify → briefing → plan → generate-waves → extract |
| `generate-basic-design` | same pattern |
| `resolve` | clarify → discover → plan → execute → report |
| `resolve-translation` | (future) queue → translate → index |

`workflow.dependencies.json` remains for **pipeline prerequisites** (analyze
before generate). Task state tracks **in-run progress** within a single user
request.

---

## 7. MCP / CLI surface

| Tool / command | Purpose |
|----------------|---------|
| `task_create` | New task from intent + kind; initialize steps from template |
| `task_list` | Filter by status / kind |
| `task_get` | Full state — **first call every session** |
| `task_update` | Advance phase, record step result, set blockers |
| `task_approve_plan` | Set `planApprovedAt`; unlock execute / generate steps |
| `task_pause` | `status: paused`; flush state |
| `task_resume` | Validate + return `{ task, drift, suggestedNext }` |
| `task_complete` | Mark done; clear active slot |
| `task_abandon` | Mark abandoned; clear active slot |

CLI mirror: `npx ai-spector task create|list|get|resume|pause|complete|abandon`

Core location: `src/core/operations/task.ts` (new).

---

## 8. Resume and drift validation

On `task_resume`, before continuing:

1. **`workspace_check`** — structural errors block resume until fixed.
2. **Plan still valid** — if plan references DAG nodes or files that no longer
   exist → `blocked`; user must re-plan.
3. **Artifact drift** — compare `snapshot.artifactHashes` to disk; list changed
   files since pause.
4. **Context staleness** — context entries with `status: stale` → re-ask or
   confirm assumption.
5. **External edits** — if user edited `docs/` manually, show diff summary;
   require explicit confirmation before continuing.

```ts
interface TaskResumeResult {
  task: TaskState;
  drift: { path: string; kind: "modified" | "deleted" | "added" }[];
  staleContextIds: string[];
  blockers: string[];
  suggestedNext: string;
  canContinue: boolean;
}
```

User must confirm before the agent advances past `awaiting_user` gates.

---

## 9. Agent / skill changes

### 9.1 New skill: `ai-spector-task`

Every workflow skill starts with:

```
1. task_list({ status: ["active", "paused"] })
2. If match → offer resume OR start new
3. task_get(activeId) → read phase, plan, blockers, nextAction
4. Never skip gates already marked done in steps[]
```

### 9.2 Updates to existing skills

| Skill | Change |
|-------|--------|
| `ai-spector-generate-srs` | Create/update generate task at each gate; persist plan on approval |
| `ai-spector-generate-basic-design` | Same |
| `ai-spector-resolve-task` | `task_create` on intent; `task_approve_plan` before execute; `task_update` per step |
| `_skill-router.md` | "resume task", "continue SRS" → `ai-spector-task` |
| `WORKFLOW.md` | Add task lifecycle row to intent table |

### 9.3 Forbidden without task state

- Starting generate/resolve without `task_create` or resumed `task_get`
- Executing steps while `planApprovedAt` is null (resolve + generate)
- Advancing phase without `task_update` (keeps file in sync)

---

## 10. Relationship to existing components

| Existing | How task state uses it |
|----------|------------------------|
| Context store (`context_*`) | Task holds `openContextIds`; answers stay in context files |
| `resolve_task` MCP | Executor for resolve `execute` step; plan read from task file |
| Plan audit logs | `task_approve_plan` writes copy to `logs/` |
| `workflow-redesign` (Phases 1–5) | Task state is **Phase 6** — persistence on top of gates |
| `state.json` | Unchanged; task state is orthogonal |

---

## 11. Open decisions

| # | Question | Options | Recommendation |
|---|----------|---------|----------------|
| 1 | One vs many active tasks | Strict one-per-slot vs parallel (e.g. SRS + comment resolve) | One-per-slot initially |
| 2 | Task files in git | Commit `tasks/*.json` vs gitignore | Commit (team visibility); document in setup |
| 3 | Generate wave granularity | One step per DAG wave vs one step per file | One step per wave (matches skill compaction) |
| 4 | Auto-resume on intent | Auto-pick paused task vs always ask | Always ask unless user says "continue" / "resume" |

---

## 12. Implementation plan

Companion implementation detail: [task-state-impl-plan.md](task-state-impl-plan.md)

### Sequencing overview

```
Phase 0  Types + store IO           ← foundation
Phase 1  Core ops + CLI + MCP       ← agents can persist state
Phase 2  Resume + drift             ← pause/resume works
Phase 3  Wire resolve-task          ← incremental changes file-backed
Phase 4  Wire generate workflow     ← SRS/basic-design file-backed
Phase 5  Skills + docs              ← agent behavior on state
```

Phases 0–2 are prerequisite for 3–4. Phases 3 and 4 are parallelizable.
Phase 5 lands last.

---

## 13. Success criteria

- User says "generate SRS", stops after plan approval, returns next day → agent
  shows saved plan and asks to continue.
- User says "add login with Google" → task file shows `phase: plan`,
  `awaiting_approval` until explicit yes.
- `task_get` alone tells the agent: plan exists? current step? blockers? next
  action?
- Manual doc edits while paused are detected on resume.
- No workflow progress depends on chat history.
