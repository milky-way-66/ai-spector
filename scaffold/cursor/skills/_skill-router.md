# AI Spector skill router

Agents use this when intent is ambiguous.

## Priority

0. **Document sign-off** — `/review`, *approve doc*, *sign off*, *review queue*, *pending client*, *what changed since approval*, logical path + approve (`srs/01-overview`) → **`ai-spector-review`** first. **Not** resolve-task, generate, or comments unless user explicitly switches topic after disambiguation.
0.5. **Active review session** — if `.ai-spector/.docflow/review-queue/.session.json` exists and `phase` is `queue`, `reviewing`, or `awaiting_decision` → **`ai-spector-review`** (overrides "continue"/"resume" unless user clearly switches topic). Check session via last `review_status` response or `review_check`.
1. **Resume / task state** — *resume*, *continue*, *pick up*, *active tasks*, *in progress* → **`ai-spector-task`** (`task_list` → `task_resume`). Skip if message is clearly document sign-off (priority 0) or an active review session exists (priority 0.5).
2. **Incremental change (plan-first)** — verbs *add*, *update*, *change*, *modify*, *extend*, or phrases *"I want to"*, *"we need to"*, *create task* → **`ai-spector-resolve-task`** before any generate-* skill. Example: "add login with Google" → resolve-task, **not** generate-srs.
3. **Full generation** — *generate*, *write chapter*, *DAG wave*, *from graph* → `ai-spector-generate` or layer skill.
4. **File context** — `paths` in skill frontmatter (e.g. `prototype/**` → prototype skill) when intent is still ambiguous.
5. **Natural language** — match skill `description`; then read that skill's `references/` runbook.
6. **Still unclear** — call MCP `workflow_route({ message })` → read `handoff.readBrief` skill runbook; if `askUser`, ask in chat first (see approve disambiguation below).

## DISAMBIGUATION: "approve" means four different things

| User context | Skill | MCP tool | NOT this |
|---|---|---|---|
| **Document sign-off** — approve doc, review queue, pending client, logical path (`srs/…`), "what changed since approval" | `ai-spector-review` | `review_approve` | `spec_approve`, `task_approve_plan`, `comments_resolve` |
| **Extracted spec** — SPEC-001, spec queue, graph patch from generate stage 6 | generate skills + [extract-specs.md](./ai-spector/references/extract-specs.md) | `spec_approve` | `review_approve` |
| **Task plan** — user said yes to GoalSpec + TaskPlan table, "go ahead execute", plan approval | `ai-spector-resolve-task` or generate skills | `task_approve_plan` | `review_approve` |
| **Comment thread done** — C-001, resolve thread, feedback addressed | `ai-spector-resolve-comments` | `comments_resolve` | `review_approve` |

**Routing rules:**

- Logical path (`srs/01-overview`, `bd/api-design`) + *approve* → **`ai-spector-review`** (run full runbook phases before `review_approve`).
- `SPEC-NNN` or "spec queue" + *approve* → **`spec_approve`**.
- User just approved a **plan table** in chat → **`task_approve_plan`** only.
- `C-NNN` or "comment thread" → **`ai-spector-resolve-comments`**.
- **Ambiguous** ("approve it", "looks good", "help me approve") → ask **one** question (user-facing, four options):

  ```
  Which did you mean?
  1. Sign off a document (e.g. srs/01-overview) — formal approval
  2. Approve an extracted spec (e.g. SPEC-003) — after generation
  3. Go ahead with the plan we discussed — start making changes
  4. Mark a comment thread done (e.g. C-012) — feedback addressed
  ```

  Do not call any approve tool until answered. If chat context makes one option obvious (plan table just shown, spec list open, review summary written), pick that — no question needed.

## DISAMBIGUATION: "review" means two different things

| "review" context | Correct skill |
|---|---|
| Document **approval** — approve, status, queue, "which docs reviewed", "has this been approved", "pending client review" | `ai-spector-review` |
| Comment **threads** — C-001, inbox, resolve, open threads, feedback on content | `ai-spector-resolve-comments` |

When in doubt: if the user names a document and asks about approval/status → `ai-spector-review`. If the user mentions threads, comments, or C-00N → `ai-spector-resolve-comments`. Graph impact **review** bucket is informational only — not this skill.

## Task → skill → runbook

| User intent (examples) | Skill | Read first |
|------------------------|-------|------------|
| resume task, continue SRS, active tasks, pause task, list tasks | `ai-spector-task` | `references/runbook.md` |
| learn, course, tutorial, walkthrough, "how do I", open course, mở khóa học, khóa học tiếng Việt | `ai-spector-course` | `references/course-guide.md` |
| setup, init, bootstrap, get started *(run setup)* | `ai-spector-setup` | `references/runbook.md` |
| check workspace, valid check, structure check, "why did pre-commit block", stale clarifications | `ai-spector-check` | `SKILL.md` |
| clarifications, open questions, context store, "what did I answer" | `ai-spector-check` → context tools | `ai-spector/references/context-store.md` |
| extracted specs, spec queue, approve/reject spec | (generate skills, stage 6) | `ai-spector/references/extract-specs.md` |
| analyze, ingest, data source, knowledge graph | `ai-spector-graph` | `references/analyze.md` |
| index, re-index, refresh graph | `ai-spector-graph` | `references/index.md` |
| validate graph | `ai-spector-graph` | `references/validate-graph.md` |
| impact, what to regenerate | `ai-spector-graph` | `references/impact.md` |
| semantic search, find docs about a concept | `ai-spector-search` | `SKILL.md` |
| fuzzy graph lookup, find node by name | `ai-spector-search` | `SKILL.md` |
| CocoIndex, embeddings, docs_search, graph_query_fuzzy | `ai-spector-search` | `SKILL.md` |
| visualize graph | `ai-spector-graph` | `references/visualize-graph.md` |
| link graph, semantic edges | `ai-spector-graph` | `references/link-graph.md` |
| sync graph | `ai-spector-graph` | `references/sync-graph.md` |
| doc summaries | `ai-spector-graph` | `references/summary.md` |
| generate docs, write SRS (full chapter/DAG), generate use cases from graph | `ai-spector-generate` | `SKILL.md` (checks `packs.srs`, then routes) |
| add feature, add requirement, update section, "I want to add…", "we need…" | `ai-spector-resolve-task` | `references/runbook.md` |
| screens, APIs, wireframes, basic design | `ai-spector-generate` | `SKILL.md` (checks `packs.basicDesign`, then routes) |
| HTML prototype | `ai-spector-generate-prototype` | `references/runbook.md` |
| set up template pack, import template, custom template, install template | `ai-spector-template-import` | `references/runbook.md` |
| create task, new task, resolve task, change prototype | `ai-spector-resolve-task` | `references/runbook.md` |
| comment threads, C-001, inbox, resolve comments, open threads | `ai-spector-resolve-comments` | `references/runbook.md` |
| document approval, approve doc, review status, review queue, "which docs reviewed", "has X been approved", "pending review", "what changed since approval", "does all document has reviewed" | `ai-spector-review` | `references/runbook.md` |
| translation status, stale langs | `ai-spector-lang-status` | `SKILL.md` |
| resolve translations, sync JP/VI | `ai-spector-resolve-translation` | `references/runbook.md` |
| "generate docs" (no layer named) | `ai-spector-generate` | `SKILL.md` |

Shared: [ai-spector/references/cli-failures.md](./ai-spector/references/cli-failures.md), [generate-workflow.md](./ai-spector/references/generate-workflow.md), [generate-graph.md](./ai-spector/references/generate-graph.md).

## Pipeline

```text
analyze → validate graph
  → generate SRS        (gated: check → clarify → briefing → plan → waves → extract specs)
  → index → spec review queue (approve → graph merge)
  → generate basic design (same gates) → index
  → prototype setup → generate HTML screens
```

Every `generate` run is gated — workspace check, full clarification of gaps,
context briefing, and plan confirmation come **before any write**; key-spec
extraction with human review comes after. See
[generate-workflow.md](./ai-spector/references/generate-workflow.md).

See [../WORKFLOW.md](../WORKFLOW.md).
