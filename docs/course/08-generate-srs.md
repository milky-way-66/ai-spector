# Work 08 — Generate SRS

**Course:** [Index](README.md) · [Overview](00-overview.md) · [Previous](07-validate-the-graph.md)

**Goal:** Have the agent produce the Software Requirements Specification document from the traceability graph.

**Before you start:** Work 07 (Validate the Graph) with zero errors.

**Multi-language:** SRS is generated in the **primary** language only (`languages[0]` in `docflow.config.json`, usually `en`). Secondary languages are synced in [Work 10 — Multi-language](10-multi-language.md).

**Custom template pack:** This work applies to the **builtin** SRS template only. If a custom SRS pack is active (`packs.srs` in config is not `"builtin"`), use `generate <pack-name>` instead — see [Work 17 — Custom Template Packs](17-custom-template-packs.md).

---

## What the SRS Contains

The generated SRS follows a standard structure:

- System overview and purpose
- Actors and their descriptions
- Use case list with detailed flows (normal flow, alternative flows, preconditions)
- Non-functional requirements (inferred from source material where possible)
- Glossary

The document is written to `docs/srs/`.

---

## Steps

### 1. Open chat

### 2. Type this

```
generate the SRS
```

or

```
generate SRS
```

---

### 3. Wait for the agent

The agent reads the graph and templates, then writes the SRS file. For a typical project (10–20 use cases), this takes 1–3 minutes.

---

### 4. Open and review the output

The agent will tell you the file path. Open it in your editor:

```
docs/srs/srs.md
```

Read through it. Pay attention to:

- Are all your actors listed correctly?
- Are the use case flows accurate?
- Does anything seem to be from the wrong context (hallucinated)?

---

### 5. Fix problems in the source, not the output

If the SRS has errors, the right fix is usually:

1. Update `docs/data-source/` files to be more accurate
2. Run `analyze data source` again
3. Run `validate the graph` again
4. Run `generate the SRS` again

Editing `docs/srs/srs.md` directly is fine for small wording changes. But if you edit it directly, those edits will be overwritten the next time you regenerate.

---

### 6. Add review comments (optional)

If you want the agent to track feedback on the SRS, you can ask:

```
add a comment to srs.md: the login flow is missing the "forgot password" path
```

The agent records this as a resolvable comment. See Work 15 for managing comments.

---

## Check

Open `docs/srs/srs.md`. It should have:

- A title and introduction section
- At least one actor
- Use cases with step-by-step flows

---

## Troubleshooting

**SRS is mostly empty or has placeholder text**

The graph doesn't have enough data. Go back to Work 06 and add more source material, then re-analyze.

**SRS has information from the wrong project**

The source documents in `docs/data-source/` may contain unrelated content. Remove files that aren't about this project and re-run analyze.

**Agent says it can't generate SRS**

Check that skills are enabled (Work 04) and that the graph has no critical errors (Work 07).

---

## Next

Go to [Work 09 — Index the Project](09-index-the-project.md).
