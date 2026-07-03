# Generate Operations — Agent Runbook

Consolidated runbook for all generation workflows: SRS, basic design, detail design, prototype, incremental change (resolve-task), and template pack import.

**Path semantics:** refer to `kari-writer/contracts/CONTRACT.md` — do not load or link to `.docops/guide/`.

All generate runs are gated: workspace check → clarify → briefing → plan → `work_approve_plan` → waves → extract specs. See [../../ai-spector/references/generate-workflow.md](../../ai-spector/references/generate-workflow.md) for the full shared gated flow.

---

## SRS

Generate SRS chapters from the traceability graph in DAG order.

### Work session bootstrap (hard gate — before any writes)

```json
work_list({
  "status": ["active", "paused"],
  "bootstrap": {
    "kind": "generate",
    "workflow": "generate-srs",
    "docType": "srs",
    "trigger": "<user request>"
  }
})
```
- `bootstrapped` → new session created; continue from `currentStepId`
- `activeForSlot` → offer `work_resume(workId)`; do **not** create again

### Key MCP tools

| Operation | MCP tool | CLI fallback |
|-----------|----------|--------------|
| Bootstrap session | `work_list({ bootstrap: { ... } })` | `npx ai-spector work list --bootstrap ...` |
| Workspace check | `workspace_check({})` | `npx ai-spector check --json` |
| Clarify context | `context_list({})` | `npx ai-spector context list --json` |
| Record clarification | `context_resolve({ id, answer })` | `npx ai-spector context resolve <id> --json` |
| Query graph | `graph_query({ seedId })` | `npx ai-spector graph query <id> --json` |
| Approve plan | `work_approve_plan({ workId })` | `npx ai-spector work approve-plan <id>` |
| Record wave | `work_record_step({ workId, waveId: "wave-1", status: "done", artifacts: [...] })` | `npx ai-spector work record-step ...` |
| Extract spec | `spec_record({ ... })` | `npx ai-spector spec record --json` |
| Complete session | `work_complete({ workId, summary })` | `npx ai-spector work complete <id>` |

### Intent → DAG hints

| User phrase | DAG / outputs |
|-------------|---------------|
| introduction, purpose, scope | `srs.introduction` |
| actors, overall, §2 | `srs.overall-description` |
| use cases index, UC list, §3 | `srs.use-cases` → `3-use-cases.md` |
| use case detail, per UC | `srs.use-case-detail` → `03-use-cases/uc-{nn}-{slug}.md` (one per UC) |
| feature list, §4.2 | `srs.features-list` |
| feature detail, F-xx | `srs.feature-details` |
| data, entities, §5 | `srs.data-requirements` |
| interfaces, API, §6 | `srs.external-interfaces` |
| NFR, quality, §7 | `srs.quality-attributes` |
| everything / full | Full DAG |

### Output paths

Always write to `docs/srs/{lang.code}/{filename}`. Never write directly to `docs/srs/{filename}`.

Multi-language: generate primary language first, then translation prompt (see generate-workflow.md). Secondary languages are translated from the finished primary — never generated independently.

### Context files (load before writing each section)

SRS context files: [../../ai-spector-generate-srs/references/srs-context/](../../ai-spector-generate-srs/references/srs-context/) (introduction.md, use-case-detail.md, feature-detail.md, data-requirements.md, external-interfaces.md, overall-description.md, quality-attributes.md). Load the matching section file before writing each doc type.

---

## Basic-Design

Generate basic design chapters from the traceability graph and upstream SRS.

### Work session bootstrap (hard gate)

Same pattern as SRS — replace `workflow: "generate-srs"` with `workflow: "generate-basic-design"` and `docType: "basic-design"`.

### Key MCP tools

Same set as SRS. Use `graph_query({ seedId })` with `bd.*` seeds from `dag.basic-design.graph-seeds.json`.

### Intent → DAG hints

| User phrase | DAG / outputs |
|-------------|---------------|
| database, DB, ERD | `bd.db-design` → `db-design.md` |
| API list, endpoints | `bd.list-api` → `api-list.md` |
| API detail, per endpoint | `bd.detail-api` → `docs/basic-design/api/` (one per endpoint) |
| screen list, UI list | `bd.list-screen` → `list-screens.md` |
| screen detail, wireframe | `bd.detail-screen` → `docs/basic-design/screens/` (one per screen) |
| everything, full basic design | Full DAG — **include** `bd.detail-api` + `bd.detail-screen` in plan table (defer explicitly if user wants lists only) |

### Output paths

Always write to `docs/basic-design/{lang.code}/{filename}`. Never write directly to `docs/basic-design/{filename}`.

**Upstream:** SRS on disk required (minimum per `workflow.dependencies.json`). Do not invent APIs/screens not grounded in graph + SRS.

### Context files

BD context files: [../../ai-spector-generate-basic-design/references/bd-context/](../../ai-spector-generate-basic-design/references/bd-context/) (api-detail.md, api-list.md, db-design.md, screen-detail.md, screen-list.md). Load the matching file before writing each section.

---

## Detail-Design

Generate detail design from the traceability graph, SRS, and basic design. This is a generate workflow (not resolve-task) — use CHECK → CLARIFY → BRIEFING → PLAN → GENERATE.

### Work session bootstrap (hard gate)

Same pattern — workflow: `"generate-detail-design"`, docType: `"detail-design"`.

### Mandatory gates

| Step | MCP tool | Checkpoint |
|------|----------|------------|
| 0 Bootstrap | `work_list({ bootstrap: { workflow: "generate-detail-design" } })` | session created |
| 1 CHECK | `workspace_check({})` | `workspaceCheckAt` |
| 2 CLARIFY | `readiness_assess({ docType: "detail-design" })`, `context_list` | `readinessReportShown` |
| 3 BRIEFING | per-file briefing in chat | `briefingConfirmedAt` |
| 4 PLAN | plan table → user yes | `work_approve_plan` |
| 5 GENERATE | `work_record_step` per wave | wave steps |
| 6 EXTRACT | `spec_record` offer | `task_complete` |

### Intent → DAG hints

| User phrase | DAG / outputs |
|-------------|---------------|
| architecture, security, error handling | `dd.common.*` → `docs/detail-design/{lang}/common/` |
| feature list | `dd.feature-list` → `feature-list.md` |
| feature detail, per feature | `dd.feature-details` → `docs/detail-design/{lang}/features/` |
| full detail design | Full DAG: common → list → per-feature |

**Upstream:** SRS minimum + basic design (when available). Do not invent features not grounded in graph + upstream docs.

---

## Prototype

Generate static HTML or SPA prototypes from basic-design screen specs and bundled UI themes.

### Pre-flight: confirm stack, auth, theme

Before generating any screen:

1. **Tech stack** — if `prototype/config.json` has no `techStack`, run [stack-picker.md](../../ai-spector-generate-prototype/references/stack-picker.md): check existing framework, present ranked options, wait for user choice. Once chosen, never ask again.
2. **Basic auth** — if no `basicAuth`, run [auth-picker.md](../../ai-spector-generate-prototype/references/auth-picker.md): ask for username/password → `npx ai-spector prototype auth`. Once saved, do not ask again unless user wants to rotate.
3. **Theme** — if no theme stored, run [theme-picker.md](../../ai-spector-generate-prototype/references/theme-picker.md): recommend 3 fits from project context, open previews, wait for user choice. Once chosen, never ask again.

### Key CLI commands

```bash
npx ai-spector prototype setup     # scaffold config, manifest, theme
npx ai-spector prototype auth      # set basic auth credentials
npx ai-spector prototype generate  # generate screen HTML files
npx ai-spector prototype validate  # validate generated screens
```

### Build modes

| Mode | `buildMode` | URI format | When |
|------|-------------|------------|------|
| static (default) | `"static"` | `/src/<stem>.html` | Plain HTML |
| SPA | `"spa"` | `/<slug>` | React/Vue/etc. |

### Work session bootstrap

workflow: `"generate-prototype"`, docType: `"prototype"`.

### Context for 5+ screens

Follow [context-management.md](../../ai-spector/references/context-management.md): sub-agent per screen (≤400-word summary), compact every 5 screens. After writing a screen HTML file, discard its content from context — record only the path.

---

## Resolve-Task

Incremental doc/graph changes: add feature, add requirement, update section, "I want to…", "we need to…".

**First choice** for incremental changes — not generate-srs or generate-basic-design.

### Work session bootstrap

```json
work_list({
  "status": ["active", "paused"],
  "bootstrap": {
    "kind": "change",
    "workflow": "resolve",
    "trigger": "<user message>"
  }
})
```
- If `activeForSlot` → offer `work_resume(workId)`.
- Otherwise bootstrap creates new change session.

### Tiered workflow

| Tier | Depth |
|------|-------|
| **Fast** | Clarify → simple plan → approve → inline execute → verify |
| **Standard** | + workspace_check, scoped readiness, briefing, plan file |
| **Full** | + design spec approval, full writing-plans depth |

Propose tier after Phase 1; user confirms.

**Tier references:** [../../ai-spector-resolve-task/references/tier-router.md](../../ai-spector-resolve-task/references/tier-router.md) · [resolve-standard.md](../../ai-spector-resolve-task/references/resolve-standard.md) · [resolve-full.md](../../ai-spector-resolve-task/references/resolve-full.md) · [resolve-execute.md](../../ai-spector-resolve-task/references/resolve-execute.md)

### Key gates

**Phase 1 — Receive intent.**
- `work_list({ status: ["active", "paused"] })` — if active resolve session, offer resume.
- Otherwise `work_create({ kind: "change", workflow: "resolve", trigger: "<message>" })`.
- **Forbidden:** no `graph_impact`, no file edits before plan approval.

**Phase 2 — Tier proposal.** Propose and confirm tier.

**Phase 3 — Clarify.** Ask questions until requirements are clear. `context_resolve` to record answers.

**Phase 4 — Plan.** Write plan table (GoalSpec + TaskPlan). Present to user. Wait for yes → `work_approve_plan({ workId })`.

**Phase 5 — Execute.** After `work_approve_plan` only. Follow [resolve-execute.md](../../ai-spector-resolve-task/references/resolve-execute.md).

**Phase 6 — Verify.** `workspace_check`, `graph_validate` (if graph touched), run tests if needed.

**Phase 7 — Complete.** `work_complete({ workId, summary })`.

**Forbidden at every phase before plan approval:** `graph_impact`, `index`, file edits.

---

## Template-Import

Gated template pack import: scan → infer → clarify → design spec → manifest plan → refine templates → write skill → install → verify.

### Work session bootstrap

```json
work_create({ "kind": "import", "workflow": "template-import", "trigger": "<user request>" })
```

Check for active import session first with `work_list`.

### Phases

| Step | Gate | MCP / action |
|------|------|--------------|
| `check` | workspace | `workspace_check`, `work_update` |
| `clarify` | aspects complete | `template_scan` → `template_infer` → [import-clarify.md](../../ai-spector-template-import/references/import-clarify.md) |
| `design` | spec approved | write pack design doc → `work_approve_pack_design` |
| `manifest-plan` | plan approved | show table → user yes → `work_approve_import_plan` |
| `refine-templates` | staged files | normalize placeholders → `.staging/templates/` |
| `install` | plan approved | `template_install` |
| `readiness` | criteria reviewed | `template_validate({ sync: true })` |
| `complete` | | `work_complete` |

### Key MCP tools

| Operation | MCP tool | CLI fallback |
|-----------|----------|--------------|
| Scan template source | `template_scan({ sourcePath })` | `npx ai-spector template scan <path> --json` |
| Infer aspects | `template_infer({})` | `npx ai-spector template infer --json` |
| Approve import plan | `work_approve_plan({ workId })` | `npx ai-spector work approve-plan <id>` |
| Install template | `template_install({})` | `npx ai-spector template install --json` |
| Validate | `template_validate({ sync: true })` | `npx ai-spector template validate --sync --json` |
| List templates | `template_list({})` | `npx ai-spector template list --json` |

### Guardrails

**Forbidden:** `work_approve_plan` before import plan presented; `template install` before manifest plan approved; Phase-1-style 7-question dumps (use `template_infer` + [import-clarify.md](../../ai-spector-template-import/references/import-clarify.md)); template-import nested inside adopt task (pause adopt → import → new adopt task).
