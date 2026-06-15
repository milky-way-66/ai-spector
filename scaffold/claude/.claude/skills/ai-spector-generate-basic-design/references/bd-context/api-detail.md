# Graph → API Detail (per endpoint)

Queries:
```bash
npx ai-spector graph query <F-xx> --direction both --depth 4 --edges CONTEXT --json
npx ai-spector graph query <UC-xx> --direction both --depth 3 --edges CONTEXT --json
npx ai-spector graph query <entityId> --direction both --depth 2 --edges CONTEXT --json
```

| Template section | Graph source |
|---|---|
| **Summary / Operation ID** | UC `name`; camelCase from method + entity |
| **Source Requirement** | F-xx id + name; UC-xx id + name |
| **Auth** | Actor `authRequired`; UC precondition `authenticated` |
| **Path params** | Entity field `pk: true`; UC flow step passing an id |
| **Query params** | UC filter/search flow steps; F-xx filter requirements |
| **Request body** | F-xx `inputData` → name, type, required, validation; UC `mainFlow` input steps |
| **Response 2xx** | F-xx `outputData` + entity `fields` for returned object |
| **Response 400** | F-xx `errorHandling` validation; entity field constraints |
| **Response 401/403** | Actor auth; UC precondition violations |
| **Response 404** | UC exception "resource not found" |
| **Response 409** | UC exception "already exists" / "conflict" |
| **§2 Data Model** | Entity `fields`; `relatesTo` edges for nested objects |
| **§3 Error Codes** | All UC exception flows + F-xx error handling → HTTP codes |
| **§4 Rate Limiting** | NFR nodes tagged `rateLimit` or `performance` |

**Rule:** Every request field → F-xx `inputData` or UC flow input. Every response field → entity `fields` or F-xx `outputData`. No invented fields.
