# Comments — Docops Module Guide

## Native config (Writer)

Enable with `capabilities.comments: true` in `.docops/docops.config.json`.

Comments live under `paths.comments` (default `.docops/comments/`):

```text
.docops/comments/{logical_path}/{thread_id}/
├── meta_data.json
├── events.jsonl
└── {comment_id}          # one JSON file per comment
```

`logical_path` matches the document path without `docs/` prefix (e.g. `srs/en/1-introduction.md`).

Schema: `kari-writer/contracts/schemas/comments/`. Example: `contracts/examples/minimal-comment-thread/`.

`meta_data.json` carries `version` for optimistic concurrency. Writer increments version on each write.

## Custom adapter

A CI bot or local tool may create comment threads by:

1. Creating the thread folder with valid `meta_data.json` and at least one comment file
2. Appending events to `events.jsonl` for audit trail
3. Re-reading `meta_data.json` before updates; retry on version mismatch

Set `capabilities.comments: false` when comments are managed entirely outside Writer.
