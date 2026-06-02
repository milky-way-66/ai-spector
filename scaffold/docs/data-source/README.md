# Data source

Put **your** input files here (briefs, notes, exports, diagrams, legacy docs) before asking the agent to **analyze the data source**.

All files must be **Markdown (`.md`)** format. The agent reads them directly using structured AST parsing (remark) to extract entities into `knowledge.json`.

## What goes here

| File type | Example |
|-----------|---------|
| Requirements brief | `requirements.md` |
| User stories | `user-stories.md` |
| Domain notes | `domain-model.md` |
| Legacy spec export | `legacy-spec.md` |

## What the agent extracts

- **Actors** (`actor.customer`, `actor.admin`, …)
- **Use cases** (`UC-01`, `UC-02`, …)
- **Features** (`F-01`, `F-02`, …)
- **Functional requirements** (`FR-01`, …)
- **NFRs** (`NFR-01`, …)
- **Data entities** (`ENT-Order`, …)

Staged to `.ai-spector/.docflow/analysis/knowledge.json` → merged into the traceability graph via `ai-spector graph merge --from-knowledge`.

Override inputs: tell the agent to analyze a different folder path in chat.
