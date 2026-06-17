# Graph (analyze / index / validate)

**Workflow trigger:** activate **`ai-spector-graph`**.

Read `.claude/skills/ai-spector-graph/skill.md` and `references/graph-commands.md`.

## Typical flow

1. **`index({})`** — detect data source, analyze if needed, build doc index
2. **`graph_validate({})`** — report errors
3. After doc edits: **`index({ cocoindexSync: true })`** when CocoIndex is configured

For impact: **`graph_impact({ git: true, change: "…" })`**.

Visualize (CLI only): `npx ai-spector graph visualize --open`

Before opening SRS/BD/DD docs for generation, load graph neighbors from task seed — see workflow dependencies config.
