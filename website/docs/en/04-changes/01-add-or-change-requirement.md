# Add or change a requirement

**Section:** [Changes](README.md) · **Course:** [Home](../README.md)  
**Time:** ~10 min

**Goal:** Add or update one feature or section without regenerating the entire SRS.

---

## In plain terms

When you need a **small change** — one login method, one screen, one requirement — say so clearly. The agent plans the change, waits for your yes, then updates only what is needed.

This is **not** full document generation.

---

## You say → Agent does → You see

**You say:** *"I want to add login with Google"*

**Agent does:** Clarifies scope, shows a plan, waits for approval, then edits the right documents.

**You see:**
- Clarifying questions (stored for later sessions)
- A plan table — reply *"yes, go ahead"* to execute
- Updated docs after approval — not before

---

:::exercise
**Paste in chat:**

```
I want to add login with Google
```

**You should see:**
- Agent treats this as one incremental change (not full SRS generation)
- Plan table before any writes
:::

:::roletip
**BA** — use this for most day-to-day requirement updates.
:::

## If something goes wrong

| Symptom | Say in chat |
|---------|-------------|
| Agent started full SRS generation | Say *"one feature only"* or *"incremental change"* |
| Files changed before plan yes | Stop; say *"pause task"* |

---

## Next

[Generate SRS](../05-generate/01-generate-srs.md)
