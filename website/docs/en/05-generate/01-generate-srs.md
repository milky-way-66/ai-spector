# Generate SRS

**Section:** [Generate](README.md) · **Course:** [Home](../README.md)  
**Time:** ~15 min

**Goal:** Run the full SRS workflow — questions, plan, approval, then documents.

---

## In plain terms

Generating the SRS is a **guided conversation**. The agent checks your workspace, asks about missing information, shows what sources will shape the document, presents a plan, and **waits for your yes** before writing anything under `docs/srs/`.

---

## The flow (simple)

1. **Check** — workspace is ready
2. **Clarify** — agent asks questions; answers are saved
3. **Briefing** — which sources and topics shape the SRS
4. **Plan** — table of chapters/waves
5. **Your yes** — *"yes, go ahead"* (this is plan approval, not document sign-off)
6. **Write** — documents appear in waves
7. **Spec review** — optional SPEC items to approve or reject

---

## You say → Agent does → You see

**You say:** *"generate the SRS"*

**Agent does:** Creates a task and runs the gated flow above.

**You see:** No `docs/srs/` files until you approve the plan.

---

:::exercise
**Paste in chat:**

```
generate the SRS
```

**You should see:**
- Workspace check and clarifying questions
- Plan table — agent **waits** at the plan step
- (After you approve in a real run) files under `docs/srs/`
:::

:::roletip
**BA** — focus on answering clarification questions accurately; the agent uses your answers across sessions.
:::

## If something goes wrong

| Symptom | Say in chat |
|---------|-------------|
| Files written before plan yes | Stop; say *"pause task"* |
| Empty sections | *"analyze my data source"* first, then try again |
| SPEC vs doc review confused | SPEC = *"approve SPEC-001"*; formal sign-off = *"review documents"* |

---

## Next

[Document review](../06-review/01-document-review.md)
