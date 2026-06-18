# Template pack import

**Workflow trigger:** activate **`ai-spector-template-import`**.

Read `.claude/skills/ai-spector-template-import/skill.md` and `references/runbook.md`.

## Gates (MCP-first)

1. `template_scan` → `task_create` (kind `import`, workflow `template-import`)
2. `template_infer` → smart clarify (aspect coverage + supplemental questions)
3. Pack design spec → user **yes** → `task_approve_pack_design`
4. Manifest briefing → manifest table → user **yes** → `task_approve_import_plan`
5. Refine staging templates + `generate-skill.md` → `template_install`
6. `template_validate` → context-map / readiness → `task_complete`

**Forbidden:** `task_approve_plan` for import manifest approval (use `task_approve_import_plan`); `template install` without import task unless `--legacy`.

**Status:** `template_list` — packs, staging artifacts, active import task, `suggestedNextTools`.
