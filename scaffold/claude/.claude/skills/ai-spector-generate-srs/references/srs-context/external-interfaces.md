# Graph → §6 External Interfaces

Query: `doc.srs.6-external-interfaces` DEPS depth 2, then each `api` / `externalSystem` node.

| Template section | Graph source |
|---|---|
| **6.1 User Interfaces** | Screen nodes → names, purposes; actor nodes → which screens they use |
| **6.2 Software Interfaces** | API / `externalSystem` nodes → name, protocol, purpose; `dependsOn` from F-xx |
| **6.3 Hardware Interfaces** | NFR nodes tagged `hardware` |
| **6.4 Communication Interfaces** | Protocol / integration nodes; NFR nodes tagged `communication` |
