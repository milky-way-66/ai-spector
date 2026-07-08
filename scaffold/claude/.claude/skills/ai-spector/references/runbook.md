# Core Operations — Agent Runbook

Consolidated runbook for: setup, upgrade, check, docops, course, and work sessions.

**Path semantics:** refer to `kari-writer/contracts/CONTRACT.md` — do not load or link to `.docops/guide/`.

---

## Setup

One-shot project setup: install dependency, scaffold, git hook, skills, and verify.

### Phase 0 — Audit

```bash
npx ai-spector setup --check --json
```

Parse `steps[]`: each has `id`, `label`, `status` (`ok` | `missing` | `warning`), optional `fix`. If `ready: true` and CocoIndex already configured, skip to user reminders only.

### Phase 1 — Install CLI dependency

When `package.json` exists and step `npm-dep` is not `ok`:

```bash
npm install -D ai-spector --registry http://10.101.0.239:4873
```

Then `npx ai-spector init` if scaffold is missing. If no `package.json`, tell user to run `npm init -y` first.

### Phase 2 — Ask: languages

Ask one question: "Which languages does this project need? (examples: en, en+jp, en+vi)" — then pass via `--languages en,jp` to init/setup.

### Phase 3 — Run setup wizard

```bash
npx ai-spector setup -y -l <codes>
```

Or interactively: `npx ai-spector setup` (prompts for languages, agent target, git hook, CocoIndex).

### Phase 4 — CocoIndex (optional)

If `step.id === "cocoindex"` shows `missing`, ask: "Do you want to set up CocoIndex for semantic search?" If yes:

```bash
npx ai-spector setup --cocoindex
```

### Phase 5 — Enable skills and MCP

Tell the user:
1. Open `.claude/skills/` and enable all `ai-spector*` skills (or update `.mcp.json` for Claude).
2. Reload MCP: Cmd+Shift+P → "Reload MCP Servers".
3. Add files under `docs/data-source/` to give the agent project context.

---

## Upgrade

Bump `ai-spector` package, refresh scaffold, backfill config, verify hooks and MCP.

**Related but different:** setup (greenfield init); migrate existing project (self-service docops section below).

### Phase 0 — Preflight

```bash
npx ai-spector setup --check --json
# MCP: workspace_check({})
```

Confirm `.docops/docops.config.json` exists (initialized project) and intent is package upgrade. If not initialized → route to **setup**.

### Phase 1 — Scan

```bash
npx ai-spector upgrade scan --json
# MCP: upgrade_scan({})
```

Summarize: `fromVersion` → `toVersion`, applicable checklist items (`UPG-*`), findings table (auto / agent / manual). If downgrade → **stop** (unsupported).

### Phase 2 — Human gate

Pause. Show the user the upgrade plan:
- Auto items (no user input needed)
- Agent items (you will handle)
- Manual items (user must do)

Ask: "Proceed with upgrade?"

### Phase 3 — Install

```bash
npm install -D ai-spector@latest --registry http://10.101.0.239:4873
```

Then: `npx ai-spector setup --check --json` to verify step `npm-dep`.

### Phase 4 — Sync scaffold

```bash
npx ai-spector sync-cursor   # Cursor scaffold
npx ai-spector sync-claude   # Claude scaffold (if both targets)
```

### Phase 5 — Config migration

```bash
npx ai-spector upgrade apply --json
# MCP: upgrade_apply({})
```

For each agent checklist item from scan: follow the UPG-* hint. On docops/engine gaps: run **`npx ai-spector docops guide --json`** and follow [docops-migrate.md](docops-migrate.md) (not bare `--from-docflow` when config already exists).

### Phase 6 — Verify

```bash
npx ai-spector setup --check --json
npx ai-spector graph validate --json
```

Report summary to user; note any remaining manual items.

### Phase 7 — Reload MCP

Remind user: Cmd+Shift+P → "Reload MCP Servers" after scaffold sync.

---

## Migrate existing project (self-service)

Bring filled-in docs into the Writer `.docops/` contract **without** moving markdown.

**Agent runbook (user says "migrate"):** [docops-migrate.md](docops-migrate.md) — start with `npx ai-spector docops guide --json`.

### Phase 0 — Guide (always first)

```bash
npx ai-spector docops guide --json
# alias: npx ai-spector docops migrate --guide --json
```

Shows **current** (on disk) vs **expected** (config, scaffold, doc paths, wrong→correct, example JSON). Agent executes `agentTasks` — user does not run steps manually.

### Phase 1 — Automated CLI

Run `cli.primaryCommand` from guide output (`init` | `migrate` | `migrate --from-docflow` | `migrate --repair`).

### Phase 2 — Agent gap-fill

If CLI incomplete: merge example config, copy scaffold from bundled ai-spector package (`bootstrapCopyMap`), never overwrite existing files.

See [docops-migrate.md](docops-migrate.md) for full checklist.

### Phase 3 — Verify

```bash
npx ai-spector docops check --json
npx ai-spector lifecycle sync --json
```

`writerReady: true` → done.

**Legacy detail:** `.docops/guide/MIGRATION.md` · `PROJECT_LAYOUT.md` · CLI failed → [cli-failures.md](cli-failures.md)

---

## Migrate existing project (manual reference)

<details>
<summary>Manual steps (agent should prefer docops-migrate runbook above)</summary>

**Read first:** `.docops/guide/MIGRATION.md` and `.docops/guide/guides/PROJECT_LAYOUT.md`

**Hard rule:** Prefer editing `docTypes.*.path` in `.docops/docops.config.json` to point at folders that already hold your markdown.

### Assess

```bash
npx ai-spector docops status --json
npx ai-spector docops layout --prompt
npx ai-spector docops check --prompt
```

### Configure paths

Edit `.docops/docops.config.json` — `docTypes.*.path`, `languages`, templates under `.docops/templates/`.

### Repair

```bash
npx ai-spector docops migrate --repair --json
npx ai-spector index
npx ai-spector docops registry sync
```

</details>

---

## Check

Workspace structure/config validation and clarification context management.

### Workspace check

```bash
npx ai-spector check [--fix] [--json]
# MCP: workspace_check({ fix?: boolean })
```

1. Run without `fix` — show findings table (rule, severity, message, fix hint).
2. AutoFixable findings → offer to re-run with `fix: true`.
3. Remaining errors → guide user through each `fix` hint.

**Full check reference:** [workspace-check.md](workspace-check.md).

### Clarification context (context store)

When user asks about "open questions", "stale clarifications", "what did I answer about auth":

```
context_list({})                                       # all open contexts
context_list({ status: "open", phase: "clarify" })    # filter by phase
context_resolve({ id: "CTX-001", answer: "..." })      # record answer
```

Full reference: [context-store.md](context-store.md).

---

## Docops

Bootstrap or migrate the Writer `.docops/` contract. No Writer API — CLI only.

**Related:** `kari-writer/contracts/CONTRACT.md` for path semantics.

### Phase 0 — Assess

```bash
npx ai-spector docops status --json
```

Parse `DocopsAssessment`:

| Field | Meaning |
|-------|---------|
| `layout` | `none` · `legacy` · `docops` · `mixed` |
| `writerReady` | `true` when config, capability files, and template dirs complete |
| `gaps[]` | `id`, `severity` (`blocking` \| `warning`), `message`, `fix` |
| `recommendedAction` | `init` · `migrate` · `repair` · `ok` |

### Phase 1 — Init (none → docops)

```bash
npx ai-spector docops init --json
```

Creates `.docops/docops.config.json` + capability stubs.

`docTypes.<layer>.path` must be repo-root-relative folders under `docs/` (e.g. `docs/srs`, `docs/basic-design`) — not bare segment names like `srs` or `basic-design`. If an agent hand-wrote short paths, run `docops migrate --repair`.

### Phase 2 — Migrate (legacy → docops)

```bash
npx ai-spector docops migrate --json
# If migrating from docflow.config.json:
npx ai-spector docops migrate --from-docflow --json
```

Splits `docflow.config.json` into `.docops/docops.config.json` + `.ai-spector/engine.json`.

### Phase 3 — Repair

```bash
npx ai-spector docops migrate --repair --json
```

Fills missing capability files; patches config gaps (including short `docTypes.*.path` values, missing `detailDesign` / `otherDocument`, and empty `.docops/templates/detail-design/`).

### Phase 3b — Manual fallback (CLI failed)

When init/migrate/repair exits non-zero or bootstrap bundle is missing — **after user approves workaround** per [cli-failures.md](cli-failures.md):

1. Run **`npx ai-spector docops guide --prompt`** — target `docTypes` paths + ordered tasks (do not move docs unless user approves).
2. Read **`.docops/guide/guides/DOCOPS_MANUAL_FALLBACK.md`** for scaffold/template gap-fill (never overwrite existing files).
3. Verify with `npx ai-spector docops status --json` when CLI works again.

### Lifecycle sync

```bash
npx ai-spector lifecycle sync --json
```

Reconciles `.docops/lifecycle.json` from filesystem probes:

| Step | Probe |
|------|--------|
| `docops-init` | `docops status` → `writerReady` (not just config file exists) |
| `local-adapter-ready` | `npx ai-spector setup --check` ready, or engine/docflow present |
| `first-push-synced` | `lifecycle.json` on disk + git upstream with no unpushed commits |

After push, run `lifecycle sync` again so Writer checklist updates on refresh.

### Phase 4 — Verify

```bash
npx ai-spector docops status --json
```

`writerReady: true` and no blocking gaps → done.

---

## Course

Guide users through the AI Spector interactive course.

### Open

```bash
npx ai-spector course serve --open
```

- Home (EN): `http://127.0.0.1:4177/course/en/index`
- Home (VI): `http://127.0.0.1:4177/course/vi/index`
- Lesson: `http://127.0.0.1:4177/course/{locale}/<slug>`

Use VI locale when user writes in Vietnamese.

### Intent → lesson map

| User asks about | Lesson slug |
|-----------------|-------------|
| Where to start, what is this | `01-welcome/01-what-is-ai-spector` |
| Install, setup, init | `02-get-started/01-setup-via-chat` |
| How chat works | `03-chat-basics/01-how-chat-works` |
| Approve confusion | `03-chat-basics/02-four-kinds-of-approve` |
| Add one feature | `04-changes/01-add-or-change-requirement` |
| Generate SRS | `05-generate/01-generate-srs` |
| Document sign-off | `06-review/01-document-review` |
| Comment threads | `06-review/02-resolve-comments` |

After opening the lesson, ask: "Which part would you like to try in this project?" and route to the matching skill.

---

## Work Sessions

Resume, pause, list, or route active work sessions (`kind: generate`, `change`, `migrate`).

Work sessions replace the former `task_*` concept — use `work_*` MCP tools.

### Resume / active work

When user says "resume", "continue", "active work", "pause", "pick up":

```
work_list({ status: ["active", "paused"] })
```

Present sessions table. If one active session, ask: "Continue [kind]: [trigger]?"

```
work_resume({ workId })
work_get({ workId })
```

Route by `kind`:
- `generate` / `change` → `ai-spector-generate`
- `migrate` → stay in this skill (Docops / Migrate existing project)

### Lifecycle MCP tools

| Tool | Purpose |
|------|---------|
| `work_create({ kind, workflow, docType?, trigger })` | Create new session |
| `work_list({ status })` | List by status |
| `work_get({ workId })` | Load session state |
| `work_update({ workId, patch })` | Patch metadata / phase |
| `work_approve_plan({ workId })` | Gate before execution |
| `work_record_step({ workId, stepId, status, artifacts? })` | Record wave or step |
| `work_pause({ workId })` | Pause session |
| `work_resume({ workId })` | Resume session |
| `work_complete({ workId, summary })` | Mark complete |
| `work_abandon({ workId, reason })` | Abandon session |

CLI aliases (deprecated after one release): `task_*` → `work_*`.

### Incremental scope (same conversation)

When user asks for more chapters while a generate session is active, offer:
- A — extend plan: `work_update(plan)` with new rows/waves → `work_approve_plan` → generate
- B — complete + new session
- C — pause current session

Read [incremental-continuation.md](incremental-continuation.md) for details.
