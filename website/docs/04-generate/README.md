# Section: Generate documents

SRS and basic design with human-in-the-loop gates.

```mermaid
flowchart TD
  G[generate] --> CH[check + clarify]
  CH --> P[plan table]
  P --> A{approve plan}
  A --> W[waves write docs]
  W --> S[spec queue optional]
```

| Lesson | Time | Goal |
|--------|------|------|
| [Generate SRS](01-generate-srs.md) | 15 min | Clarify → plan → waves → specs |
| [Basic design](02-basic-design.md) | 10 min | Architecture from SRS |

**Before this section:** Graph validated with zero errors.

**Next section:** [Design & prototype](../05-prototype/README.md)
