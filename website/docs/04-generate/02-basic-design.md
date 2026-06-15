# Basic design

**Section:** [Generate documents](README.md) · **Course:** [Home](../README.md)  
**Time:** ~10 min · **Before:** [Generate SRS](01-generate-srs.md)

**Goal:** Produce high-level architecture from SRS + graph.

---

## Generate

```
generate basic design
```

Same gated flow as SRS: check → clarify → plan → approve → waves.

Output in `docs/basic-design/`: modules, data model overview, API surface.

Give feedback in chat rather than editing files directly when possible:

```
the basic design should separate notification from user module
```

---

## What you should see

- Same plan gate as SRS before any write.
- Files under `docs/basic-design/` (screen list, API list, DB overview…).
- Modules trace back to SRS use cases in the graph.

---

## After finishing

```
refresh the index
```

---

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| BD before SRS complete | Finish SRS + index first |
| Architecture doesn't match SRS | Say *"align modules to UC-003"* in chat |

---

## Check

Architecture section maps modules to SRS use cases.

---

## Next section

[Design & prototype](../05-prototype/README.md)
