# Graph → Screen List

Queries:
```bash
ai-spector graph query doc.bd.list-screen --direction both --depth 3 --edges CONTEXT --json
ai-spector graph query doc.srs.3-use-cases --direction both --depth 2 --edges DEPS --json
```

Derive each screen — **no invented screens**:

| Screen rule | Graph evidence |
|---|---|
| One screen per UC with actor-facing interaction steps | UC `mainFlow` with actor actions |
| List/dashboard per browsable entity | `dataEntity` + UC with list/search flow |
| Detail/form per creatable or editable entity | `dataEntity` + UC with create/edit flow |
| Auth screens | Actor node + login/auth UC |
| Role variants | Multiple actors on same UC → separate screens or role tabs |

| Column | Graph source |
|---|---|
| **Screen ID** | S-xx sequentially |
| **Screen Name** | UC name or entity name + action |
| **Purpose** | UC one-line description |
| **User Role** | Actor node(s) satisfying this UC |
| **Related F-xx / UC-xx** | UC and F-xx nodes this screen satisfies |

**§2 Navigation Flow:** UC `postconditions` → target screen after action completes.
