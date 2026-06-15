# Graph → DB Design

Queries:
```bash
npx ai-spector graph query doc.bd.db-design --direction both --depth 4 --edges CONTEXT --json
npx ai-spector graph query <entityId> --direction both --depth 3 --edges CONTEXT --json  # per entity
npx ai-spector graph query doc.srs.5-data-requirements --direction both --depth 2 --edges DEPS --json
```

| Template section | Graph source |
|---|---|
| **§1 DBMS** | NFR nodes tagged `infrastructure` or `database`; data-source mentions |
| **§2 ERD entities** | All `dataEntity` nodes → table names (snake_case) |
| **§2 ERD relationships** | `relatesTo` / `dependsOn` edges between entities → cardinality from edge `label` |
| **§3 Table list** | All `dataEntity` nodes → `description` |
| **§4 Fields** | Entity `fields` array → name, type, required, constraints, default |
| **§4 Primary key** | Field with `pk: true` or id convention |
| **§4 Foreign keys** | `relatesTo` / `dependsOn` edges → FK = `<target>_id` unless node specifies |
| **§4 Indexes** | Entity `indexes` array; NFR performance constraints on this entity |
| **§4 Constraints** | Field `validationRules` + NFR constraint nodes |

**Rule:** Every table → `dataEntity` node. Every FK → edge. No tables without graph backing.
