# AI Spector — Claude Agent Rules

You are working in an **AI Spector** managed project. The agent workflow is: read skills, call **MCP tools** (preferred) or `npx ai-spector` CLI (fallback), report results. You do not write doc content from scratch — MCP tools / CLI + skills do the work.

Skills load automatically from `.claude/skills/` (see [.claude/skills/README.md](./.claude/skills/README.md)). User guide: [WORKFLOW.md](./WORKFLOW.md). Workflow triggers: [.claude/workflows/README.md](./.claude/workflows/README.md). Full router: [.claude/skills/_skill-router.md](./.claude/skills/_skill-router.md). Rules: [.claude/rules/](./.claude/rules/).

## CLI invocation

# AI Spector CLI invocation

Agents must run the CLI as **`npx ai-spector …`**, not bare `ai-spector`.

- Works when the package is only a project dependency (no global install).
- Still works when `ai-spector` is installed globally (`npx` resolves the local or latest package as appropriate).

Examples:

```bash
npx ai-spector graph validate
npx ai-spector index
npx ai-spector prototype manifest --strict
```

Do not substitute `ai-spector` without `npx` in terminal commands or skill runbooks.


## Mandatory Rules

### 1. MCP first, CLI fallback

When the `ai-spector` MCP server is available, **call the MCP tool** instead of shelling out to `npx ai-spector`.

| Operation | MCP tool | CLI fallback |
|-----------|----------|--------------|
| Re-index project | `index({})` | `npx ai-spector index` |
| Merge knowledge → graph | `graph_merge({ fromKnowledge: true })` | `npx ai-spector graph merge --from-knowledge` |
| Validate graph | `graph_validate({})` | `npx ai-spector graph validate` |
| Impact analysis | `graph_impact({ originId, change })` | `npx ai-spector graph impact …` |
| Walk graph from node | `graph_query({ id })` | `npx ai-spector graph query <id> --json` |
| **Analyze data-source** | *(agent step — read `docs/data-source/`, write `analysis/knowledge.json`, then `index({})`)* | — |

### 2. Refresh index before any staleness check

Before checking translation status, pending queue, or "what's outdated":

```
index({})                    # MCP preferred
npx ai-spector index         # CLI fallback
```

Then read the queue. **Never read `.ai-spector/.docflow/translation-queue/pending.json` without running index first** — the queue is only accurate after indexing.

### 3. Check impact and refresh embeddings after any doc edit

After editing any file under `docs/srs/`, `docs/basic-design/`, or `docs/detail-design/`:

**a) Impact:**
```
graph_impact({ git: true, change: "content_change" })   # MCP preferred
npx ai-spector graph impact --git --json  # CLI fallback (no --change flag)
```

**b) Re-index + embeddings (mandatory when CocoIndex is configured):**
```
index({ cocoindexSync: true })    # preferred — refreshes graph + embeddings in one call
```

Skip impact/index only when the user explicitly says it was a typo-only fix with no traceability concern. **Never skip `cocoindexSync` when CocoIndex is configured** — semantic search goes stale silently.

### 4. Use MCP/graph — not file search

| Need | MCP (preferred) | CLI fallback |
|------|-----------------|--------------|
| Prepare graph scaffold | `index({})` | `npx ai-spector index` |
| Check knowledge.json before merge | `knowledge_status({})` · `knowledge_validate({})` | *(no CLI)* |
| Merge knowledge → graph | `graph_merge({ fromKnowledge: true })` | `npx ai-spector graph merge --from-knowledge` |
| Find what needs regeneration | `graph_impact({ git: true, change: "content_change" })` | `npx ai-spector graph impact --git --json` |
| Find node by exact ID | `graph_query({ seedId: "…" })` | `npx ai-spector graph query <id> --json` |
| Find node by concept | `graph_query_fuzzy({ query: "…" })` — requires CocoIndex | — |
| Search docs by meaning | `docs_search({ query: "…" })` — requires CocoIndex | — |
| Check graph health | `graph_validate({})` · `graph_report({})` | `npx ai-spector graph validate` |
| Translation queue | `lang_queue({})` | `npx ai-spector lang queue pending --json` (after index) |
| CocoIndex readiness | `cocoindex_status({})` | `npx ai-spector setup --check` |
| Rebuild embeddings | `cocoindex_index({})` or `index({ cocoindexSync: true })` | `npx ai-spector cocoindex index` |
| Route ambiguous intent | `workflow_route({ message })` | follow `_skill-router.md` |

**Only fall back to `grep` or `Read` when the tool returns no results or you need raw file content for editing.**

## Routing

# AI Spector routing

**Full router:** `.cursor/skills/_skill-router.md` · **User guide:** `.cursor/WORKFLOW.md` · **Slash commands:** `.cursor/commands/README.md` · **MCP parity tests:** `src/core/workflow/route-intent-examples.ts`

## Slash commands (override)

When the user invokes a slash command (`/generate-detail-design`, `/resolve-task`, `/review`, etc.), read `.cursor/commands/<name>.md` and activate the skill named there. **Do not** re-route via natural-language priority below.

## MCP routing (when ai-spector server is enabled)

For **ambiguous intent**, **approve/review disambiguation**, or when skill matching is unclear → call **`workflow_route({ message })`** first. Use `handoff.readBrief` + `handoff.skill`; if `askUser`, show options and stop before any gated tool.

Without MCP: follow priority table below and `_skill-router.md` (same rules, no structured handoff).

## Priority (first match wins)

0. **Document sign-off** — approve doc, review queue, pending client, logical path (`srs/…`) → **`ai-spector-review`**
0.5. **Active review session** — if `.ai-spector/.docflow/review-queue/.session.json` phase is `queue`, `reviewing`, or `awaiting_decision` → **`ai-spector-review`** (overrides "continue"/"resume" unless user clearly switches topic)
0.75. **Onboarding help** — help (setup context), I'm stuck, where am I, what's next (project progress) → **`ai-spector`** — read `references/help.md` (not generate/resolve-task unless lifecycle is complete)
1. **Resume task** — resume, continue generation, active tasks → **`ai-spector-task`** (skip if sign-off cues, active review session, or onboarding help cues in 0.75)
1.5. **Upgrade ai-spector** — upgrade, update ai-spector, sync after update, stale scaffold, continue upgrade → **`ai-spector-upgrade`**
2. **Incremental change** — add/update/change/"I want to…" → **`ai-spector-resolve-task`** (exception: "I want to generate …" → **`ai-spector-generate-*`**)
2.5. **Migrate / adopt existing docs** — migrate project, adopt existing docs, wrong SRS folder, legacy SRS, move docs to ai-spector structure, continue adopt → **`ai-spector-adopt`**
3. **Full generation** — generate SRS/chapter/DAG → **`ai-spector-generate-*`**

## Ambiguous "approve" or "looks good"

Call **`workflow_route({ message })`** or ask **one** question — do **not** call any approve tool until answered:

```
Which did you mean?
1. Sign off a document (e.g. srs/01-overview) — formal approval
2. Approve an extracted spec (e.g. SPEC-003) — after generation
3. Go ahead with the plan we discussed — start making changes
4. Mark a comment thread done (e.g. C-012) — feedback addressed
```

| Answer | Skill | Tool |
|--------|-------|------|
| 1 | `ai-spector-review` | `review_approve` (after runbook) |
| 2 | generate + extract-specs | `spec_approve` |
| 3 | resolve-task or generate | `task_approve_plan` |
| 4 | `ai-spector-resolve-comments` | `comments_resolve` |

## Document review gate

Triggers: review documents, approve doc, review queue.

1. Activate **`ai-spector-review`** — read `references/runbook.md`
2. Phases: `review_check` → `review_queue` → `review_status` + read doc → `graph_impact` → **write review in chat** → `review_session_ack_review` → decision menu → `review_approve` only on user **Approve**
3. **Forbidden:** `review_approve` without written review + ack; using `spec_approve` / `task_approve_plan` / `comments_resolve` for document sign-off

## Generate gate (SRS / basic design / detail design)

Triggers: generate SRS, write chapter, DAG wave, detail design.

1. **`ai-spector-generate-srs`**, **`ai-spector-generate-basic-design`**, or **`ai-spector-generate-detail-design`** — not resolve-task
2. `task_list` → clarify → briefing → plan → **`task_approve_plan`** before any `docs/` write
3. `task_approve_plan` is **plan** approval — not document sign-off (`review_approve`)

## Resolve-task gate (incremental)

Triggers: add/update/change feature, section, or prototype.

1. **`ai-spector-resolve-task`** — not generate-srs for single-feature adds
2. Clarify → GoalSpec + TaskPlan → wait for **yes** → then edit / `graph_impact` / `resolve_task`
3. **Forbidden before plan approval:** edits under `docs/` or `prototype/`, `graph_impact`, `index`

## Adopt gate (migrate existing docs)

Triggers: migrate project, adopt existing docs, wrong SRS folder, legacy layout, continue adopt.

1. Activate **`ai-spector-adopt`** — read `references/runbook.md`
2. Phases: `workspace_check` → `adopt_scan` (Gate 1) → `adopt_plan` → user **approve plan** (Gate 2) → `adopt_apply` → user confirms bootstrap (Gate 3) → `adopt_bootstrap` → `adopt_validate` → user **migration complete** → `adopt_setup_mark migration.complete` (Gate 4)
3. **Forbidden:** `adopt_apply` before plan approved; `adopt_setup_mark migration.complete` while validate has blocking gaps; using `task_approve_plan` for adopt plan approval

## Upgrade gate (package version bump)

Triggers: upgrade ai-spector, update ai-spector, stale scaffold, sync after npm install.

1. Activate **`ai-spector-upgrade`** — read `references/runbook.md`
2. Phases: `upgrade_scan` → confirm → npm install → `upgrade_apply` → manual/agent items → `upgrade_validate`
3. **Forbidden:** `upgrade_setup_mark upgrade.complete` without `upgrade_validate` ready; using `init --force` as upgrade shortcut

## Generate vs incremental

| Request | Skill |
|---------|-------|
| "generate SRS", "write chapter 4" | generate-srs / generate-basic-design / generate-detail-design |
| "add login with Google", "update auth section" | resolve-task |


### Workflow triggers (Claude Code)

When routing is wrong, the user can say `workflow: <name>` (e.g. `workflow: generate-detail-design`). Read `.claude/workflows/<name>.md` and follow it — same content as Cursor slash commands.

## Plan approval gate

# Plan approval gate (work_approve_plan)

**Server enforces gates** — `work_approve_plan` throws `PRECONDITION_FAILED` if steps are skipped.

## Never treat as plan approval

| User says | Meaning | Action |
|-----------|---------|--------|
| "ok", "ok tạo 4 file đầu", "làm đi", "tạo đi" | Agrees to **start** or **scope** | Continue gates — do **not** call `work_approve_plan` |
| "yes", "đồng ý", "go ahead", "approve the plan" | Approves **plan table shown in chat** | `work_approve_plan` |

## Generate workflow (mandatory order)

1. `workspace_check` → `snapshot.workspaceCheckAt` → check **done**
2. `readiness_assess` + criteria table → `snapshot.readinessReportShown` → clarify **done**
3. Context briefing per file → user confirms → `snapshot.briefingConfirmedAt` → briefing **done**
4. Plan table in chat → `snapshot.planPresentedAt` + `phaseStatus: awaiting_user`
5. User **explicit yes** → `work_approve_plan` only

## Forbidden

- `work_approve_plan` in the same turn as `work_list` bootstrap
- Marking plan step **done** via `work_update` (only `work_approve_plan` completes plan)
- Writing under `docs/srs/` / `docs/basic-design/` before step 5
- `work_record_step` before `work_approve_plan`

## On PRECONDITION_FAILED

Stop. Report the `hint` from the error payload. Complete the blocked step — do not retry `work_approve_plan` until gates pass.


## After doc edits

# After doc edits — impact + queue

When following **ai-spector-resolve-task**, run impact and index only **after plan approval**, as steps in the approved TaskPlan — not during planning.

When you **finish editing** any file under `docs/srs/`, `docs/basic-design/`, or `docs/detail-design/`:

## 0. Workspace check (generate runs)

After each write during **generate** workflows:

```bash
npx ai-spector check --path <repo-relative-path>
```

TASK-003 warnings mean no approved active generate task — run `task_list` bootstrap / `task_approve_plan` first.

## 1. Check traceability impact

Before closing the task, run impact for what changed:

```bash
git diff HEAD
```

If the repo has no commits yet:

```bash
git diff
git diff --cached
```

Then:

```bash
npx ai-spector graph impact --git --json
```

When edits are under **`docs/basic-design/`** or **`docs/detail-design/`**, also check upstream SRS drift:

```bash
npx ai-spector graph impact --git --direction both --json
```

For a single aggregate SRS file (e.g. `docs/srs/3-use-cases.md`):

```bash
npx ai-spector graph impact --file <repo-relative-path> --json
```

> **Note:** For per-use-case or per-feature projection files (e.g. `docs/srs/**/UC-NN-*.md`, `docs/srs/**/f-NN-*.md`),
> `--file` alone may not resolve — prefer `--git`, or add `--heading "<section heading>"`,
> or pass the domain node id directly (e.g. `graph impact UC-10 --json`).

Parse `regenerate` / `review` / `syncUpstream` buckets with `projectionPath`. If `syncUpstream` is non-empty, offer **`ai-spector-resolve-task`** (Standard tier) for affected SRS paths — suggest-only, no auto-regen. If `noTraceabilityImpact: true`, tell the user no doc traceability impact was found. Do not invent regen lists — use CLI output only.

Full runbook: `.cursor/skills/ai-spector-graph/references/impact.md`

## 2. Refresh index and translation queue

```bash
npx ai-spector index
```

This updates fingerprints and reconciles `.ai-spector/.docflow/translation-queue/`. New pending jobs mean other languages are stale.

## 3. Tell the user

- **Impact summary** — what may need regeneration (regenerate / review buckets)
- **Translation queue** — pending job count; offer `resolve-translation` if multi-lang and jobs exist

Skip impact only when the user explicitly asked for a typo-only fix with no traceability concern, or when `graph validate` is known broken and user chose to defer.

## Pre-commit hook (local)

Install once (also runs on `npx ai-spector init` in a git repo):

```bash
npx ai-spector hooks install
```

On `git commit`, staged `docs/**` or `.ai-spector/graph/**` changes trigger:

| Check | Result |
|-------|--------|
| `graph validate` | **Blocks** commit on errors |
| Translation queue | **Warns** if pending jobs match staged docs |
| Graph impact | **Warns** if regen/review needed |

Strict mode (warnings block): edit hook to pass `--strict`, or run `npx ai-spector hooks pre-commit --strict` before commit. Bypass once: `git commit --no-verify`.


## Skill → task mapping

| You want to… | Skill |
|-------------|-------|
| Setup / bootstrap project | `ai-spector` |
| Upgrade ai-spector | `ai-spector` |
| Adopt / migrate existing docs | `ai-spector` |
| Check workspace / clarifications | `ai-spector` |
| Docops / Writer contract bootstrap | `ai-spector` |
| Resume / active work / pause | `ai-spector` |
| Learn / open course | `ai-spector` |
| Analyze data source / build graph | `ai-spector-graph` |
| Check impact of changes | `ai-spector-graph` |
| Semantic search / fuzzy graph lookup | `ai-spector-graph` |
| Layer sync audit / doc drift | `ai-spector-graph` |
| Generate documents (SRS, BD, DD, prototype) | `ai-spector-generate` |
| Add/update feature or section ("I want to add…") | `ai-spector-generate` |
| Import / set up custom template pack | `ai-spector-generate` |
| **Review / approve documents** | `ai-spector-contract` |
| Resolve comment threads (C-NNN) | `ai-spector-contract` |
| Resolve prototype comments (B-NNN) | `ai-spector-contract` |
| Translation status / resolve translations | `ai-spector-contract` |

## Quick reference — MCP tools

| Tool | Purpose |
|------|---------|
| `workflow_route({ message })` | Route ambiguous intent to the correct skill |
| `knowledge_status({})` | Check knowledge.json entity counts |
| `knowledge_validate({})` | Validate knowledge.json schema |
| `graph_merge({ fromKnowledge: true })` | Merge knowledge.json into graph |
| `graph_validate({})` | Check graph integrity |
| `graph_report({})` | Graph layer health audit |
| `graph_impact({ git: true, change: "…" })` | Impact of current git diff |
| `graph_query({ seedId: "…" })` | Walk graph from a node |
| `index({})` | Full index pipeline |
| `index({ cocoindexSync: true })` | Refresh graph + translation queue + embeddings |
| `lang_queue({})` | Translation queue status |
| `cocoindex_status({})` | CocoIndex readiness check |
| `cocoindex_index({})` | Rebuild semantic embeddings |
| `docs_search({ query })` | Semantic doc search (CocoIndex) |
| `graph_query_fuzzy({ query })` | Natural language graph lookup (CocoIndex) |
| `work_create` / `work_list` / `work_get` / `work_update` / `work_approve_plan` | Work session lifecycle |
| `work_pause` / `work_resume` / `work_record_step` / `work_complete` | Pause, resume, record step, finish |
| `workspace_check({ fix? })` | Structural workspace check |
| `context_list` / `context_record` / `context_resolve` | Clarification store |
| `spec_list` / `spec_record` / `spec_approve` / `spec_reject` | Extracted-spec review queue |
| `contract_review({ action, logicalPath, by? })` | Document review: check/status/approve/decline/close/reject |
| `contract_comments({ action, ... })` | Comment threads: inbox/show/resolve/batch_plan/batch_resolve |
| `contract_translate({ action, ... })` | Translation queue: list/fail/retry |
| `review_begin` / `review_check` / `review_queue` / `review_status` | Document review workflow (votes + quorum in status) |
| `review_session_ack_review` | Ack review summary written (unlocks approve gate) |
| `review_approve` / `review_decline` / `review_close` / `review_reject` | Legacy review tools (deprecated — use contract_review) |
| `lang_queue({ status? })` | Translation queue status |

### CLI (fallback)

```bash
npx ai-spector index
npx ai-spector graph validate
npx ai-spector graph impact --git --json
npx ai-spector lang queue pending --json
npx ai-spector setup --check
npx ai-spector sync-claude          # refresh Claude skills after package upgrade
npx ai-spector resolve-task plan.json
```

On MCP tool or CLI failure: show the output, offer fix / workaround / pause. Do not invent results.

## Pipeline order

```
index → analyze (if needed) → generate SRS (gated) → index → spec review
  → generate basic design (gated) → index → detail design → prototype
```

### Gated generation (mandatory for every generate run)

```
1. CHECK     workspace_check({}) — stop on errors
2. CLARIFY   resolve ALL missing info
3. BRIEFING  sources, graph nodes, Q-xxx answers → user confirms
4. PLAN      plan table → explicit "yes" before any write
5. GENERATE  DAG waves
6. EXTRACT   key specs → spec_record → human review queue
```

No auto-confirm: generation never starts while a clarification gap is unanswered and never before the user approves the plan.
