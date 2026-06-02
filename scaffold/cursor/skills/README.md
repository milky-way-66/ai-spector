# AI Spector skills

Enable **every** folder under `.cursor/skills/` in Cursor (Settings → Rules → Agent Skills).

**You do not need slash commands.** Describe what you want (“generate SRS”, “analyze data source”); Cursor matches the skill `description` and the agent reads that skill’s **runbook** under `references/`.

**Pipeline overview:** [../WORKFLOW.md](../WORKFLOW.md)  
**Disambiguation:** [_skill-router.md](./_skill-router.md)

## Quick pick

| You want to… | Skill |
|--------------|-------|
| Analyze, index, validate graph, impact, visualize | `ai-spector-graph` |
| SRS / requirements | `ai-spector-generate-srs` |
| Screens, APIs, DB basic design | `ai-spector-generate-basic-design` |
| Detail / implementation design | `ai-spector-generate-detail-design` |
| HTML prototype | `ai-spector-generate-prototype` |
| Review comments | `ai-spector-resolve-comments` |
| Unsure | `ai-spector` (core) |

## Shared references (core skill)

| Doc | Path |
|-----|------|
| CLI failures (fix / workaround / pause) | `ai-spector/references/cli-failures.md` |
| Graph CLI | `ai-spector/references/graph.md` |
| Generation workflow | `ai-spector/references/generate-workflow.md` |
| Graph query / merge | `ai-spector/references/generate-graph.md` |
| Prerequisites | `ai-spector/references/prerequisites.md` |

## Per-skill runbooks

When a skill activates, read its `references/` runbook **before** running CLI or editing docs.
