# Comment threads

**Section:** [Review & changes](README.md) · **Course:** [Home](../README.md)  
**Time:** ~10 min · **Before:** [Document review](01-document-review.md)

**Goal:** Resolve informal feedback threads — not formal document sign-off.

Skill: **`ai-spector-resolve-comments`**

---

## Start

```
resolve comments
```

or *"show open comments"*, *"resolve C-012"*.

---

## Flow

1. `git pull` — sync comment meta from remote.
2. **Inbox** — table of open threads (C-NNN, file, snippet).
3. You pick a thread → agent plans the edit.
4. Agent edits the doc → **one commit**: document + comment metadata.
5. `comments_resolve` — thread closed.

---

## What you should see

- Inbox table with thread IDs like **C-001**, **C-012**.
- Plan describing which section will change before edits.
- Commit includes both the doc change and `.ai-spector/comments/` meta.
- Thread disappears from inbox after resolve.

**Add a comment** (for reviewers):

```
add a comment to srs.md: missing forgot-password flow
```

---

## Not comment threads

| You mean | Use instead |
|----------|-------------|
| Approve srs/01-overview | [Document review](01-document-review.md) |
| Add a feature to SRS | [Incremental changes](../02-chat-basics/03-incremental-changes.md) |

---

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| Resolve without doc edit | Commit must include doc + comment meta together |
| Thread not in inbox | `git pull`; check `.ai-spector/comments/` |
| Agent uses review_approve | Comments use `comments_resolve` — different workflow |

---

## Next section

[Advanced](../07-advanced/README.md) *(optional)*
