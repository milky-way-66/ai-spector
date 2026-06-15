# AI Spector skills

Enable **every** folder under `.cursor/skills/` in Cursor (Settings → Rules → Agent Skills).

**Orchestrator** routes and spawns **subagent workers** from [../agents/README.md](../agents/README.md). **You do not need slash commands** for most work — describe what you want; orchestrator delegates to the right worker.

**Pipeline overview:** [../WORKFLOW.md](../WORKFLOW.md)  
**Disambiguation:** [_skill-router.md](./_skill-router.md)  
**Subagent catalog:** [../agents/README.md](../agents/README.md)

## Quick pick

| You want to… | Skill / worker |
|--------------|----------------|
| **Learn / open course / tutorials** | `ai-spector-course` |
| **Setup / bootstrap project** | `setup-check` |
| Check workspace structure / stale clarifications | `setup-check` |
| Analyze, index, validate graph, impact, visualize | `graph-ops` |
| SRS / requirements | `generate-srs` — or **`/generate-srs`** |
| Screens, APIs, DB basic design | `generate-basic-design` |
| HTML prototype | `generate-prototype` |
| Review comments | `resolve-comments` — or **`/resolve-comments`** |
| **Document sign-off / review queue** | `doc-review` — or **`/review`** |
| Add/update feature or section (“I want to add…”) | `resolve-task` (plan-first) |
| Resume / active tasks | `task-router` |
| Approve SPEC-NNN | `spec-queue` |
| Translation status (read-only) | `ai-spector-lang-status` |
| Resolve / sync translations | `ai-spector-resolve-translation` |
| Unsure | orchestrator + `workflow_route` |

## Shared references (core skill)

| Doc | Path |
|-----|------|
| CLI failures (fix / workaround / pause) | `ai-spector/references/cli-failures.md` |
| Graph CLI | `ai-spector/references/graph.md` |
| Generation workflow (gated flow) | `ai-spector/references/generate-workflow.md` |
| Workspace check | `ai-spector/references/workspace-check.md` |
| Clarify + context store | `ai-spector/references/clarify.md`, `ai-spector/references/context-store.md` |
| Briefing + plan gate | `ai-spector/references/plan-and-briefing.md` |
| Spec extraction queue | `ai-spector/references/extract-specs.md` |
| Graph query / merge | `ai-spector/references/generate-graph.md` |
| Prerequisites | `ai-spector/references/prerequisites.md` |

## Per-skill runbooks

When a skill activates, read its `references/` runbook **before** running CLI or editing docs.

**CLI:** agents run **`npx ai-spector …`** (see [../rules/ai-spector-cli.mdc](../rules/ai-spector-cli.mdc)).
