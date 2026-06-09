# Work 11 — Generate Basic Design

**Course:** [Index](README.md) · [Overview](00-overview.md) · [Previous](09-index-the-project.md)

**Goal:** Have the agent produce the high-level (basic) design document — system architecture, modules, and component relationships.

**Before you start:** Work 08 (Generate SRS), Work 09 (Index the Project).

**Multi-language:** Basic design is generated in the **primary** language only. Translate to other languages with [Work 10 — Multi-language](10-multi-language.md).

---

## What the Basic Design Contains

The basic design describes the system at a high level:

- System architecture overview (layers, major components)
- Module breakdown — which module handles which use cases
- Data model overview (entities and key relationships)
- API surface at a high level (endpoints / interfaces, not implementation)
- External system integrations

The document is written to `docs/basic-design/`.

---

## Steps

### 1. Open chat

### 2. Type this

```
generate basic design
```

---

### 3. Wait for the agent

The agent reads the SRS, the traceability graph, and the basic design templates, then writes the document. Typical time: 2–5 minutes.

---

### 4. Open and review the output

```
docs/basic-design/basic-design.md
```

Check:

- Does the module breakdown match your understanding of the system?
- Are external systems and integrations correctly identified?
- Is anything major missing?

---

### 5. Provide feedback via chat

If the design needs changes, guide the agent in chat rather than editing the file:

```
the basic design should separate the notification module from the user module
```

The agent will update the document based on your feedback.

---

### 6. Re-index after finalizing

Once you are happy with the basic design, run:

```
refresh the index
```

This keeps the section registry in sync with the new document.

---

## Check

Open `docs/basic-design/basic-design.md`. It should have:

- An architecture section with named layers or modules
- A section mapping modules to use cases from the SRS

---

## Troubleshooting

**Basic design references modules that don't match the SRS**

The graph links are inconsistent. Re-run:

1. `analyze data source`
2. `validate the graph`
3. `generate basic design`

**Agent produces a very thin basic design**

The SRS use cases are too abstract. Add more technical context to `docs/data-source/` — for example, a list of known technologies, existing services, or integration points. Then re-analyze and regenerate.

---

## Next

Go to [Work 12 — Pick a Prototype Theme](12-pick-prototype-theme.md).
