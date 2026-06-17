# Graph → Detail Design common chapters

Run graph queries from `dag.graph-seeds.json` seeds before writing each common chapter.

```bash
npx ai-spector graph query doc.srs.7-quality-attributes --direction both --depth 3 --json
npx ai-spector graph query doc.srs.6-external-interfaces --direction both --depth 3 --json
npx ai-spector graph query doc.bd.db-design --direction both --depth 2 --json
```

| DAG node | Output | Primary graph sources |
|----------|--------|---------------------|
| `dd.common.architecture-overview` | `common/architecture-overview.md` | `doc.bd.db-design`, SRS §2 overall description, NFR performance/security |
| `dd.common.security-patterns` | `common/security-patterns.md` | `doc.srs.7-quality-attributes` security NFRs, actors with `authRequired` |
| `dd.common.error-handling` | `common/error-handling-patterns.md` | NFR reliability, UC exception flows, BD API error sections |
| `dd.common.performance-standards` | `common/performance-standards.md` | NFR performance/latency, BD API rate limits |
| `dd.common.integration-patterns` | `common/integration-patterns.md` | `doc.srs.6-external-interfaces`, integration actors |
| `dd.common.deployment` | `common/deployment-infrastructure.md` | `doc.bd.db-design`, deployment NFRs, data entities |

**Rule:** Common chapters define **project-wide patterns**. Do not duplicate per-feature API specs — reference basic design and link to feature detail docs.
