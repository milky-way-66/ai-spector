# Graph context for prototype generation

Run these queries **before writing each screen's HTML**. The graph holds the authoritative spec — screen detail docs often summarize it; the graph has the full picture.

Skip this document only when the graph has zero nodes for the screen (brand-new project with no graph yet). In that case, note the gap and generate from screen detail doc alone.

---

## Step 1 — Screen node + neighborhood

```bash
npx ai-spector graph query doc.bd.screen-<slug> --direction both --depth 4 --edges CONTEXT --json
```

What to extract from the result:

| Field / edge | Use in HTML |
|---|---|
| `satisfies` → F-xx nodes | Business rules, field constraints, success/error states |
| `satisfies` → UC-xx nodes | Actor roles, preconditions, flow steps, postconditions |
| `dependsOn` → `doc.bd.api-*` nodes | Form fields, request params, response columns |
| `contains` → section nodes | Section headings and subsections already defined |
| `tracesTo` → SRS nodes | NFR constraints (e.g. required, max length, format) |

If `doc.bd.screen-<slug>` is not found in the graph, try `screen-<slug>` or the screenId from `list-screens.md`.

---

## Step 2 — Feature detail (per linked F-xx)

For each F-xx found in Step 1 `satisfies` edges:

```bash
npx ai-spector graph query F-<n> --direction both --depth 3 --edges CONTEXT --json
```

Extract:
- **Functional requirements** listed under the feature → must-have UI behaviours
- **Field definitions** (`rendersTo` → docs if present)
- **Business rules** (validation, conditional visibility, permissions)
- **Actor** that performs / views this feature → drives role-based UI variants

---

## Step 3 — Use-case detail (per linked UC-xx)

For each UC-xx found in Step 1 `satisfies` edges:

```bash
npx ai-spector graph query UC-<n> --direction both --depth 3 --edges CONTEXT --json
```

Extract:
- **Primary actor** → who the screen is for; if multiple actors, plan role tabs or conditional sections
- **Preconditions** → what state must be shown before the main action (e.g. "must be logged in" → redirect guard state)
- **Main flow steps** → maps directly to the interactive sequence in the HTML (form → submit → result)
- **Alternative / exception flows** → error states and empty states to include

---

## Step 4 — API endpoint detail (per linked API)

For each `doc.bd.api-*` node found in Step 1 `dependsOn` edges:

```bash
npx ai-spector graph query doc.bd.api-<slug> --direction both --depth 2 --edges DEPS --json
```

Extract:
- **Request body fields** → form inputs (name, type, required/optional, format hints)
- **Response body fields** → table columns, card properties, display labels
- **HTTP method + path** → drives the form `action` hint and confirmation copy
- **Error codes** → error message copy and UI states (404 → empty state, 400 → inline validation, 401 → redirect)

---

## Step 5 — Actor / permission check

If the screen serves multiple actors (e.g. Admin + End User):

```bash
npx ai-spector graph query <actorId> --direction both --depth 2 --edges CONTEXT --json
```

Use actor data to:
- Render role-specific sections (admin actions gated behind a permission check visual)
- Show the correct navigation items for each role
- Label buttons and headings with the actor's natural language (not just "user")

---

## Synthesis — before writing the HTML

Compile answers to these questions from the query results. Do **not** invent answers not grounded in graph data — leave a `<!-- TODO: not in spec -->` comment instead.

| Question | Source |
|---|---|
| What fields does the form have? | API request body (Step 4) |
| What columns / data does the list/detail show? | API response body (Step 4) |
| What validation rules apply? | F-xx business rules (Step 2) |
| What error states must exist? | UC exception flows (Step 3) + API error codes (Step 4) |
| What empty state must exist? | UC preconditions + API 404 handling |
| Which actors see what? | Actor roles (Step 3 + 5) |
| What is the navigation target after the main action? | UC postconditions + `list-screens.md` §2 flow |
| Any NFR constraints (length limits, formats)? | SRS `tracesTo` nodes (Step 1) |

---

## Accuracy rules

1. **Every form field must trace to** an API request field, an F-xx field definition, or a UC data requirement. Remove any field that has no graph backing.
2. **Every table column must trace to** an API response field or a data entity property. No invented columns.
3. **Every button / action must trace to** a UC main flow step or F-xx functional requirement. Label it with the spec's language, not generic copy ("Save" is fine only if the spec says save; use the spec's verb if it differs).
4. **Error and empty states are mandatory** when the UC has exception flows or the API returns error codes. A screen with only the happy-path is incomplete.
5. **Role-based sections are mandatory** when more than one actor satisfies the screen. Use a visual separator or tab — do not silently drop one actor's view.
