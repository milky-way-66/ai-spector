# Graph → §5 Data Requirements

Query: `doc.srs.5-data-requirements` DEPS depth 2, then each `dataEntity` node CONTEXT depth 3.

| Template section | Graph source |
|---|---|
| **Entity list** | All `dataEntity` nodes → name, description, linked F-xx via `satisfies` / `partOf` |
| **Entity fields** | `dataEntity.fields` array → name, type, required, constraints |
| **Relationships** | `relatesTo` / `dependsOn` edges between entities → cardinality from edge properties |
| **Retention rules** | Entity `retention` property or NFR nodes referencing entities |
