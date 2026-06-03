# Graph → §4 Feature detail (per F-xx)

Query: `F-xx` CONTEXT depth 4.

| Template section | Graph source |
|---|---|
| **Name / Priority / Description** | F-xx node `name`, `priority`, `description` |
| **User Story** | F-xx `userStory`; or derive from actor + description |
| **In / Out of Scope** | F-xx `scope.in`, `scope.out` arrays |
| **Related Use Cases** | UC nodes via `satisfies` inbound → UC-xx ids and names |
| **§2 Stimulus/Response** | UC `mainFlow` steps for linked UCs; actor name from actor node |
| **§2 Error Handling** | UC `exceptionFlows` + F-xx `errorHandling` array |
| **§3 Functional Requirements** | F-xx `requirements` → FR-xx-nn ids, descriptions, priority, acceptance criteria |
| **§3 Input Data** | F-xx `inputData` or entity nodes via `dependsOn` |
| **§3 Output Data** | F-xx `outputData` or entity response fields |
| **§3 UI — Screens** | Screen nodes linked via `satisfies` |
| **§3 Dependencies** | `dependsOn` edges → other F-xx or external system nodes |
| **§3 Assumptions** | F-xx `assumptions` array |

For the **§4 list chapter**: query `doc.srs.4-system-features-list` CONTEXT depth 2 → extract all `feature` nodes sorted by id; include linked UC ids.
