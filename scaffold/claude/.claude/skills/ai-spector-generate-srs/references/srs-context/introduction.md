# Graph → §1 Introduction

Query: `doc.srs.1-introduction` CONTEXT depth 2 + system root node.

| Template section | Graph source |
|---|---|
| **1.1 Product Name** | System node `name` |
| **1.1 Intended Audience** | All `actor` nodes → roles |
| **1.3 Major Features** | All `feature` nodes → F-xx names (graph only, no invented) |
| **1.3 Scope / Purpose** | System node `description` or data-source summary |
| **1.3 Out of Scope** | Nodes marked `outOfScope: true`; explicit exclusions in data-source |
| **1.4 References** | `rendersTo` / `definedIn` edges → data-source files |
