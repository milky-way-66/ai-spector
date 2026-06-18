# Template Pack Import Runbook (gated)

Three-factor: **Human + AI + MCP/CLI**. Follow import **task steps** in order.

**MCP first, CLI when MCP fails** — see [import-aspects.md](./import-aspects.md). **Clarify rules** — [import-clarify.md](./import-clarify.md) (do not use legacy question lists).

| Step | Gate | MCP / action |
|------|------|----------------|
| `check` | workspace | `workspace_check`, `task_update` |
| `clarify` | aspects complete | `template_scan` → `template_infer` → [import-clarify.md](./import-clarify.md) |
| `design` | spec approved | Write `docs/superpowers/specs/…-pack-design.md` → `task_approve_pack_design` |
| `manifest-briefing` | rows briefed | Per manifest row with user |
| `manifest-plan` | plan approved | Show table → user yes → `task_approve_import_plan` |
| `refine-templates` | staged files | Normalize placeholders → `.staging/templates/` |
| `skill-briefing` | user ack | Brief generate skill scope |
| `write-skill` | skill valid | `.staging/generate-skill.md` (gated-flow patterns) |
| `install` | plan approved | `template_install` (not `template install` without task) |
| `context-map` | TODOs resolved | User answers → `context_record` |
| `readiness` | criteria reviewed | `template_validate`, `template_setup_mark` |
| `verify` | ready | `template_validate({ sync: true })` |
| `complete` | | `task_complete` |

**Forbidden:** `task_approve_plan` (use `task_approve_import_plan`); `template install` before manifest plan approved; Phase-1-style 7-question dumps; `node -e "import … from '…/dist/core/operations/…'"` (use MCP or `npx ai-spector` only — if both fail, report blocker to user); inventing export names (`runTemplateInstall` — use `template install` or SDK `installTemplateFromStaging`).

---

## check

```bash
npx ai-spector template list
# MCP: template_list({})
```

`task_create({ kind: "import", workflow: "template-import", trigger: "…" })` if no active import task.

CLI: `npx ai-spector task create -k import -w template-import -t "…"`

`workspace_check` → `task_update` snapshot + mark `check` done.

---

## clarify

If no `scan-result.json`:

> Run `template_scan({ sourcePath: "…" })` then re-run import.

Otherwise: **`template_infer({})`** then follow [import-clarify.md](./import-clarify.md) exactly.

---

## design

Draft pack design spec (purpose, doc shape, perDomain, output tree, standards, graph seeds, relation to builtin packs).

User **yes** → `task_approve_pack_design({ designSpecPath })`.

CLI: `npx ai-spector task approve-pack-design <taskId> --design-spec <path>`

---

## manifest-briefing → manifest-plan

Draft `manifest.json` from scan + clarified aspects + design spec.

Show table:

| File | Document ID | Output / OutputPattern | Type |

User confirms rows → mark `manifest-briefing` done.

Present plan table → `snapshot.manifestPlanPresentedAt` → user **yes** → `task_approve_import_plan`.

CLI: `npx ai-spector task approve-import-plan <taskId>`

### Manifest drafting rules

- `packName` from clarified `pack-identity`
- `nodePrefix` = `"doc." + packName.replace(/-/g, ".")`
- `templatesDir` = `"templates"`
- Repeating: `outputPattern`, `perDomain` from `doc-shape` + `domain-vocabulary`
- Single: `output` from `output-routing`
- `purpose`, `standards[]`, `docType` from aspects

---

## refine-templates → write-skill

Read each source file; normalize placeholders to `{slug}`; write `.ai-spector/packs/.staging/templates/`.

Load [skill-outline.md](./skill-outline.md) → write `generate-skill.md` with gated-flow patterns.

---

## install

`template_install({})` — gated on active import task + approved manifest plan.

CLI: `npx ai-spector template install`

On success: [readiness-setup.md](./readiness-setup.md) post-install review.

---

## context-map → readiness → verify → complete

`template_validate({ pack, sync: true })` until `ready: true`.

Resolve gaps per [readiness-setup.md](./readiness-setup.md). `task_complete` when verify passes.

---

## Guardrails

- Never install before `task_approve_import_plan`
- On CLI/MCP failure → show full error; fall back to the matching CLI command from [import-aspects.md](./import-aspects.md); do not invent results
- Cancel → staging preserved; resume with `/template-import` or `task_resume`
