# Graph → Screen Detail (per screen)

Queries:
```bash
ai-spector graph query doc.bd.screen-<slug> --direction both --depth 4 --edges CONTEXT --json
ai-spector graph query <UC-xx> --direction both --depth 4 --edges CONTEXT --json
ai-spector graph query <F-xx> --direction both --depth 3 --edges CONTEXT --json
ai-spector graph query <api-node> --direction both --depth 2 --edges DEPS --json
```

| Template section | Graph source |
|---|---|
| **Purpose / User Role** | UC `name` + description; actor node name(s) |
| **§1.1 Wireframe components** | UC `mainFlow` actor actions → form/button/list; UC `postconditions` → success state |
| **§1.2 Layout** | Input steps → form; output steps → display/table; nav steps → breadcrumb/back |
| **§1.3 Form fields** | API request body (F-xx `inputData`) → one input per field |
| **§1.3 Table columns** | API response body (entity `fields`) → one column per field |
| **§1.3 Buttons** | UC `mainFlow` action verbs → button labels |
| **§1.4 Primary actions** | UC `mainFlow` actor steps |
| **§1.4 Navigation** | UC `postconditions` target; `list-screens.md` §2 flow |
| **§1.5 Field validation** | F-xx `inputData.validationRules`; entity field constraints |
| **§1.5 Defaults** | F-xx `inputData.defaultValue`; entity field `default` |
| **Error / empty states** | UC `exceptionFlows` → one state per exception; API 404 → empty; API 400 → inline |
| **Role sections** | Multiple actors → mark each section with actor role |

**Rule:** Every form field → API request or F-xx `inputData`. Every column → API response or entity field. Every button label → UC flow verb. No invented content.
