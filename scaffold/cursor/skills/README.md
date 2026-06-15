# AI Spector skills

Enable **every** folder under `.cursor/skills/` in Cursor (Settings → Rules → Agent Skills).

**You do not need slash commands.** Describe what you want (“generate SRS”, “analyze data source”); Cursor matches the skill `description` and the agent reads that skill’s **runbook** under `references/`.

**Pipeline overview:** [../WORKFLOW.md](../WORKFLOW.md)  
**Disambiguation:** [_skill-router.md](./_skill-router.md)

## Quick pick

| You want to… | Skill |
|--------------|-------|
| **Setup / bootstrap project** | `ai-spector-setup` |
| Check workspace structure / stale clarifications | `ai-spector-check` |
| Analyze, index, validate graph, impact, visualize | `ai-spector-graph` |
| SRS / requirements | `ai-spector-generate-srs` |
| Screens, APIs, DB basic design | `ai-spector-generate-basic-design` |
| HTML prototype | `ai-spector-generate-prototype` |
| Review comments | `ai-spector-resolve-comments` |
| **Document sign-off / review queue** | `ai-spector-review` — or **`/review`** command |
| Add/update feature or section (“I want to add…”) | `ai-spector-resolve-task` (plan-first) |
| Translation status (read-only) | `ai-spector-lang-status` |
| Resolve / sync translations | `ai-spector-resolve-translation` |
| Unsure | `ai-spector` (core) |

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
