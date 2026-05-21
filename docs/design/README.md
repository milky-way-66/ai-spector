# Design documentation

Architecture and redesign specs for AI Spector.

| Document | Status | Description |
|----------|--------|-------------|
| [workflow-overview.md](./workflow-overview.md) | **Normative** | Graph as heart: store knowledge, find relevant context |
| [traceability-graph-redesign.md](./traceability-graph-redesign.md) | **Target (v3)** | Schema, operations, migration phases |
| [tri-layer-graph-plan.md](./tri-layer-graph-plan.md) | **Plan (draft)** | Three-hub graph (source / business / spec), phases 0–5, UAT |

## Reading order

1. **Executive summary** and **Core contract** in the redesign doc.
2. **Tri-layer graph plan** if improving post-generate graph shape (source ↔ business ↔ spec).
3. **Architecture** and **Graph model** for schema and edges.
4. **DocFlow Graph engine** for storage, in-memory runtime, and CLI.
5. **Migration roadmap** for implementation phases.

The [example/](../../example/) project shows Cursor + v1 workflow integration; the published npm package is the library at repo root.
