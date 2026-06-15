# How chat works

**Section:** [Chat basics](README.md) · **Course:** [Home](../README.md)  
**Time:** ~10 min

**Goal:** Understand routing and what “approve” means.

---

## Orchestrator & workers

| Layer | Role |
|-------|------|
| **Orchestrator** | Classifies intent, asks routing questions, spawns workers |
| **Worker** | One job per runbook (analyze, generate, review…) |

Describe what you need in chat — skills route to the right worker. Same phrases work in **Cursor** and **Claude Code**.

---

## Common phrases

| You want to… | Say (examples) |
|--------------|----------------|
| Generate SRS | *“generate the SRS”*, *“write use cases”* |
| Sign off a document | *“review documents”*, *“approve srs/01-overview”* |
| Resolve feedback | *“resolve comments”*, *“show open comments”* |
| Analyze sources | *“analyze my data source”* |
| Check workspace | *“check my workspace”* |

Unsure? Say *“help me approve”* — the agent asks one clarifying question.

---

## Four kinds of “approve”

| You mean | Say | Not this |
|----------|-----|----------|
| Sign off a document | *“review srs/01-overview”*, *“approve the SRS”* | spec / plan / comment |
| Approve extracted spec | *“approve SPEC-001”* | document sign-off |
| Execute a plan | *“yes, go ahead”* after plan table | document sign-off |
| Close comment thread | *“resolve C-012”* | document sign-off |

---

## Next

[Workspace & tasks](02-workspace-and-tasks.md)
