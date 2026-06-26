---
name: ai-spector-contract
description: >-
  Writer contract operations: document sign-off (review_approve), comment resolution
  (doc threads C-NNN and prototype batches B-NNN), translation sync, and language status.
  Use for review queue, approve doc by logical path (srs/01-overview), pending client review,
  resolve C-NNN threads, B-NNN prototype batches, resolve translations, or check language status.
  NOT for graph, generate, or setup — use the matching skill instead.
paths:
  - ".docops/review*"
  - ".docops/comments/**"
  - "comments/**"
  - "prototype/**"
  - ".ai-spector/.docflow/review-queue/**"
  - ".ai-spector/.docflow/translation-queue/**"
  - "docs/**"
---

# AI Spector — Contract

**Core:** [../ai-spector/SKILL.md](../ai-spector/SKILL.md) · **Workflow:** [../../WORKFLOW.md](../../WORKFLOW.md)

## Route by intent

Read **one** runbook section for the user's intent, then execute it end-to-end:

| Intent | Runbook section |
|--------|-----------------|
| Document sign-off, review queue, approve/decline doc | [references/runbook.md — Review](references/runbook.md#review) |
| Resolve doc comment threads (C-NNN) | [references/runbook.md — Comments](references/runbook.md#comments) |
| Resolve prototype HTML comment batches (B-NNN) | [references/runbook.md — Prototype-Comments](references/runbook.md#prototype-comments) |
| Sync translations, process translation queue | [references/runbook.md — Translation](references/runbook.md#translation) |
| Translation / language status check | [references/runbook.md — Lang-Status](references/runbook.md#lang-status) |

## Disambiguation: "approve" has four meanings

| User context | This skill | Tool | NOT this |
|---|---|---|---|
| **Document sign-off** — approve doc, review queue, pending client, logical path (`srs/…`) | yes | `contract_review` (`action: "approve"`) | `spec_approve`, `work_approve_plan`, `contract_comments` |
| **Extracted spec** — SPEC-001, spec queue | no → generate skills | `spec_approve` | `contract_review` |
| **Work plan** — "go ahead execute", plan table | no → `ai-spector` | `work_approve_plan` | `contract_review` |
| **Comment thread done** — C-NNN, resolve thread | yes | `contract_comments` (`action: "resolve"`) | `contract_review` |
| **Prototype comment batch** — B-NNN | yes | `contract_comments` (`action: "batch_resolve"`) | `contract_review` |

## Checklist

```
- [ ] Read matching runbook section completely
- [ ] MCP first (contract_review / contract_comments / contract_translate) → CLI fallback
- [ ] No .docops/guide/ links — reference kari-writer/contracts/CONTRACT.md for path semantics
- [ ] On failure: pause → report → offer fix per ai-spector/references/cli-failures.md
```
