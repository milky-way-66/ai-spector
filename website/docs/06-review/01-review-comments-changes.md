# Review, comments & changes

**Section:** [Review & changes](README.md) · **Course:** [Home](../README.md)  
**Time:** ~15 min

**Goal:** Sign off documents, close feedback threads, and make targeted edits.

---

## Document review

Formal sign-off after readiness scoring:

```
review documents
```

or *“review srs/01-overview”*, *“what needs review”*, *“pending client approval”*.

Flow: queue → agent reads doc + checklists + graph impact → summary → you **approve** / **request changes** / **dismiss**.

Custom checklists: JSON in `.ai-spector/.docflow/config/review-checklists/`.

---

## Comment threads

Informal feedback on sections:

```
resolve comments
show open comments
resolve C-001
add a comment to srs.md: missing forgot-password flow
```

Stored in `.ai-spector/comments/` — commit with your repo.

---

## Incremental changes

Add or update one feature without full SRS regen:

```
I want to add login with Google
```

Uses **resolve-task**: clarify → plan → approve plan → targeted edits → index.

---

## Next section

[Advanced](../07-advanced/README.md) *(optional)*
