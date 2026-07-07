# Comments — Docops Module Guide

## Native config (Writer)

Enable with `capabilities.comments: true` in `.docops/docops.config.json`.

Comments live under `paths.comments` (default `.docops/comments/`).

### Entity registry layout (recommended)

```text
.docops/comments/documents/{entityId}/{thread_id}/
├── meta_data.json
├── events.jsonl
└── {comment_id}          # one JSON file per comment

.docops/comments/screens/{screenId}/{thread_id}/
└── …                     # prototype threads
```

`entityId` / `screenId` come from `.docops/registry/`. Threads survive document renames.

### Legacy layout (deprecated)

```text
.docops/comments/{logical_path}/{thread_id}/
├── meta_data.json
├── events.jsonl
└── {comment_id}
```

`logical_path` matches the document path without `docs/` prefix (e.g. `srs/en/1-introduction`).

**Migrate to entity layout:** [guides/COMMENTS_ENTITY_MIGRATION.md](../guides/COMMENTS_ENTITY_MIGRATION.md)

Schema: `kari-writer/contracts/schemas/comments/`. Example: `contracts/examples/minimal-comment-thread/`.

`meta_data.json` carries `version` for optimistic concurrency. Writer increments version on each write.

## Local CLI (AI Spector)

```bash
# List / triage
npx ai-spector comments inbox --json
npx ai-spector comments list --entity <uuid> --json

# Create and reply (document comments)
npx ai-spector comments create --file srs/01-overview --body "Please clarify" --start-line 12 --end-line 14
npx ai-spector comments create --entity <uuid> --body "Please clarify" --start-line 12 --end-line 14
npx ai-spector comments reply <threadId> --body "Updated in next revision"
npx ai-spector comments reply <threadId> --entity <uuid> --body "Updated in next revision"

# Resolve
npx ai-spector comments resolve <threadId> --entity <uuid>
```

**Reply scope:** `threadId` alone is enough when the thread is unique under `.docops/comments/`. For entity-layout storage (`comments/documents/{entityId}/`), `--file` resolves to the legacy path and may fail — prefer `threadId` only, or pass `--entity <targetId>` from `comments show` / `comments list` (`targetId` field).

**MCP:** `contract_comments({ action: "create" | "reply" | "list" | "inbox" | "show" | "resolve", ... })`

| Action | Required fields | Notes |
|--------|-----------------|-------|
| `reply` | `threadId`, `body` | Pass `entityId` from show/list when scope is ambiguous |
| `create` | `body`, plus `entityId` or `filePath` | Document anchor: `startLine` / `endLine` |
| `show` | `threadId` | Optional `entityId` / `filePath`; returns `targetId` for reply |

## Custom adapter

A CI bot or local tool may create comment threads by:

1. Creating the thread folder with valid `meta_data.json` and at least one comment file
2. Appending events to `events.jsonl` for audit trail
3. Re-reading `meta_data.json` before updates; retry on version mismatch

Prefer writing under `comments/documents/{entityId}/` when the registry is available.

Set `capabilities.comments: false` when comments are managed entirely outside Writer.
