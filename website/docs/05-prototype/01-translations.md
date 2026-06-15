# Translations *(optional)*

**Section:** [Design & prototype](README.md) · **Course:** [Home](../README.md)  
**Time:** ~10 min · **Skip if** you only need one language

**Goal:** Keep secondary languages in sync with primary docs.

---

## Setup & sync

Primary language (`languages[0]` in config) is **generated**; others are **translated**.

```
add language vi
translation status
resolve translations
```

Agent translates stale files, then re-indexes.

---

## What you should see

- `lang_queue` or status showing stale translation files.
- Translated files under language folders (e.g. `docs/vi/`).
- Index refreshed after sync.

---

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| Nothing to translate | Generate primary language docs first |
| Stale after EN edit | `resolve translations` then `refresh the index` |

---

## Next

[Build prototype](02-build-prototype.md) — or skip here if you don't need a UI mockup.
