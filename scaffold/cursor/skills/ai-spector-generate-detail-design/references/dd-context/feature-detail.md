# Graph → Feature detail design (per F-xx)

```bash
npx ai-spector graph query F-01 --direction both --depth 4 --edges CONTEXT --json
npx ai-spector graph query doc.dd.architecture-overview --depth 1 --json
```

| Template section | Graph source |
|------------------|--------------|
| Feature Name / Summary | `F-xx` title + SRS `doc.srs.f-xx` purpose |
| Design decisions | NFR constraints, BD db-design entities |
| Dependencies | `satisfies`, `tracesTo` UCs, other F-xx |
| Component design | BD screens/APIs linked to this feature |
| Sequence diagrams | UC `mainFlow` steps + BD API operations |
| API specs | **Reference** `docs/basic-design/api/*.md` — link, do not duplicate endpoint tables |
| Database / UI | **Reference** `doc.bd.db-design`, `docs/basic-design/screens/*.md` |
| Error handling | UC exceptions + `dd.common.error-handling` patterns |
| Security | `dd.common.security-patterns` + actor auth |

**Rule:** Implementation detail lives here; endpoint request/response field lists stay in basic design. Cite BD paths explicitly (`basic-design/api/...`, `basic-design/screens/...`).

**Per-feature file:** `docs/detail-design/{lang}/features/f-{nn}-{slug}.md` — one graph query per feature, never batch-script from `knowledge.json`.
