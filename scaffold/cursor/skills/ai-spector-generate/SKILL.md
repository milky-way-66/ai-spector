---
name: ai-spector-generate
description: >-
  AI Spector document generation — SRS, basic design, detail design from traceability graph.
  Use for /generate-srs, /generate-basic-design, /generate-detail-design, or when user asks to
  generate, write, or update requirements specs, SRS chapters, basic design, detail design, or docs under docs/srs docs/basic-design.
---

# AI Spector — Generate

**Core rules:** `.cursor/skills/ai-spector/SKILL.md`
**Graph context:** `.cursor/commands/_generate-graph.md`, `_graph.md`

## Route to command doc

| Trigger | Read first | Notes |
|---------|------------|-------|
| `/generate-srs`, SRS, requirements spec | `commands/generate-srs.md` | DAG waves, `graph query`, templates in `.ai-spector/templates/srs/` |
| `/generate-basic-design`, screens, APIs, DB design | `commands/generate-basic-design.md` | `templates/basic_design/` |
| `/generate-detail-design` | `commands/generate-detail-design.md` | `templates/detail_design/` |

## Before generating

1. **`ai-spector graph validate`** should pass (or run `/validate-graph` first).
2. **Read the template** from `.ai-spector/templates/` — never guess structure.
3. After each wave: **`graph merge`** projection patch with `rendersTo` + `dependsOn`.
4. After SRS generation: recommend **`/index`**.

## Natural language → command

| User says | Action |
|-----------|--------|
| "generate SRS", "write requirements", "create use case docs" | `generate-srs.md` |
| "basic design", "screen list", "API design doc" | `generate-basic-design.md` |
| "detail design", "feature detail doc" | `generate-detail-design.md` |

Confirm scope when user describes generation in natural language (not explicit paths).

## Generate discipline

Accuracy over speed — batch only same-wave independent targets; merge + validate after each wave.
