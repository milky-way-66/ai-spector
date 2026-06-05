# Feedback Reports

**When to write a feedback report**

Write a feedback report when the **tool or workflow itself is the problem** — regardless of whether the agent recovered. A fix that required workarounds, extra steps, or guessing is still worth reporting.

Write when any of these are true:
- An error message is **not actionable** — says what failed but not how to fix it
- A CLI command **silently ignores input** (argument or flag dropped without warning)
- The agent had to **work around a missing flag or undocumented step** to complete a task
- A documented behavior **contradicts actual CLI behavior** (skill says X, CLI does Y)
- A workflow required **manual edits that the docs say you should not do**
- A command output **misleads about what actually ran** (e.g. "Graph ready" when extraction did not run)
- The same error or confusion **would likely happen to another user**

Do **not** write a report for:
- Pure user mistakes with no tooling gap (wrong id, wrong cwd, file the user forgot to create)
- One-off environment issues (disk full, permissions) unrelated to the tool design

---

## How to write the report

Save to: `docs/feedback/<YYYY-MM-DD>-<short-slug>.md`

Use this template:

```markdown
# <Short title>

**Product:** ai-spector (v<version from package.json>)
**Context:** <what the agent was doing when it hit this>
**Severity:** Low | Medium | High | Blocker
**Date:** <YYYY-MM-DD>

## Summary

One paragraph: what went wrong and why it blocked the workflow.

## Expected behavior

What the CLI should have done (cite the skill or docs reference if applicable).

## Actual behavior

### Command run

\`\`\`
npx ai-spector <command> <args>
\`\`\`

### Output

\`\`\`
<paste exact stdout/stderr>
\`\`\`

### What was wrong

Bullet list: what the output got wrong or what was missing.

## Steps to reproduce

1. Starting state (project structure, what files exist)
2. Exact command(s) run
3. Observed result

## Impact

- What was blocked
- Whether a workaround exists and what it cost (manual edits, extra steps)

## Suggested fix (optional)

What the CLI should do differently. CLI output, new flag, better error message, etc.
```

---

## Severity guide

| Severity | Meaning |
|----------|---------|
| Blocker  | Workflow cannot continue at all; no workaround |
| High     | Workaround exists but requires manual edits or undocumented steps |
| Medium   | Confusing or misleading; agent can recover but wastes time |
| Low      | Polish / wrong message / minor inconsistency |

---

## After writing

Tell the user:
```
Feedback saved → docs/feedback/<filename>.md
Severity: <level> — <one line why>
```

Do not attempt to fix the CLI yourself based on the feedback file. The report is for the development team.
