# Subagent Routing & Workflow Design

> **Goal:** Specialized subagents that each own **one workflow**, are **optimized for that work**, and make **routing + understanding** reliable for both users and the parent agent.

This design sits **on top of** the existing stack (skills, `ai-spector-routing.mdc`, `workflow_route`, session gates). Skills become **subagent briefs**; the parent agent becomes a thin **orchestrator**.

---

## 1. Design principles

| # | Principle | What it means |
|---|-----------|---------------|
| 1 | **One workflow per subagent** | Each subagent has exactly one `workflowId`, one runbook, one set of owned tools. No “general” subagent that does generate + review + comments. |
| 2 | **Optimized context** | Subagent prompt includes only: its runbook, allowed/forbidden tools, current phase, and minimal workspace state. Parent does routing; worker does execution. |
| 3 | **Routing is explicit** | Every delegation passes a structured `SubagentHandoff` (skill, phase, nextTools, avoidTools, userGoal). Subagent returns `SubagentResult` (status, summary, suggestedNext). |
| 4 | **State beats memory** | Persisted state (`ReviewSession`, `TaskState`, comment inbox) drives phase — not chat history. Subagents read state via MCP on entry. |
| 5 | **Fail closed on gates** | Subagents cannot call gated tools (`review_approve`, `task_approve_plan`, `spec_approve`, `comments_resolve`) unless their runbook phase allows it. Server preconditions remain the backstop. |

---

## 2. Architecture

```text
┌─────────────────────────────────────────────────────────────────┐
│  User message  (/review, "add login", "resolve C-012", …)     │
└────────────────────────────┬────────────────────────────────────┘
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│  ORCHESTRATOR (parent agent)                                    │
│  • alwaysApply: ai-spector-routing.mdc (light, ~60 lines)       │
│  • workflow_route({ message }) when ambiguous                   │
│  • reads session/task context from route result                 │
│  • delegates OR handles meta (setup, explain, disambiguate)     │
└────────────────────────────┬────────────────────────────────────┘
                             │ SubagentHandoff
         ┌───────────────────┼───────────────────┐
         ▼                   ▼                   ▼
   ┌───────────┐      ┌───────────┐      ┌───────────┐
   │  Review   │      │ Generate  │      │ Resolve   │
   │  Worker   │      │  Worker   │      │  Worker   │
   └───────────┘      └───────────┘      └───────────┘
         │                   │                   │
         └───────────────────┴───────────────────┘
                             ▼
                    MCP tools (ai-spector)
                    + runbook phases
```

### Orchestrator responsibilities (parent only)

- Classify intent (`workflow_route`, priority table, active session)
- Ask **one** disambiguation question when `confidence: low`
- Spawn the correct subagent with `SubagentHandoff`
- Surface subagent summary to user; re-route on topic switch
- Never mix runbooks in one turn (no “generate while reviewing”)

### Worker responsibilities (subagent only)

- Read **one** skill + runbook on spawn
- Execute phases in order; stop at human gates
- Call only tools in `allowedTools` for current phase
- Return structured result; do not re-route to other workflows
- **Never talk to the user directly** — return `waiting_user` + `askUser`; parent relays in main chat

### Human-in-the-loop relay (`alwaysApply` vs subagents)

**`alwaysApply` applies to the parent (orchestrator) only** — not to spawned workers. Worker briefs load on spawn; they do not need `alwaysApply`.

| Who | Can ask the user? | How |
|-----|-------------------|-----|
| **Parent** | Yes, always | Main chat. Required when `workflow_route` returns `askUser` or confidence is low — **spawn no worker until answered**. |
| **Worker (subagent)** | No direct chat | Hits a gate → returns `status: "waiting_user"` and `askUser: { question, options? }` → **stops**. |
| **Parent (again)** | Yes | Shows worker's `askUser` in main chat. User's next message comes back to parent (which still has routing rule). Parent re-spawns **same** worker with `userAnswer` in handoff — does not re-classify intent unless user switches topic. |

```text
User: "looks good"
Parent (alwaysApply): workflow_route → askUser → shows 4-option menu → STOP (no spawn)

User: "1 — sign off document"
Parent: spawn doc-review
Worker: review_queue → askUser "which doc?" → waiting_user → END
Parent: shows queue table + "which document?"
User: "srs/01-overview"
Parent: spawn doc-review { phase: reviewing, userAnswer: "srs/01-overview", resume: true }
Worker: continues runbook…
```

**Rules:**

1. **Delegate ≠ skip questions.** Routing ambiguity is resolved by the **parent before spawn**. Workflow ambiguity (pick doc, clarify scope, approve plan) is resolved by the **worker**, relayed through the parent.
2. **Session stickiness on answers.** When `ReviewSession` or `TaskState` is active, the user's reply to a worker question is **not** re-routed — parent resumes the same `workflowId`.
3. **No background workers at gates.** Workers with HITL gates use `run_in_background: false`. Background is only for read-only explore (e.g. graph report) with no `askUser`.
4. **Worker skills must not use `alwaysApply`.** Only `ai-spector-routing.mdc` (orchestrator) is always-on. Putting runbooks on alwaysApply would bloat every chat turn and still would not let subagents talk to the user directly.

**Alternative (simpler MVP):** Parent stays in main chat for all `askUser` gates; worker runs only for tool-heavy phases (read doc, graph_impact, edits). Clarify / plan / pick-from-queue stay in parent. Same relay semantics, less spawn overhead.

### After clarity: resume same worker or spawn new?

**Short answer:** Same **workflow** always continues — but the **subagent instance** may be resumed or freshly spawned. Persisted state (`ReviewSession`, `TaskState`, task files) is the source of truth, not subagent chat memory.

| Situation | Subagent instance | What parent does |
|-----------|-------------------|------------------|
| User answered **routing** question (no worker yet) | **New spawn** (first time) | `spawn doc-review` with full `SubagentHandoff` from `workflow_route` + user choice |
| User answered **worker** question (gate mid-run) | **Resume preferred** | `Task({ resume: lastAgentId, prompt: userAnswer })` if worker ended with `waiting_user` and Cursor still has the agent |
| Resume unavailable (agent expired, background ended, new chat) | **New spawn, same workflow** | `spawn doc-review` with `handoff: { workflowId, phase, userAnswer, resumeFromState: true }` — worker reads `ReviewSession` / `task_get` on entry |
| User clearly **switches topic** | **New workflow** | Re-run `workflow_route`; abandon or pause prior session per runbook |

```text
                    User answered a question
                              │
              ┌───────────────┴───────────────┐
              │                               │
     Routing clarify (parent asked)    Worker gate (worker asked)
     before any spawn                 after worker returned waiting_user
              │                               │
              ▼                               ▼
        NEW subagent                   Has lastAgentId?
        (first spawn)                         │
                                    ┌─────────┴─────────┐
                                   yes                  no
                                    │                    │
                                    ▼                    ▼
                              RESUME same          NEW spawn
                              subagent             same workflowId
                              + userAnswer         + phase from disk
                                                 + userAnswer
```

**Handoff fields for continuation (new or resume):**

```typescript
interface SubagentHandoff {
  workflowId: string;
  phase: string;              // from ReviewSession.phase or task guidance
  userGoal: string;
  userAnswer?: string;        // user's latest reply to askUser
  resumeFromState?: boolean;  // true → load session/task via MCP first, don't restart from phase 0
  priorAgentId?: string;      // for Cursor Task resume
  context?: { logicalPath?, taskId?, commentId? };
}
```

**Why new spawn is OK:** Phases are on disk. Example: after user picks `srs/01-overview`, `ReviewSession` already has `phase: reviewing` and `activeLogicalPath` — a fresh Review Worker calls `review_status` and continues; it does not repeat `review_check` unless phase is still `queue`.

**Why resume is better when possible:** Avoids re-reading runbook + re-fetching MCP data the worker already had in context (saves tokens and latency).

**Parent must track:** `lastWorker: { workflowId, agentId?, phase }` in chat turn metadata or infer from last `SubagentResult` + persisted session files.

---

## 3. Subagent catalog

Each row is a **first-class subagent**. `workflowId` is stable for routing, logging, and future CLI/SDK use.

| workflowId | Subagent name | Skill (brief) | Primary user cues | Owned MCP tools (typical) |
|------------|---------------|---------------|-------------------|---------------------------|
| `doc-review` | **Review Worker** | `ai-spector-review` | `/review`, approve doc, review queue, `srs/…` + approve | `review_check`, `review_queue`, `review_status`, `readiness_scan`, `readiness_output_checklist`, `graph_impact`, `review_session_*`, `review_approve`/`reject` |
| `resolve-comments` | **Comments Worker** | `ai-spector-resolve-comments` | C-NNN, inbox, resolve thread, feedback on doc | `comments_inbox`, `comments_show`, `comments_plan`, `comments_resolve` |
| `generate-srs` | **SRS Generate Worker** | `ai-spector-generate-srs` | generate SRS, write chapter, DAG wave | `task_*`, `workspace_check`, `context_*`, `task_record_wave`, `spec_record`, `index` |
| `generate-basic-design` | **BD Generate Worker** | `ai-spector-generate-basic-design` | screen list, API design, wireframes | same pattern as SRS |
| `generate-prototype` | **Prototype Worker** | `ai-spector-generate-prototype` | HTML mockup, theme picker | `prototype_*`, theme tools |
| `resolve-task` | **Resolve Task Worker** | `ai-spector-resolve-task` | add/update/change, "I want to…" | `task_*`, `resolve_task`, read-only `docs_search`/`graph_query*` pre-plan |
| `task-router` | **Task State Worker** | `ai-spector-task` | resume, continue, active tasks | `task_list`, `task_resume`, `task_get` → hand off to generate/resolve worker |
| `spec-queue` | **Spec Queue Worker** | extract-specs ref | approve SPEC-NNN, pending specs | `spec_list`, `spec_approve`, `spec_reject`, `graph_merge` |
| `graph-ops` | **Graph Worker** | `ai-spector-graph` | analyze, index, validate, impact | `index`, `graph_*`, `knowledge_validate` |
| `search` | **Search Worker** | `ai-spector-search` | find docs, fuzzy node lookup | `docs_search`, `graph_query_fuzzy` |
| `setup-check` | **Setup Worker** | `ai-spector-setup` / `ai-spector-check` | setup, workspace check | `setup`, `workspace_check`, `context_list` |

**Not subagents (orchestrator handles):**

- Ambiguous approve → ask 4-option menu (no worker until answered)
- “What skill should I use?” → `workflow_route` + short explanation
- Cross-workflow questions (“pipeline order?”) → `WORKFLOW.md` excerpt, no worker

---

## 4. Per-subagent optimization

Each worker is tuned for **one job** via four levers:

### 4.1 Minimal prompt envelope

```yaml
# Example: Review Worker spawn prompt (conceptual)
role: doc-review
read_first:
  - .cursor/skills/ai-spector-review/references/runbook.md
phase: reviewing          # from ReviewSession or handoff
activeLogicalPath: srs/01-overview
allowedTools: [review_status, readiness_scan, readiness_output_checklist, graph_impact, review_session_ack_review]
forbiddenTools: [review_approve, spec_approve, task_approve_plan, comments_resolve]
userGoal: "Review srs/01-overview for sign-off"
stopAt: human_gate        # await user decision after written review
```

Parent does **not** pass full chat history — only `userGoal`, `phase`, and IDs/paths from persisted state.

### 4.2 Phase-locked tool allowlists

Mirror server gates in the subagent brief:

| Worker | Phase | Can call | Cannot call |
|--------|-------|----------|-------------|
| Review | before ack | `review_status`, `readiness_scan`, `readiness_output_checklist`, `graph_impact` | `review_approve` |
| Review | `awaiting_decision` | `review_approve`, `review_reject` | `spec_approve`, … |
| Resolve-task | pre-plan | `docs_search`, `context_list` | `graph_impact`, edits, `resolve_task` |
| Resolve-task | post `task_approve_plan` | `resolve_task`, edits, `index` | `review_approve` |
| Generate | pre-plan | `workspace_check`, `context_list` | writes under `docs/` |
| Comments | plan | `comments_plan` | `comments_resolve` until edits committed |

`workflowGuidance` on MCP responses (already on `task_get`, `spec_list`, `comments_inbox`) feeds the handoff `phase` field.

### 4.3 Context diet

| Worker | Load | Skip |
|--------|------|------|
| Review | One doc + diff + impact summary | Full SRS tree, generate templates |
| Comments | One thread + target doc section | Graph analyze, generate runbooks |
| Resolve-task | GoalSpec fields + 1–2 lookup queries | All chapter context files |
| Generate SRS | Current wave templates + graph slice for wave | Comment inbox, review queue |

### 4.4 Output contract

Every worker ends with the same shape (parent parses this):

```typescript
interface SubagentResult {
  workflowId: string;
  phase: string;           // e.g. awaiting_decision, plan_drafted, wave_complete
  status: "blocked" | "waiting_user" | "phase_complete" | "workflow_complete";
  summary: string;         // user-facing, 3–8 sentences
  /** Parent MUST show this in main chat when status === "waiting_user". Worker cannot ask user directly. */
  askUser?: { question: string; options?: { id: string; label: string }[] };
  artifacts?: string[];    // paths, C-ids, task ids
  suggestedNext?: {
    workflowId?: string;   // if handoff needed (task-router → generate-srs)
    message?: string;      // what user should say next
    tools?: string[];
  };
}
```

---

## 5. Routing flow (orchestrator algorithm)

```text
1. Normalize message
2. workflow_route({ message })  → skill, confidence, context, askUser?, nextTools, avoidTools
3. If askUser → show options, STOP (no subagent)
4. Map skill → workflowId (table in §3)
5. If active session/task conflicts with route → session wins (priority 0.5, already in router)
6. Build SubagentHandoff from route result + context
7. Spawn worker subagent (readonly: false, single workflow)
8. On SubagentResult:
   - waiting_user → parent shows summary + gate question
   - phase_complete → parent may re-spawn same worker with updated phase OR ask user
   - workflow_complete → parent offers next pipeline step from WORKFLOW.md
   - suggestedNext.workflowId → spawn that worker
```

### Skill → workflowId map (for orchestrator)

| `workflow_route.skill` | `workflowId` |
|------------------------|--------------|
| `ai-spector-review` | `doc-review` |
| `ai-spector-resolve-comments` | `resolve-comments` |
| `ai-spector-generate-srs` | `generate-srs` |
| `ai-spector-generate-basic-design` | `generate-basic-design` |
| `ai-spector-generate-prototype` | `generate-prototype` |
| `ai-spector-resolve-task` | `resolve-task` |
| `ai-spector-task` | `task-router` |
| `ai-spector-generate` (spec) | `spec-queue` |
| `ai-spector-graph` | `graph-ops` |
| `ai-spector-search` | `search` |
| `ai-spector-setup` / `ai-spector-check` | `setup-check` |

### Cursor commands → direct spawn

| Command | Skip routing | Spawn |
|---------|--------------|-------|
| `/review` | yes (high confidence) | `doc-review` |
| `/review srs/01-overview` | yes | `doc-review` with `activeLogicalPath` |
| *(future)* `/resolve-comments` | yes | `resolve-comments` |
| *(future)* `/generate-srs` | yes | `generate-srs` |

---

## 6. How this improves understanding & routing

### For the user

- **Predictable entry points:** commands map 1:1 to a worker (“`/review` always means document sign-off”).
- **Clear boundaries:** ambiguous “approve” never starts a worker until the 4-option menu is answered.
- **Consistent summaries:** each worker speaks the vocabulary of its workflow (review summary vs GoalSpec table vs inbox table).

### For the parent agent

- **Smaller always-on context:** routing rule stays ~60 lines; heavy runbooks load only inside workers.
- **Deterministic delegation:** `workflow_route` + `workflowGuidance` → structured handoff, less improvisation.
- **Session stickiness:** active `ReviewSession` or unapproved `TaskState` forces the same worker on “continue”.

### For workers

- **No routing decisions:** forbidden to call `workflow_route` or read `_skill-router.md` (orchestrator only).
- **Single runbook:** reduces tool misuse (e.g. Comments Worker never sees `review_approve`).
- **Phase awareness:** MCP responses include `workflowGuidance.phase` aligned with allowlists.

---

## 7. Implementation phases

Ordered by value / dependency (same pattern as [review-routing-impl-plan.md](./review-routing-impl-plan.md)).

### Phase A — Orchestrator contract (scaffold only, no core code)

| Task | File |
|------|------|
| A.1 Subagent catalog + handoff/result types in docs | this file |
| A.2 Orchestrator section in `ai-spector-routing.mdc` (“delegate, don’t inline runbooks”) | `scaffold/cursor/rules/ai-spector-routing.mdc` |
| A.3 Per-skill “Subagent spawn” block at top of each worker skill | `scaffold/cursor/skills/*/SKILL.md` |
| A.4 `WORKFLOW.md` — “parent delegates to specialized subagent” | `scaffold/cursor/WORKFLOW.md` |

**Acceptance:** Parent agent reading routing rule spawns a worker instead of loading 3 runbooks in one chat.

**Status:** ✅ Implemented

### Phase B — Spawn templates (Cursor)

| Task | File |
|------|------|
| B.1 `scaffold/cursor/subagents/` directory with one `.md` per `workflowId` | new |
| B.2 Each file: role, read_first, phase tool matrix, output contract, NOT WHEN | new |
| B.3 Link from skill `SKILL.md` → matching subagent brief | skills |
| B.4 Commands: `/resolve-comments`, `/generate-srs` (optional) | `scaffold/cursor/commands/` |

**Acceptance:** `Task({ subagent_type, prompt: SubagentHandoff })` has a canonical prompt template per workflow.

**Status:** ✅ Implemented

### Phase C — Core routing enrichment (optional)

| Task | File |
|------|------|
| C.1 `workflow_route` returns `workflowId` + `handoff` object | `route-intent.ts` |
| C.2 Extend `workflowGuidance` to all gated tools | `guidance.ts`, MCP tools |
| C.3 `workflow_route` tests for workflowId mapping | `tests/workflow/` |

**Acceptance:** MCP `workflow_route` response is copy-pasteable as subagent spawn prompt. Gated MCP tools return `workflowGuidance` with `workflowId` and phase.

**Status:** ✅ Implemented (C.1–C.3)

### Phase D — Observability

| Task | File |
|------|------|
| D.1 Log `workflowId` + phase transitions in `.ai-spector/.docflow/` | `active-worker.ts`, hooks in route/session/task |
| D.2 Parent shows “Active worker: doc-review (reviewing srs/01)” in status | `workflow_status` MCP, `ACTIVE-WORKER.md`, routing rule |

**Acceptance:** `workflow_status` returns `statusLine`; transitions append to `workflow-log.jsonl`.

**Status:** ✅ Implemented

---

## 8. Example flows

### 8.1 Document sign-off

```text
User: /review
Orchestrator: workflow_route → ai-spector-review (high)
Spawn: doc-review, phase=detect
Worker: review_check → review_queue → wait user pick
User: srs/01-overview
Spawn: doc-review, phase=reviewing, path=srs/01-overview
Worker: review_status → readiness checklist → read doc → graph_impact → write review → ack → waiting_user
User: Approve
Spawn: doc-review, phase=awaiting_decision
Worker: review_approve → workflow_complete
```

### 8.2 Ambiguous approve

```text
User: looks good
Orchestrator: workflow_route → askUser (4 options) — NO spawn
User: 1 (document sign-off)
Spawn: doc-review
```

### 8.3 Incremental change (not generate)

```text
User: add login with Google
Orchestrator: workflow_route → resolve-task (high)
Spawn: resolve-task
Worker: task_create → clarify → GoalSpec + TaskPlan → waiting_user
User: yes
Worker: task_approve_plan → resolve_task → workflow_complete
```

### 8.4 Resume conflates with review session

```text
ReviewSession.phase = reviewing
User: continue
Orchestrator: priority 0.5 → doc-review (NOT task-router)
Spawn: doc-review with session path
```

---

## 9. Anti-patterns (explicitly forbidden)

| Anti-pattern | Why | Fix |
|--------------|-----|-----|
| One subagent for “all ai-spector work” | Defeats specialization; same routing confusion | Orchestrator + catalog |
| Worker reads `_skill-router.md` | Double routing, conflicting decisions | Orchestrator only |
| Worker spawns another worker | Orchestrator owns delegation graph | Return `suggestedNext` |
| Inline runbook in parent after Phase A | Parent context bloat, gate skips | Always delegate |
| `explore` subagent for doc review | Wrong tool set and instructions | Use workflow-specific worker |

---

## 10. Open decisions

| Question | Recommendation |
|----------|----------------|
| Cursor native subagents vs `Task` tool? | Start with `Task` + scaffold briefs (Phase B); migrate if Cursor adds project subagent config. |
| Should workers run `readonly: true` for plan/discover phases? | Yes for resolve-task Phase 3 (discover only). |
| Multi-doc review in one spawn? | No — one logical path per spawn; parent loops on queue. |
| Spec queue inside generate worker or separate? | Separate `spec-queue` worker after `task_record_wave` offers extract — keeps generate context smaller. |

---

## References

- [review-routing-impl-plan.md](./review-routing-impl-plan.md) — approve disambiguation, session gates
- [review-system-handover.md](./review-system-handover.md) — two-track approval model
- `scaffold/cursor/skills/_skill-router.md` — priority table
- `src/core/workflow/route-intent.ts` — `workflow_route` classifier
- `src/core/workflow/guidance.ts` — per-tool phase hints
