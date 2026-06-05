---
name: ai-spector-resolve-comments
description: "Processes review comments from the inbox. Use when the user asks to resolve comments, fix C-001, or address review feedback."
---

# AI Spector — Resolve Comments

## When to use

- "resolve comments", "fix C-001", "address review feedback"

## Workflow

```
1. Read comment inbox
2. Plan edits per comment
3. Apply edits to doc files
4. Commit (doc + comments/ meta together)
5. npx ai-spector graph impact + index
```

Read inbox:
`.ai-spector/.docflow/extract/` or via `npx ai-spector comments inbox`

## Checklist

```
- [ ] Read inbox
- [ ] Planned edits per comment
- [ ] Applied edits
- [ ] Committed doc + comments/ meta together
- [ ] Ran graph impact
- [ ] Ran index
```
