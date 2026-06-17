# Four kinds of "approve"

**Section:** [Chat basics](README.md) · **Course:** [Home](../README.md)  
**Time:** ~10 min

**Goal:** Tell the difference between plan approval, document sign-off, spec review, and closing comments.

---

## Why this matters

*"Looks good"* or *"approve"* can mean four different things. Choosing the wrong one causes confusion or skipped steps.

---

## The four types

| You mean | Say (examples) | What happens |
|----------|----------------|--------------|
| **Sign off a document** | *"review documents"*, *"approve srs/01-overview"* | Formal review workflow; quorum may apply |
| **Approve extracted spec** | *"approve SPEC-001"* | After SRS generation; merges spec into project knowledge |
| **Execute a plan** | *"yes, go ahead"* after a plan table | Agent starts writing or editing files |
| **Close a comment thread** | *"resolve C-012"*, *"resolve comments"* | Marks feedback as addressed |

---

## You say → Agent does → You see

**You say:** *"help me approve"*

**Agent does:** Shows the four-option menu (or asks which one you mean).

**You see:** No document is signed off and no files are written until you pick the right type.

---

:::exercise
**Paste in chat:**

```
help me approve
```

**You should see:**
- Four-way disambiguation menu, **or**
- Agent lists the four types and asks which you mean
:::

:::roletip
**BA / Tester** — you will use **document sign-off** and **resolve comments** most often.
:::

## If something goes wrong

| Symptom | Say in chat |
|---------|-------------|
| Agent approved too early | Stop and say which type you meant; formal doc review needs a written review first |
| SPEC vs document confused | SPEC = after generate; document = *"review documents"* |

---

## Next

[Add or change a requirement](../04-changes/01-add-or-change-requirement.md)
