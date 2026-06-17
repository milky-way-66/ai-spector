# What is AI Spector?

**Section:** [Welcome](README.md) · **Course:** [Home](../README.md)  
**Time:** ~10 min

**Goal:** Understand that you describe what you need in chat — the agent does the technical work.

---

## In plain terms

AI Spector helps your team turn requirements into structured documents (SRS, designs, reviews). **You talk to the agent in Cursor or Claude Code.** You do not need to memorize commands or edit config files for daily work.

| You do | Agent does |
|--------|------------|
| Say what you need | Picks the right workflow |
| Answer clarifying questions | Reads your project and sources |
| Approve plans when asked | Writes documents and updates the project |

---

## You say → Agent does → You see

**You say:** *"open the course"*

**Agent does:** Starts the course in your browser and points you to the right lesson.

**You see:** A link like `http://127.0.0.1:4177/course/en/index` and a short summary.

---

:::exercise
**Paste in chat:**

```
open the course
```

**You should see:**
- Agent runs the course server (or links if already running)
- Browser opens the course home
- Agent summarizes this lesson in chat — not the full text
:::

:::roletip
**Everyone** — bookmark the course URL for quick reference.
:::

## If something goes wrong

| Symptom | Say in chat |
|---------|-------------|
| Port already in use | *"course server port is busy"* — close the other window or ask a developer |
| Course not found | *"setup ai-spector project"* first (next lesson) |

---

## Next

[Setup via chat](../02-get-started/01-setup-via-chat.md)
