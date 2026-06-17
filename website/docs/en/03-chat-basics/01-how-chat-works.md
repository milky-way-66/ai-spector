# How chat works

**Section:** [Chat basics](README.md) · **Course:** [Home](../README.md)  
**Time:** ~10 min

**Goal:** Know what to say in chat and what the agent will do next.

---

## In plain terms

Describe what you need in everyday language. The agent picks the right workflow, asks questions when something is unclear, and waits for your approval before making big changes.

You do **not** need to know internal tool names or technical architecture.

---

## Common phrases

| You want to… | Say (examples) |
|--------------|----------------|
| Set up the project | *"setup ai-spector project"* |
| Generate SRS | *"generate the SRS"* |
| Review a document | *"review documents"* |
| Add one feature | *"I want to add login with Google"* |
| Fix feedback | *"resolve comments"* |
| Resume paused work | *"resume my SRS"*, *"active tasks"* |
| Check project health | *"check my workspace"* |

When unsure, say *"help me approve"* — the agent asks what you mean.

---

## You say → Agent does → You see

**You say:** *"help me approve"*

**Agent does:** Asks one clarifying question if your intent is ambiguous.

**You see:** A short menu (document sign-off vs plan vs spec vs comment) — not an automatic approval.

---

:::exercise
**Paste in chat:**

```
help me approve
```

**You should see:**
- Agent asks which kind of approval you mean, **or**
- Agent explains the four types before taking action
:::

:::roletip
**BA / Tester** — bookmark the “review documents” and “resolve comments” rows.
:::

## If something goes wrong

| Symptom | Say in chat |
|---------|-------------|
| Wrong workflow started | Rephrase using the table above; say *"one feature only"* for small changes |
| Agent does too much | *"pause task"* then clarify scope |
| Nothing happens | *"check my workspace"* |

---

## Next

[Four kinds of approve](02-four-kinds-of-approve.md)
