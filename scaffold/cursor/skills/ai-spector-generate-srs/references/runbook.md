# Generate SRS

Generate SRS markdown **from the traceability graph** in DAG order.

**User runs this command;** the agent runs CLI.

| Shared workflow | Document |
|-----------------|----------|
| Scope cases, waves, merge, finish, guardrails | [generate-workflow.md](../../ai-spector/references/generate-workflow.md) |
| Graph query, ingest patch, parallelism | [generate-graph.md](../../ai-spector/references/generate-graph.md) |
| **Graph → template section mapping** | **[srs-context/](./srs-context/) — load the matching section file before writing each doc type** |

## Intent → DAG hints

| User phrase (examples) | Typical DAG / outputs |
|------------------------|------------------------|
| introduction, purpose, scope | `srs.introduction` |
| overall, actors, users, §2 | `srs.overall-description` |
| use case(s), UC, §3, chapter 3 | `srs.use-cases` (+ UC detail if “all UC details”) |
| feature list, §4.2, system features | `srs.features-list` |
| feature detail, per feature, F-xx | `srs.feature-details` (`F-01`, … from graph) |
| data, entities, §5 | `srs.data-requirements` |
| interfaces, API, §6 | `srs.external-interfaces` |
| NFR, quality, §7 | `srs.quality-attributes` |
| i18n, localization, §8 | `srs.internationalization` |
| legal, compliance, §9 | `srs.other-requirements` |
| “everything” / no filter | Full DAG — [generate-workflow.md](../../ai-spector/references/generate-workflow.md) case 1 |

## Config

- `dag.srs.json` — order + `dependsOn`
- `dag.srs.graph-seeds.json` — DAG id → `doc.srs.*` seed
- `completeness-rules.srs.json`
- `workflow.dependencies.json` → `generate-srs`

Templates: `.ai-spector/templates/srs/`

## Waves (reference)

| Wave | DAG examples | Notes |
|------|----------------|-------|
| 0 | `srs.introduction`, `srs.overall-description` | `doc.srs.*` chapters |
| 1 | `srs.use-cases` | + domain queries for §3.2 |
| 2 | `srs.features-list` | |
| 3 | `srs.feature-details` | one file per `F-xx` |
| 4 | data, interfaces, NFR, i18n, other | deps via `dependsOn` queries |

Follow [generate-workflow.md](../../ai-spector/references/generate-workflow.md) for planning and per-wave execution.

## Graph context (required before writing each file)

After running queries ([generate-graph.md](../../ai-spector/references/generate-graph.md) § C), load the matching file from `srs-context/` for the doc type being written:

| Writing | Load |
|---|---|
| §1 Introduction | `srs-context/introduction.md` |
| §2 Overall Description | `srs-context/overall-description.md` |
| §3 UC list or UC-xx detail | `srs-context/use-case-detail.md` |
| §4 feature list or F-xx detail | `srs-context/feature-detail.md` |
| §5 Data Requirements | `srs-context/data-requirements.md` |
| §6 External Interfaces | `srs-context/external-interfaces.md` |
| §7 Quality Attributes | `srs-context/quality-attributes.md` |

Every UC-xx, F-xx, and actor in output must exist as a graph node. No invented identifiers.

## SRS-specific ingest notes

- List chapters need `rendersTo` from template `doc.srs.*` nodes.
- Per-domain detail (`UC-xx`, `F-xx`): `rendersTo` to resolved path; `definedIn` to sections when applicable.
- Example patch shape: [generate-graph.md](../../ai-spector/references/generate-graph.md) § E.

## Finish (SRS)

After last wave ([generate-workflow.md](../../ai-spector/references/generate-workflow.md) § Finish):

```bash
npx ai-spector index
```

`index` parses UC/F/actor ids from markdown bodies and adds `doc.srs.uc-*` / `doc.srs.f-*` document + section nodes.

Suggest `/summary srs` after index. Log: `.ai-spector/.docflow/logs/generate-srs.log`.

## If blocked

Often: run `/analyze` if domain nodes missing; merge ingest if dependency `rendersTo` is empty. Re-run **`/generate-srs`**.
