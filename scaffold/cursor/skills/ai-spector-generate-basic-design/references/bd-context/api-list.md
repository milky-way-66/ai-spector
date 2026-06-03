# Graph → API List

Queries:
```bash
ai-spector graph query doc.bd.list-api --direction both --depth 3 --edges CONTEXT --json
ai-spector graph query doc.srs.6-external-interfaces --direction both --depth 2 --edges DEPS --json
```

Derive each endpoint — **no invented endpoints**:

| Endpoint rule | Graph evidence required |
|---|---|
| GET list | `dataEntity` + UC with list/search flow |
| GET detail | `dataEntity` + UC with single-record read |
| POST create | `dataEntity` + UC with create/submit flow |
| PUT/PATCH update | `dataEntity` + UC with edit flow |
| DELETE | `dataEntity` + UC with delete/archive flow |
| Auth (login/logout) | Actor node + auth UC |

| Column | Graph source |
|---|---|
| **Method** | Action type: GET/POST/PUT/DELETE |
| **Path** | Entity name + UC slug; plural snake_case collections |
| **Summary** | UC `name` or F-xx `name` |
| **Auth required** | Actor `authRequired`; UC precondition `authenticated` |
| **Source F-xx / UC-xx** | F-xx and UC-xx nodes that `satisfies` this endpoint |
