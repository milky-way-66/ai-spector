# Onboarding help — lifecycle + contract check

Agent-first help when the user asks **help**, **I'm stuck**, **where am I**, or **what's next** about project setup progress (not document generation or active work sessions).

**Path semantics:** refer to `kari-writer/contracts/CONTRACT.md` — do not load or link to `.docops/guide/`.

---

## Step 1 — Sync lifecycle

Reconcile `.docops/lifecycle.json` from filesystem probes before answering.

| Surface | Call |
|---------|------|
| MCP (preferred) | `lifecycle_sync({ dryRun?: false })` |
| CLI fallback | `npx ai-spector lifecycle sync --json` |

Parse the JSON response:

| Field | Use |
|-------|-----|
| `lifecycle.present` | `false` → treat as legacy/migrate; still run Step 2 |
| `lifecycle.intent` | `greenfield` or `migrate` — shapes which steps apply |
| `lifecycle.percentComplete` | Show progress to user |
| `lifecycle.nextStepId` | Primary driver for Step 3 |
| `lifecycle.steps[]` | Status icons, `blockedReason`, `helpRef` per step |

If sync fails, pause per [cli-failures.md](./cli-failures.md) — do not guess lifecycle state.

---

## Step 2 — Contract validation

Run structural workspace check to surface blockers that map to lifecycle steps.

| Surface | Call |
|---------|------|
| MCP (preferred) | `workspace_check({})` |
| CLI fallback | `npx ai-spector check --json` |

Show **errors** first (stop and offer fixes). Warnings are context only — do not block help output.

Optional when docops config exists:

| Surface | Call |
|---------|------|
| MCP | `docops_status({})` |
| CLI | `npx ai-spector docops status --json` |

---

## Step 3 — Map `nextStepId` to actions

Use `nextStepId` from Step 1. Cross-check Step 2 findings against the symptom table below.

### Symptom table (shared with Writer checklist)

| Symptom / check finding | Blocked step | Help action |
|-------------------------|--------------|-------------|
| No git remote / clone fails | `git-connected` | Connect Bitbucket repo in Writer → Project Settings → Git |
| Missing `.docops/docops.config.json` | `docops-init` | Writer Settings → Docops → Initialize, or `npx ai-spector docops init` |
| Skills not routing / agent ignores ai-spector | `local-adapter-ready` | Enable all `.claude/skills/ai-spector*` skills; reload MCP servers |
| Docs in wrong folder / legacy layout | `legacy-aligned` | Read adopt runbook → [runbook.md — Adopt](runbook.md#adopt); offer `npx ai-spector adopt scan --json` |
| Push done but Writer checklist stale | `first-push-synced` | Push branch; refresh Writer Project → Overview; check webhook/poll |
| MCP tools missing / server not listed | `local-adapter-ready` | Reload MCP: Cmd+Shift+P → "Reload MCP Servers"; verify `.mcp.json` |
| Empty `docs/data-source/` | `data-source-added` | Add project context files under `docs/data-source/` |
| No SRS / enabled layer content | `first-docs-generated` | Route to generate skill after setup complete, or adopt for migrate |
| Setup incomplete / missing engine | `local-adapter-ready` | [runbook.md — Setup](runbook.md#setup): `npx ai-spector setup --check --json` |

### Step ID → primary action

| `nextStepId` | Primary action |
|--------------|----------------|
| `project-created` | User started on Writer — confirm project exists; continue web wizard |
| `git-connected` | Link git remote in Writer or verify `git remote -v` locally |
| `docops-init` | `npx ai-spector docops init` or Writer Docops initialize |
| `legacy-aligned` | Gated adopt: [runbook.md — Adopt](runbook.md#adopt) |
| `local-adapter-ready` | `npx ai-spector setup -y` or enable skills + MCP reload |
| `data-source-added` | Add files to `docs/data-source/` |
| `first-docs-generated` | Hand off to `ai-spector-generate` (SRS) or adopt path for migrate |
| `first-push-synced` | `git push`; open Writer dashboard to confirm sync |
| `null` (all done) | Summarize completed steps; offer course or next workflow (analyze → generate) |

When a step has `status: blocked`, quote `blockedReason` and offer the matching row from the symptom table.

---

## Step 4 — Open course or guide from `helpRef`

For the current `nextStepId` step (or any `in_progress` step), read `helpRef` from lifecycle JSON.

| `helpRef` prefix | Action |
|------------------|--------|
| `course/` | Strip `course/` prefix → slug (e.g. `en/02-get-started/01-setup-via-chat`). Run `npx ai-spector course open <slug>`. If that command is unavailable, run `npx ai-spector course serve --open` and open `http://127.0.0.1:4177/course/<slug>`. |
| `guide/` | Point user to `.docops/<path>` in repo; summarize next action from adopt/docops runbooks — do not paste full guide content |
| Handbook id (e.g. `PROC-AS-*`) | Direct user to Writer handbook in browser |

Default help refs when `helpRef` is missing (from contract):

| Step | Default `helpRef` |
|------|-------------------|
| `docops-init` | `guide/modules/generate.md` |
| `local-adapter-ready` | `course/en/02-get-started/01-setup-via-chat` |
| `legacy-aligned` | `guide/MIGRATION.md` |
| `data-source-added` | `course/en/03-chat-basics/01-how-chat-works` |

---

## Response format

Reply in this order:

1. **Where you are** — intent, percent complete, current/next step id + status
2. **What's blocking** — errors from check; `blockedReason` if any
3. **What's next** — one concrete action (command or Writer UI path)
4. **Learn more** — course open or runbook link when `helpRef` applies
5. **Writer handoff** — when local work is done: push branch, refresh Writer Project → Overview checklist

---

## Disambiguation

| User says | Route |
|-----------|-------|
| "what's next" + active work session (`work_list` non-empty) | Ask: setup progress vs continue active work — or run Step 1 first; if lifecycle incomplete, prefer this runbook |
| "help me approve" | Not this runbook → `_skill-router.md` approve disambiguation |
| "help" + generate/SRS context | `ai-spector-generate` after summarizing lifecycle if setup is complete |
