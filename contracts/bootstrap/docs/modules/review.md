# Review — Docops Module Guide

## Native config (Writer)

Enable with `capabilities.review: true` in `.docops/docops.config.json`.

| File | Purpose |
|------|---------|
| `.docops/review.config.json` | Sign-off preset (`extends: kaopiz-default`) |
| `.docops/review-queue/registry.json` | Per-document review state (v3) |
| `.docops/review-queue/pending.json` | Pending queue array |

Schema: `kari-writer/contracts/schemas/review/`. Example: `contracts/examples/review/minimal-registry.json`.

Writer web UI writes `overallStatus`, track `votes[]`, closure fields. **Do not** write `contentHash` or `docPath` — pipeline-owned.

## Custom adapter

An external sign-off tool may update `registry.json` if it:

1. Re-reads the file (and git SHA when available) before write
2. Retries on conflict
3. Leaves `contentHash` / `docPath` unchanged

Set `capabilities.review: false` to hide Writer review UI when your adapter owns the workflow entirely.
