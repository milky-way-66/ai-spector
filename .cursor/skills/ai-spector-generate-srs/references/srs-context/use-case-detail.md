# Graph → §3 Use Case detail (per UC-xx)

Query: `UC-xx` CONTEXT depth 4.

| Template section | Graph source |
|---|---|
| **Name / Description** | UC node `name`, `description` |
| **Primary Actor** | Actor linked via `satisfies` or `partOf` inbound |
| **Secondary Actors** | Additional actor nodes in neighbourhood |
| **Priority** | UC node `priority` |
| **Preconditions** | UC `preconditions` array; or `dependsOn` UCs that must complete first |
| **Postconditions** | UC `postconditions` array |
| **Trigger** | UC `trigger` property |
| **§2 Main Flow** | UC `mainFlow` steps → one numbered row per step |
| **§3 Alternative Flows** | UC `alternativeFlows` → one subsection per entry |
| **§4 Exception Flows** | UC `exceptionFlows` / `errorFlows` + F-xx `errorHandling` for linked features |
| **§5 Business Rules** | F-xx `businessRules` via `satisfies` outbound → BR-xx-nn ids |
| **§6 Functional Requirements** | F-xx FR list via `satisfies` → FR-xx-nn ids |
| **§7 Input Data** | F-xx `inputData` + `dataEntity` nodes via `dependsOn` |
| **§7 Output Data** | F-xx `outputData` + `dataEntity` nodes reachable from UC |
| **§8 UI Requirements** | Screen nodes linked via `satisfies` → screen names and ids |
| **§9 Related Use Cases** | UC nodes via `relatesTo`, `includes`, `extends` edges |

For the **§3 list chapter** (not per-file): query `doc.srs.3-use-cases` CONTEXT depth 2 → extract all `useCase` nodes, sorted by id.

**Rule:** Every UC and F-xx in output must exist as a graph node. Missing node → `<!-- TODO: node missing in graph -->`.
