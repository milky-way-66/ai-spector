# Review / Approve Routing — Implementation Plan

> Problem: agents confuse **document sign-off** (`review_approve`) with **spec
> approval** (`spec_approve`), **plan approval** (`task_approve_plan`), and
> **comment resolution** (`comments_resolve`). "Approve" and "review" are overloaded
> across skills and MCP tools.

## Sequencing overview

```text
Phase 1  Skills + rules (routing guardrails)     ← ship first, no code changes
Phase 2  MCP tool layer (descriptions + gates)   ← depends on Phase 1 semantics
Phase 3  Workflow state (deterministic gates)    ← optional hard enforcement in core
```

Phases are ordered by dependency. Phase 1 reduces mis-routing immediately via
agent instructions. Phase 2 adds server-side preconditions. Phase 3 makes
`review_approve` a true state-machine gate.

---

## Phase 1 — Skills + rules (routing guardrails)

**Goal:** Agents reliably route to `ai-spector-review` for document sign-off and
never call `review_approve` without the phased runbook.

| # | Task | File |
|---|------|------|
| 1.1 | Add 4-way **approve** disambiguation table | `scaffold/cursor/skills/_skill-router.md` |
| 1.2 | Elevate review routing priority (before generic task resume when sign-off cues present) | `scaffold/cursor/skills/_skill-router.md` |
| 1.3 | New Cursor rule: review gate (phases, forbidden tools, decision menu) | `scaffold/cursor/rules/ai-spector-review.mdc` |
| 1.4 | Tighten skill `description` with NOT WHEN cross-refs | `scaffold/cursor/skills/ai-spector-review/SKILL.md` |
| 1.5 | Cross-ref in sibling skills (resolve-task, resolve-comments, generate) | `scaffold/cursor/skills/ai-spector-resolve-task/SKILL.md`, `ai-spector-resolve-comments/SKILL.md`, `ai-spector/references/extract-specs.md` |
| 1.6 | Document `/review` canonical entry + approve matrix | `scaffold/cursor/WORKFLOW.md` |
| 1.7 | Add review to skills README quick pick | `scaffold/cursor/skills/README.md` |

**Acceptance:**

- Agent reading `_skill-router.md` can distinguish all four approve types from one table.
- `ai-spector-review.mdc` is `alwaysApply: true` and forbids `review_approve` without Phase 4 review in chat.
- User saying `/review` or "approve srs/01-overview" routes to `ai-spector-review`, not resolve-task.
- Test prompts (manual): see § Test matrix below.

**Status:** ✅ Implemented (see git history for this plan file).

---

## Phase 2 — MCP tool layer

**Goal:** Tool descriptions and lightweight preconditions reduce wrong-tool calls
even when the agent skips skill instructions.

| # | Task | File |
|---|------|------|
| 2.1 | WHEN / NOT WHEN blocks on all approve-like tools | `src/interfaces/mcp/server.ts` |
| 2.2 | Cross-reference sibling tools in descriptions (`review_approve` ↔ `spec_approve` ↔ `task_approve_plan` ↔ `comments_resolve`) | `src/interfaces/mcp/server.ts` |
| 2.3 | Structured `PRECONDITION_FAILED` hint when `review_approve` called in wrong state | `src/core/operations/review.ts`, `src/interfaces/mcp/tools/reviews.ts` |
| 2.4 | Optional: `review_session_start` or phase metadata in `review_status` response | `src/core/operations/review.ts`, schemas |
| 2.5 | Tests for precondition errors and description contract | `tests/operations/review.test.ts` |

**Acceptance:**

- `review_approve` on `pending_client` returns actionable hint (already throws; enrich message).
- Each approve-like MCP tool description names the other three explicitly.
- Agent test: "approve SPEC-001" must not suggest `review_approve`.

**Status:** ✅ Implemented

---

## Phase 3 — Workflow state (deterministic gates)

**Goal:** Document sign-off is a persisted state machine, not prompt honor system.

| # | Task | File |
|---|------|------|
| 3.1 | `ReviewSession` type + `.ai-spector/.docflow/review-queue/.session.json` | `src/core/reviews/types.ts`, `storage.ts` |
| 3.2 | Session phases: `detect` → `queue` → `reviewing` → `awaiting_decision` → `done` | `src/core/operations/review.ts` |
| 3.3 | `review_approve` rejects unless `phase === awaiting_decision` for `logicalPath` | `src/core/operations/review.ts` |
| 3.4 | MCP `review_session_start` / update session on `review_status` + review write ack | `src/interfaces/mcp/tools/reviews.ts` |
| 3.5 | Migrate / clear session on `review_approve` / `review_reject` | `src/core/operations/review.ts` |
| 3.6 | Runbook Phase 5–6 updated for session tools | `scaffold/cursor/skills/ai-spector-review/references/runbook.md` |
| 3.7 | Tests: full happy path + reject approve without session | `tests/operations/review.test.ts` |

**Acceptance:**

- `review_approve` without prior `review_status` for same path returns `PRECONDITION_FAILED`.
- Session file is gitignored or committed per team policy (document in handover).
- CLI parity if session is MCP-only initially.

**Status:** ✅ Implemented

---

## Phase 4 — Routing UX (accuracy, tokens, user-friendly)

**Goal:** Less duplicated always-on prompts, clearer disambiguation, user-facing errors, `/review` entry point.

| # | Task | File |
|---|------|------|
| 4.1 | Fix resolve-comments trigger conflict | `ai-spector-resolve-comments/SKILL.md` |
| 4.2 | Friendly 4-option approve disambiguation | `_skill-router.md`, `WORKFLOW.md`, `ai-spector-routing.mdc` |
| 4.3 | Session-aware priority 0.5 in router | `_skill-router.md`, `ai-spector-routing.mdc` |
| 4.4 | Consolidate 3 alwaysApply rules → one | `ai-spector-routing.mdc` (supersedes review/generate/resolve-task rules) |
| 4.5 | `/review` Cursor command | `scaffold/cursor/commands/review.md` |
| 4.6 | `userMessage` on PRECONDITION_FAILED | `errors.ts`, `session.ts` |
| 4.7 | `workflow_route` MCP tool | `workflow-route.ts`, MCP server |
| 4.8 | `workflowGuidance` on task_get / spec_list / comments_inbox | `guidance.ts`, operations |

**Acceptance:**

- One `alwaysApply` routing rule (~60 lines) replaces three (~130 lines).
- Ambiguous approve asks four user-facing options including comment threads.
- `ReviewPreconditionError.toPayload()` includes `userMessage`.
- `/review` command file exists in scaffold.

**Status:** ✅ Implemented

---

## Test matrix (all phases)

Run in Cursor with ai-spector MCP enabled after each phase.

| Prompt | Expected route / tool |
|--------|------------------------|
| `/review` | `ai-spector-review` → `review_check` → queue |
| "approve srs/01-overview" | `ai-spector-review` → phases → `review_approve` |
| "approve SPEC-003" | `spec_approve` (generate stage 6) |
| "looks good, go ahead" (after plan table) | `task_approve_plan` |
| "approve the plan and generate" | `task_approve_plan` then generate — **not** `review_approve` |
| "review C-012" | `ai-spector-resolve-comments` |
| "review queue" | `review_queue` only |
| "just approve it" (mid document review) | write review first, then `review_approve` |
| "resolve comment on srs/01" | `comments_resolve` — **not** `review_approve` |
| "approve it" (unclear) | `workflow_route({ message })` → askUser or skill |

---

## References

- [review-system-handover.md](./review-system-handover.md) — two-track approval model
- [workflow-redesign-impl-plan.md](./workflow-redesign-impl-plan.md) — prior phased plan pattern
- External: MCP tool naming ([Archestra](https://archestra.ai/blog/mcp-tool-naming-conventions)), HITL gates ([ThinkBot governance playbook](https://thinkbot.agency/blog/ai-automation-governance-framework-embedding-ai-into-workflows-playbook))
