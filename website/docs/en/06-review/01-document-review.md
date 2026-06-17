# Document review & sign-off

**Section:** [Review](README.md) · **Course:** [Home](../README.md)  
**Time:** ~15 min

**Goal:** Formally review and sign off a document — not the same as comments or spec approval.

---

## In plain terms

When a document is ready for approval, you run a **review workflow**. The agent reads the document, checks readiness, summarizes findings in chat, and only then lets you approve or request changes.

This is **formal sign-off** — different from *"yes, go ahead"* on a generation plan.

---

## You say → Agent does → You see

**You say:** *"review documents"*

**Agent does:** Opens the review queue, lets you pick a document, writes a review summary in chat.

**You see:**
- Readiness scores and checklist results
- Written review in chat (not a silent approve)
- Your decision menu: Approve / Request changes / Skip

You can also name a document: *"review srs/01-overview"*

---

:::exercise
**Paste in chat:**

```
review documents
```

**You should see:**
- Review queue or document picker
- Agent reads the doc and writes findings before asking for your decision
:::

:::roletip
**BA / Tester** — this is your core daily workflow for quality gates.
:::

## If something goes wrong

| Symptom | Say in chat |
|---------|-------------|
| Agent approved without review text | Say *"write the review first"* — formal sign-off requires a summary |
| Wrong document | Name the path: *"review srs/01-overview"* |
| Confused with SPEC approval | Document sign-off = this lesson; SPEC = after generate |

---

## Next

[Resolve comments](02-resolve-comments.md)
