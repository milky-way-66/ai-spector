# Work 15 — Resolve Comments

**Course:** [Index](README.md) · [Overview](00-overview.md) · [Previous](14-impact-analysis.md)

**Goal:** Review and close inline feedback comments that have been added to your documentation during the review process.

**Before you start:** Work 08 (Generate SRS) or any work that produces documents.

---

## What Comments Are

AI Spector tracks review feedback as comment threads attached to specific sections of your documents. Anyone (you, a reviewer, or the agent) can add a comment. Comments stay open until explicitly resolved.

This is useful for:
- Tracking feedback from stakeholder reviews
- Recording items to fix before finalizing a document
- Letting the agent flag sections it was uncertain about

---

## Viewing Open Comments

### 1. Open chat

### 2. List all open comments

```
show open comments
```

or

```
resolve comments
```

The agent shows a list of open comment threads: which file, which section, what the comment says, and when it was added.

---

## Resolving a Comment

### Option A — Let the agent resolve it

If the comment is about something the agent can fix automatically (e.g. "missing the forgot password flow"), ask:

```
resolve the comment about forgot password in srs.md
```

The agent updates the relevant section and marks the comment resolved.

### Option B — Resolve it yourself

Read the comment, edit the document manually, then tell the agent:

```
mark thread 3 as resolved
```

or

```
the comment about the checkout error handling is resolved
```

---

## Adding a Comment

To add a review comment to a document:

```
add a comment to docs/srs/srs.md: the admin actor is not described in section 2
```

```
add a comment to basic-design.md section "Data Model": the user table is missing the role field
```

---

## Checking the Inbox

The comment inbox gives you a prioritized view of what needs attention — unresolved comments sorted by section:

```
show my comment inbox
```

This is useful when multiple reviewers have added comments and you need to triage.

---

## Check

After resolving all comments, run:

```
show open comments
```

The response should say there are no open threads.

---

## Troubleshooting

**"Thread not found"**

The thread ID might have changed after re-indexing. Run `show open comments` again to get the current list and use the thread number from that list.

**Agent resolves the comment but the document doesn't change**

The comment may refer to a section that requires manual judgment. The agent marks the comment resolved but notes that human review is needed. Read the section yourself and edit if needed.

**Comments are not persisted between sessions**

Comments are stored in `.ai-spector/comments/`. If this folder is missing or was deleted, comments are lost. Make sure this folder is committed to your repo.

---

## Next

Go to [Work 16 — Visualize the Graph](16-visualize-the-graph.md).
