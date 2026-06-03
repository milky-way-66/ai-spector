# Context management during generation

Long generation runs (full SRS, full basic design) accumulate raw graph JSON, template content, data-source files, and previous wave outputs in the context window. Past a certain size, this degrades accuracy — the model starts blending data from earlier targets into the current one.

Two tools prevent this: **compaction checkpoints** and **sub-agent delegation**.

---

## Rule 1 — Compact at wave boundaries (mandatory)

After every wave completes (merge + validate pass), compact the context **before starting the next wave**:

```
/compact
```

What to retain across the compaction (summarise into the compact prompt if the tool asks):
- The generation plan: wave table, remaining targets, current wave number
- Completed outputs: list of written file paths + validate OK (not their content)
- Language setting and theme (if prototype)
- Any open blockers or deferred items

What to discard (do not try to retain):
- Raw graph query JSON from completed targets
- File content of already-written docs
- Template content (re-read from `.ai-spector/templates/` when needed)
- Data-source file content read in earlier waves

**Trigger compact also when:**
- Writing more than 5 per-domain files in a single wave (compact after every 5th file)
- Switching document types mid-wave (e.g., UC files → feature files)
- Context feels noisy — re-reads of the same data, earlier target data bleeding in

---

## Rule 2 — Sub-agent for graph context gathering

Do **not** run graph queries + file reads + synthesis all inline in the main agent turn. This fills the context with raw data that is only useful for 30 seconds.

Instead, delegate context gathering to a sub-task and receive only the distilled result.

### Sub-agent pattern

**Delegate:** "Gather context for `<target>`"

**Prompt to sub-agent (adapt per target type):**

```
Query the graph and read relevant files for <target id / type>.
Return ONLY a structured summary — do not return raw JSON or full file content.

Required output shape:
- Target: <id>, <name>
- Actors: list of actor names and roles
- Flow steps: numbered main flow (max 10 steps); exception flows (list conditions only)
- Data fields: input fields (name, type, required, validation); output fields (name, type)
- Related nodes: UC/F/API/screen ids that this target depends on or satisfies
- Gaps: any required graph node that is missing or empty

Queries to run:
  ai-spector graph query <seedId> --direction both --depth 4 --edges CONTEXT --json
  ai-spector graph query <depId> --direction both --depth 2 --edges DEPS --json
  [read projectionPaths files listed in query result]

Max summary length: 400 words. No raw JSON in the response.
```

**Main agent receives:** The 400-word summary — not the raw query output.

**Main agent writes:** The document file using the summary + template.

### When to use sub-agents

| Task | Use sub-agent? |
|---|---|
| Graph query + extraction for a single UC/F/screen | **Yes** |
| Reading multiple data-source files to find relevant domain info | **Yes** |
| Impact analysis before regenerating a file | **Yes** |
| Checking whether a UC node exists | No — simple CLI call inline |
| Writing the file itself | No — main agent writes |
| Running `graph validate` / `graph merge` | No — CLI inline |

---

## Rule 3 — Read discipline (no speculative reads)

Only read a file if the graph query result references it in `projectionPaths` or the DAG explicitly lists it as a dependency. Never read:

- `docs/**` as a glob
- The entire `docs/data-source/` directory upfront
- Previously generated docs "for context" unless they are a direct DAG dependency of the current target

After a file is read and its relevant data extracted, treat it as consumed. Do not re-read it for a later target unless that target also has it in `projectionPaths`.

---

## Rule 4 — Context budget per target

Before writing each target, the context should hold **only**:

| Item | Max size |
|---|---|
| Generation plan (wave table, remaining targets) | ~200 tokens |
| Extracted context for current target (from sub-agent or compact summary) | ~400 tokens |
| Template structure (section headings only, not full template) | ~200 tokens |
| Language setting | 1 line |
| Current target output (while writing) | as needed |

If the active context clearly exceeds this (raw JSON visible, previous target data visible, multiple template files loaded), compact before writing.

---

## Rule 5 — After writing, let it go

Once a file is written and `rendersTo` is logged for the wave-end merge:
- Do not re-read the file
- Do not summarise its content into memory
- Record only: path + validate status

The graph is the persistent record. The context window is scratch space per target.

---

## Compaction prompt template

When compacting mid-run, include this summary so the next turn has enough to continue:

```
Continuing generation of <layer> (e.g., SRS / basic design).

Plan:
- Wave <N> of <total> — COMPLETED
- Wave <N+1> targets: <list of DAG ids and output paths>
- Remaining waves: <list>

Completed files:
<path> — validate OK
<path> — validate OK

Settings:
- Language: <language>
- Graph validated: YES

Resume at: wave <N+1>, target <first target id>.
```

---

## Summary

| Checkpoint | Action |
|---|---|
| End of every wave | `/compact` with plan summary |
| Every 5 per-domain files | `/compact` with plan summary |
| Before each target | Delegate graph query + extraction to sub-agent |
| After reading data-source files | Extract what's needed; discard the raw read |
| After writing a file | Record path + status only; discard file content |
