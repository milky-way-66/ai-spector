# Custom template packs

**Section:** [Advanced](README.md) · **Course:** [Home](../README.md)  
**Time:** ~10 min · **Optional**

**Goal:** Use your team's document layout instead of builtin templates.

---

## Config & chat

`.ai-spector/docflow.config.json`:

```json
"packs": { "srs": "my-team-srs", "basicDesign": "builtin" }
```

```
set up template pack
template list
generate my-team-srs
```

Enable skill `ai-spector-template-import` for import.

---

## Next

[Semantic search & second editor](02-search-and-editors.md)
