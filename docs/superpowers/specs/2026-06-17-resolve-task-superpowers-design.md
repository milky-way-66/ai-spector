# Resolve-Task Superpowers Parity — Design Spec

> **Status:** Approved  
> **Date:** 2026-06-17  
> **Scope:** ai-spector resolve-task workflow — tiered Superpowers + generate gate parity  
> **Approach:** A — unified skill + tier-aware server gates

---

## 1. Problem

Resolve-task today is plan-first but **lighter** than generate and **lacks Superpowers depth**:

| Capability | Generate | Resolve-task (today) |
|------------|----------|----------------------|
| `workspace_check` gate | ✓ | ✗ |
| Scoped `readiness_assess` | ✓ | ✗ |
| Context briefing | ✓ | ✗ |
| Design spec before plan | brainstorming | ✗ |
| Bite-sized implementation plan file | writing-plans | in-chat table only |
| Post-execute verification | output-compliance | minimal |
| Subagent execution option | N/A | ✗ |
| Server `PRECONDITION_FAILED` gates | full | clarify + plan only |

Agents can skip quality stages; plans stay coarse; large incremental changes lack the rigor of full generate or Superpowers.

---

## 2. Goals

| Goal | Detail |
|------|--------|
| **Tiered depth** | Fast / Standard / Full — agent proposes, user confirms |
| **Superpowers alignment** | Standard/Full: plan files; Full: design spec; execution handoff (inline vs subagent) |
| **Generate reuse** | Scoped readiness, briefing, output-compliance references |
| **Server enforcement** | Hybrid — gates scale with tier on `task_approve_plan` |

### Success criteria

1. Fast tier: today's latency + post-verify `workspace_check` on changed paths
2. Standard: server requires `implementationPlanPath`, briefing, scoped readiness before approval
3. Full: server requires approved design spec + implementation plan before approval
4. `task_approve_plan` returns `PRECONDITION_FAILED` when tier gates skipped
5. User chooses subagent vs inline on Standard/Full after approval
6. Legacy tasks without `resolveTier` resume as Fast

### Out of scope

- New MCP tools
- `resolve_task` executor registry changes
- Custom pack resolve flows
- Auto-tier without user confirm

---

## 3. Tier definitions

| Tier | Typical scope | Examples |
|------|---------------|----------|
| **Fast** | 1 file, no new IDs, low risk | Typo fix, one paragraph, prototype CSS |
| **Standard** | 2–5 files, extend existing structure | Add requirement to F-12, update API + graph |
| **Full** | New feature ID, cross-layer, high impact | New F-xx across SRS+BD+prototype |

Agent shows tier + rationale + paths, user confirms **Fast / Standard / Full**.

---

## 4. Pipeline per tier

| Stage | Fast | Standard | Full |
|-------|:----:|:--------:|:----:|
| Tier confirm → `snapshot.resolveTier` + `tierConfirmedAt` | ✓ | ✓ | ✓ |
| Clarify → `goal` + `clarify` done | ✓ | ✓ | ✓ |
| `workspace_check` | — | ✓ | ✓ |
| Scoped `readiness_assess` | — | ✓ | ✓ |
| Context briefing | — | ✓ | ✓ |
| Design spec (`docs/superpowers/specs/…`) | — | — | ✓ + user approves |
| Implementation plan (`docs/superpowers/plans/…`) | — | ✓ | ✓ |
| GoalSpec + TaskPlan in chat | ✓ simple | ✓ refs plan file | ✓ refs plan file |
| `task_approve_plan` | ✓ | ✓ | ✓ |
| Execution | inline only | user picks | user picks |
| Verify before `task_complete` | `workspace_check` | + output checklist | + spec self-review |
| `graph_impact` / `index` / `graph_merge` | if in plan | if in plan | if in plan |

---

## 5. TaskSnapshot fields

```typescript
resolveTier?: "fast" | "standard" | "full";
tierConfirmedAt?: string;
designSpecPath?: string;
designSpecApprovedAt?: string;
implementationPlanPath?: string;
executionMode?: "inline" | "subagent";
```

---

## 6. RESOLVE_STEPS template

`tier` → `check` → `clarify` → `design` → `briefing` → `plan` → `execute` → `verify` → `report`

Fast tier: mark `check`, `design`, `briefing` as `skipped`.

---

## 7. Server gates

`assertResolveApproveGates` branches on `effectiveResolveTier(task)` (`snapshot.resolveTier ?? "fast"`).

Legacy tasks (no `resolveTier` and no `tierConfirmedAt`): keep pre-change Fast gates only.

`assertResolveExecutionAllowed`: blocks `resolve_task` without `planApprovedAt`.

`listApprovedTaskGateViolations`: tier-aware integrity for `workspace_check` TASK-004.

---

## 8. Artifacts

| Tier | Design spec | Implementation plan |
|------|-------------|---------------------|
| Fast | — | in-chat TaskPlan |
| Standard | — | `docs/superpowers/plans/YYYY-MM-DD-resolve-<slug>.md` |
| Full | `docs/superpowers/specs/YYYY-MM-DD-<topic>-design.md` | `docs/superpowers/plans/YYYY-MM-DD-<topic>.md` |

---

## 9. Rollout phases

1. Types + skill/runbook docs
2. Server gates + guidance
3. Verify gate references + tests
4. User-facing WORKFLOW.md + website

---

## 10. MCP tools

| Tool | When |
|------|------|
| `task_confirm_tier` | User picks Fast/Standard/Full after agent proposal |
| `task_approve_design_spec` | Full tier — user approved design spec file |
| `task_set_execution_mode` | Standard/Full — after `task_approve_plan`, before execute |
| `task_update` | All snapshot fields (alternative to dedicated tools) |
| `task_approve_plan` | Tier gates complete; explicit user yes to plan |
| `resolve_task` | Execute approved MCP steps (`taskId` required) |

---

## 11. File checklist

| Area | Files |
|------|-------|
| Core | `task.ts`, `task-templates.ts`, `task-gates.ts`, `guidance.ts` |
| MCP | `schemas.ts`, `tools/task.ts`, `server.ts` — `task_confirm_tier`, `task_approve_design_spec`, `task_set_execution_mode` |
| Tests | `task-gates.test.ts`, `task-resolve-mcp.test.ts`, `guidance.test.ts` |
| Skills | `ai-spector-resolve-task/SKILL.md`, `references/*.md` |
| Scaffold | mirror `scaffold/cursor`, `scaffold/claude` |
| Docs | `WORKFLOW.md`, `website/docs/02-chat-basics/03-incremental-changes.md` |
