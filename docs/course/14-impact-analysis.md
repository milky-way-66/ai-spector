# Work 14 — Impact Analysis

**Course:** [Index](README.md) · [Overview](00-overview.md) · [Previous](13-generate-prototype.md)

**Goal:** Find out which documents and graph nodes need to be updated or regenerated after a change — before you spend time updating the wrong things.

**Before you start:** Work 09 (Index the Project), Work 08 (Generate SRS).

---

## What Impact Analysis Does

When you change something — a requirement, a source document, a use case — not everything needs to be updated. Impact analysis tells you:

- **Regenerate** — documents that are directly derived from the changed node and are now stale. These must be regenerated.
- **Review** — documents that reference the changed node indirectly. These should be human-reviewed to decide if an update is needed.

This saves time by focusing your attention where it matters.

---

## Steps

### Option A — Impact from git changes (most common)

After editing any source document or graph node:

```
what's the impact of my changes
```

The agent reads your uncommitted git diff and traces which graph nodes were affected, then shows what needs regenerating and what needs reviewing.

---

### Option B — Impact from a specific node

If you know which use case or requirement changed:

```
what's the impact of changing UC-03
```

```
what breaks if I change the "User Login" use case
```

---

### Option C — Impact from a file or section heading

```
what's the impact of changes to docs/srs/srs.md section "Payment Flow"
```

---

## Reading the Report

The agent presents two lists:

**Regenerate:**
```
- docs/basic-design/basic-design.md  (section: Module Overview)
- prototype/src/checkout.html (static HTML) or a route in prototype/screen-map.json (SPA)
```
These are stale. Regenerate them.

**Review:**
```
- docs/srs/srs.md  (section: Non-functional Requirements)
```
These reference the changed area. A human should check if they need updating.

**Stale translations** *(multi-language projects only):*

If the report mentions `staleTranslations` or secondary-language documents (e.g. `doc:vi:…`), those files need **re-translation from the primary language** — not re-generation from the graph. See [Work 10 — Multi-language](10-multi-language.md):

```
resolve translations
```

---

## Acting on the Report

For each item in "Regenerate", run the appropriate generation command:

```
generate basic design
generate prototype for the checkout screen
```

For each item in "Review", open the file and read the flagged section. Edit manually if needed, then re-index.

---

## Check

After acting on the impact report, re-run:

```
what's the impact of my changes
```

The Regenerate list should be empty (all stale docs have been refreshed).

---

## Troubleshooting

**Impact analysis returns an empty result**

Either nothing changed (the git diff is empty) or the index is stale. Run:

```
refresh the index
```

Then try again.

**Too many items in the Regenerate list**

A change to a high-level node (like a core actor or primary use case) can cascade widely. That's expected. Regenerate the documents top-down: SRS first, then basic design, then prototype.

**Agent can't find the node I mentioned**

Use the exact node ID from the graph (like `UC-03`) or a phrase that matches a heading in the SRS. If unsure, ask:

```
what are the use case IDs in the graph?
```

---

## Next

Go to [Work 15 — Resolve Comments](15-resolve-comments.md).
