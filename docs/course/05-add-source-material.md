# Work 05 — Add Source Material

**Course:** [Index](README.md) · [Overview](00-overview.md) · [Previous](04-enable-agent-skills.md)

**Goal:** Put your requirements documents into the input folder so the agent has something to read and analyze.

**Before you start:** Work 02 (Initialize a Project).

---

## Where to Put Files

Drop your files into:

```
docs/data-source/
```

This folder was created by the `init` command. It is the only folder the agent reads when you say "analyze data source".

---

## Supported File Types

| Format | Notes |
|--------|-------|
| `.md` | Markdown — the preferred format |
| `.txt` | Plain text |
| `.pdf` | PDF — the agent extracts text automatically |

Do not put images, spreadsheets, or other binary files here. Convert them to one of the formats above first.

---

## What to Put In

Put in any documents that describe **what the software should do**. Examples:

- Meeting notes from requirement discussions
- User story lists
- Business requirement documents (BRD)
- Functional specification drafts
- API contracts written in plain language
- Wireframe descriptions (text, not image files)

You don't need a finished or perfectly formatted document. The agent works with rough notes too.

---

## Steps

### 1. Copy your files

Using Finder, Explorer, or the terminal:

```bash
cp /path/to/requirements.md docs/data-source/
cp /path/to/meeting-notes.txt docs/data-source/
```

Or just drag and drop the files into `docs/data-source/` in your editor's file tree.

---

### 2. Check file contents are readable

Open one file and confirm the text is readable by a human. PDFs sometimes contain scanned images with no selectable text — those won't work. Export a text version instead.

---

### 3. No special formatting required

You don't need to use any particular structure. The agent reads free-form prose and extracts actors, use cases, features, and requirements from it.

However, clear headings help. A document with sections like `## User Registration` or `## Payment Flow` will produce a more accurate graph than a wall of text.

---

## Check

```bash
ls docs/data-source/
```

You should see at least one `.md`, `.txt`, or `.pdf` file. The folder should not be empty before you run Work 06.

---

## Tips

- **More is better.** Add all the documents you have. The agent filters relevance itself.
- **Keep originals.** The agent reads but never modifies files in `docs/data-source/`.
- **Update any time.** You can add or replace files at any point. After adding new material, re-run Work 06 (analyze data source) to update the graph.

---

## Next

Go to [Work 06 — Analyze Data Source](06-analyze-data-source.md).
