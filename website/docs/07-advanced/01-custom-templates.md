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

## What you should see

- Pack listed in config after import.
- Generate uses your pack's chapter structure in the plan table.

---

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| Pack not found | Run `set up template pack` with import skill |
| Wrong template in generate | Check `packs.srs` / `packs.basicDesign` in config |

---

## Next

[Semantic search & second editor](02-search-and-editors.md)
