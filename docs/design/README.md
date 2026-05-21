# Design documentation

Architecture and redesign specs for AI Spector.

| Document | Status | Description |
|----------|--------|-------------|
| [workflow-overview.md](./workflow-overview.md) | **Normative** | Graph as heart: store knowledge, find relevant context |
| [traceability-graph-redesign.md](./traceability-graph-redesign.md) | **Target (v3)** | Schema, operations, migration phases |

## Reading order

1. **Executive summary** and **Core contract** in the redesign doc.
2. **Architecture** and **Graph model** for schema and edges.
3. **DocFlow Graph engine** for storage, in-memory runtime, and CLI.
4. **Migration roadmap** for implementation phases.

The [example/](../../example/) project shows Cursor + v1 workflow integration; the published npm package is the library at repo root.
