# Language picker — ask, store, enforce

> **Multi-language projects:** Read **`.docops/docops.config.json`** for `primaryLanguage` and `languages[]`. You still **must confirm which `lang.code` this run uses** in the plan decisions table ([plan-and-briefing.md](./plan-and-briefing.md)) when multiple languages are configured. After confirmation, write to `docs/srs/{lang.code}/` (or the active doc type path). Do not read language from legacy `.ai-spector/docflow.config.json` when docops exists.
>
> This picker applies when `languages[]` is **missing** — legacy fallback.

When **no document language is stored** and the user did not name one in this request, run this flow **before any document write**. Do not generate document content until the user confirms a language.

Skip this flow when:

- User named a language in this request ("write in Japanese", "use Vietnamese")
- `.ai-spector/.docflow/config/workspace/language.json` already exists and has `documentLanguage` set (use it — do not re-ask)

## Step 1 — Check for stored preference

Read `.ai-spector/.docflow/config/workspace/language.json`. If the file exists and `documentLanguage` is a non-empty string, use that language for all document content. Skip the rest of this document.

## Step 2 — Ask the user

Post exactly this message and **stop**. Do not write any document content until the user replies.

```
What language should I use for all generated documents?

  1. English
  2. Japanese
  3. Vietnamese

Reply with **1**, **2**, or **3** — or type the language name directly.
Once saved, all document content — headings, body, tables, labels — will be written in that language consistently.
```

Accept: `1` / `2` / `3`, or the language name typed directly (case-insensitive). Map to the canonical value:

| Input | Stored as |
|-------|-----------|
| `1`, `english` | `English` |
| `2`, `japanese` | `Japanese` |
| `3`, `vietnamese` | `Vietnamese` |

Any other input: reply "Please choose 1 (English), 2 (Japanese), or 3 (Vietnamese)." and wait again.

## Step 3 — Persist the choice

When the user replies, create or overwrite `.ai-spector/.docflow/config/workspace/language.json`:

```json
{
  "version": 1,
  "documentLanguage": "<user's answer>",
  "setAt": "<ISO timestamp>"
}
```

Then continue with document generation.

## Changing the language later

If the user says "change language to X" or "switch to X" at any time:
- Accept only English, Japanese, or Vietnamese. For any other language, reply "Only English, Japanese, and Vietnamese are supported."
- Update `language.json` with the new value.
- Remind them that already-generated files keep their old language until regenerated.

---

## Enforcement rules (apply to every document write)

After the language is known, apply these rules for **every file written**:

1. **All content in the target language** — headings, body paragraphs, table cell values, labels, bullet text, notes, captions.
2. **ID tokens are never translated** — UC-01, F-03, API slugs (`POST /checkout`), screen IDs (S-01), graph node IDs, file paths, CLI commands, code blocks. These stay in their original form.
3. **Template structure labels are translated** — e.g. if the template says "## Overview", write the heading in the target language ("## 概要" for Japanese, "## Tổng quan" for Vietnamese, etc.).
4. **Never mix languages** — do not write an English heading with a non-English body, or vice versa. If you catch a mixed-language draft, fix it before writing.
5. **Quote source material faithfully, then translate inline** — if a `docs/data-source` file contains text in another language, you may reference its meaning in the target language rather than copying the foreign text into the output document.
