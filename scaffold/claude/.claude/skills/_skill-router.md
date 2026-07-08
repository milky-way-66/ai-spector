# AI Spector skill router

Agents use this when intent is ambiguous. Read the matching skill's runbook before acting.

## Priority

1. **Document sign-off** — *approve doc*, *sign off*, *review queue*, *pending client*, *what changed since approval*, logical path + approve (`srs/01-overview`) → **`ai-spector-contract`** (Review section). Not resolve-task, generate, or comments unless user explicitly switches topic.

2. **Onboarding help** — *help* (setup), *I'm stuck*, *where am I*, *what's next* (project setup progress) → **`ai-spector`** ([help.md](./ai-spector/references/help.md)). Not generate, resolve-task, or work resume unless lifecycle is complete.

3. **Resume / active work** — *resume*, *continue*, *pick up*, *active tasks*, *in progress* → **`ai-spector`** (`work_list` → `work_resume`). Skip if message is clearly document sign-off (priority 1) or onboarding help (priority 2).

4. **Upgrade ai-spector** — *upgrade ai-spector*, *update ai-spector*, *sync after update*, *stale scaffold*, *continue upgrade* → **`ai-spector`** (Upgrade section). Not greenfield setup, not doc migration.

5. **Migrate docops / Writer contract** — *migrate*, *migrate to docops*, *migrate writer*, *migrate legacy*, *docops migrate*, *Writer contract*, *fix docops* → **`ai-spector`** → [docops-migrate.md](./ai-spector/references/docops-migrate.md). Not package upgrade alone, not SRS folder adopt.

6. **Adopt / wrong doc folder** — *adopt project*, *wrong SRS folder*, *move docs to structure* → **`ai-spector`** (Adopt section). Not docops contract migrate.

7. **Incremental change (plan-first)** — verbs *add*, *update*, *change*, *modify*, *extend*, or phrases *"I want to"*, *"we need to"*, *create task* → **`ai-spector-generate`** (Resolve-Task section). Not full generate (priority 8).

8. **Full generation** — *generate*, *write chapter*, *DAG wave*, *from graph*, *generate SRS/basic design/detail design/prototype* → **`ai-spector-generate`** (matching layer section).

9. **Graph / search / impact** — *analyze*, *index*, *validate*, *impact*, *visualize*, *sync audit*, *check doc drift*, *find docs about*, *semantic search* → **`ai-spector-graph`** (matching runbook section).

10. **Comments / translation** — *resolve comments*, *C-001*, *B-001*, *prototype comments*, *resolve translations*, *stale languages*, *translation status* → **`ai-spector-contract`** (Comments or Translation section).

11. **Fallback** — call `workflow_route({ message })` MCP tool; if `askUser`, ask one clarifying question.

## DISAMBIGUATION: "approve" means four different things

| User context | Skill section | MCP tool | NOT this |
|---|---|---|---|
| **Document sign-off** — approve doc, review queue, pending client, logical path (`srs/…`) | `ai-spector-contract` → Review | `contract_review` (`action: "approve"`) | `spec_approve`, `work_approve_plan`, `contract_comments` |
| **Extracted spec** — SPEC-001, spec queue | generate skills, stage 6 | `spec_approve` | `contract_review` |
| **Work plan** — user said yes to plan table, "go ahead execute" | `ai-spector` or generate skills | `work_approve_plan` | `contract_review` |
| **Comment thread done** — C-001, resolve thread | `ai-spector-contract` → Comments | `contract_comments` (`action: "resolve"`) | `contract_review` |
| **Prototype comment batch** — B-001 | `ai-spector-contract` → Prototype-Comments | `contract_comments` (`action: "batch_resolve"`) | `contract_review` |

**Routing rules:**
- Logical path (`srs/01-overview`, `bd/api-design`) + *approve* → **`ai-spector-contract`** (Review section).
- `SPEC-NNN` or "spec queue" + *approve* → **`spec_approve`** via generate skills stage 6.
- User just approved a **plan table** in chat → **`work_approve_plan`** only.
- `C-NNN` or "comment thread" on **documents** → **`ai-spector-contract`** (Comments section).
- `B-NNN`, "prototype comments" → **`ai-spector-contract`** (Prototype-Comments section).
- **Ambiguous** ("approve it", "looks good", "help me approve") → ask **one** question (four options):

  ```
  Which did you mean?
  1. Sign off a document (e.g. srs/01-overview) — formal approval
  2. Approve an extracted spec (e.g. SPEC-003) — after generation
  3. Go ahead with the plan we discussed — start making changes
  4. Mark a comment thread done (e.g. C-012) — feedback addressed
  ```

## DISAMBIGUATION: "review" means two different things

| "review" context | Correct skill section |
|---|---|
| Document **approval** — approve, status, queue, "has this been approved", "pending client review" | `ai-spector-contract` → Review |
| Comment **threads** — C-001, inbox, resolve, open threads, feedback on content | `ai-spector-contract` → Comments |

## Intent → skill → runbook

| User intent (examples) | Skill | Read first |
|------------------------|-------|------------|
| help, I'm stuck, where am I, what's next (setup) | `ai-spector` | `references/help.md` |
| setup, init, bootstrap, get started | `ai-spector` | `references/runbook.md#setup` |
| upgrade ai-spector, sync after update | `ai-spector` | `references/runbook.md#upgrade` |
| migrate, migrate docops, migrate writer, fix docops | `ai-spector` | `references/docops-migrate.md` |
| migrate project, adopt existing docs, wrong SRS folder | `ai-spector` | `references/runbook.md#migrate-existing-project-self-service` |
| check workspace, "why did pre-commit block" | `ai-spector` | `references/runbook.md#check` |
| docops init/migrate, Writer contract | `ai-spector` | `references/docops-migrate.md` |
| learn, course, tutorial, open course | `ai-spector` | `references/runbook.md#course` |
| resume task, active tasks, pause, continue | `ai-spector` | `references/runbook.md#work-sessions` |
| add feature, update section, "I want to add…" | `ai-spector-generate` | `references/runbook.md#resolve-task` |
| set up template pack, import template | `ai-spector-generate` | `references/runbook.md#template-import` |
| generate SRS (full chapter / DAG) | `ai-spector-generate` | `references/runbook.md#srs` |
| generate basic design (full wave) | `ai-spector-generate` | `references/runbook.md#basic-design` |
| generate detail design | `ai-spector-generate` | `references/runbook.md#detail-design` |
| HTML prototype | `ai-spector-generate` | `references/runbook.md#prototype` |
| analyze, ingest, data source | `ai-spector-graph` | `references/analyze.md` |
| index, re-index, refresh graph | `ai-spector-graph` | `references/index.md` |
| validate graph | `ai-spector-graph` | `references/validate-graph.md` |
| impact, what to regenerate | `ai-spector-graph` | `references/impact.md` |
| sync audit, check doc drift, what changed since baseline | `ai-spector-graph` | `references/sync-audit.md` |
| semantic search, find docs about a concept | `ai-spector-graph` | `references/search.md` |
| fuzzy graph lookup, find node by name | `ai-spector-graph` | `references/search.md` |
| visualize graph | `ai-spector-graph` | `references/visualize-graph.md` |
| link graph, semantic edges | `ai-spector-graph` | `references/link-graph.md` |
| sync graph | `ai-spector-graph` | `references/sync-graph.md` |
| doc summaries | `ai-spector-graph` | `references/summary.md` |
| document approval, approve doc, review queue, "pending review" | `ai-spector-contract` | `references/runbook.md#review` |
| comment threads, C-001, inbox, resolve comments | `ai-spector-contract` | `references/runbook.md#comments` |
| prototype comments, B-001, resolve login screen | `ai-spector-contract` | `references/runbook.md#prototype-comments` |
| resolve translations, sync JP/VI | `ai-spector-contract` | `references/runbook.md#translation` |
| translation status, stale langs | `ai-spector-contract` | `references/runbook.md#lang-status` |

Shared: [ai-spector/references/cli-failures.md](./ai-spector/references/cli-failures.md), [ai-spector/references/generate-workflow.md](./ai-spector/references/generate-workflow.md).

See [WORKFLOW.md](../WORKFLOW.md).
