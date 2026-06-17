# Course guide — for agents

Help users **learn** AI Spector. Open the browser course and deep-link to the right lesson.

## Open course

```bash
npx ai-spector course serve --open
```

- **Home (EN):** `http://127.0.0.1:4177/course/en/index`
- **Home (VI):** `http://127.0.0.1:4177/course/vi/index`
- **Lesson:** `http://127.0.0.1:4177/course/{locale}/<slug>`

Default locale: **en**. If the user writes in Vietnamese, deep-link `/course/vi/…`.

If port 4177 is busy, retry or suggest closing the other instance.

## Essentials intent → lesson map

| User asks about… | Open lesson (slug) | Exercise in chat |
|------------------|-------------------|------------------|
| Where to start, what is this | `01-welcome/01-what-is-ai-spector` | `open the course` |
| Install, setup, init | `02-get-started/01-setup-via-chat` | `setup ai-spector project` |
| How chat works | `03-chat-basics/01-how-chat-works` | `help me approve` |
| Approve confusion | `03-chat-basics/02-four-kinds-of-approve` | `help me approve` |
| Add one feature | `04-changes/01-add-or-change-requirement` | `I want to add login with Google` |
| Generate SRS | `05-generate/01-generate-srs` | `generate the SRS` |
| Document sign-off | `06-review/01-document-review` | `review documents` |
| Comment threads | `06-review/02-resolve-comments` | `resolve comments` |
| Resume / workspace | `07-everyday/01-tasks-and-workspace` | `active tasks` / `check my workspace` |

## Section index

| Section | Slug prefix | Lessons |
|---------|-------------|---------|
| Welcome | `01-welcome` | what is AI Spector |
| Get started | `02-get-started` | setup via chat |
| Chat basics | `03-chat-basics` | how chat works, four approves |
| Changes | `04-changes` | add or change requirement |
| Generate | `05-generate` | generate SRS |
| Review | `06-review` | document review, resolve comments |
| Everyday | `07-everyday` | tasks and workspace |

**Advanced** (graph, prototype, templates) — coming in phase 2; not linked in course nav yet.

## Agent response template

1. One sentence: what this lesson covers.
2. Link: `http://127.0.0.1:4177/course/{locale}/<slug>` (run serve first if needed).
3. Three bullet summary from the markdown — do **not** paste the full lesson.
4. Link **next lesson URL** after the user completes the exercise.

Chat phrases in lessons are **English** even in VI locale (agent routing).

## Learning vs doing

- **Learning** → this guide + `course serve --open`.
- **Doing** → task skill after the user finishes the lesson exercise.

When a new user says "get started", open lesson 2 **and** offer the setup exercise if the project is not ready.

## Course source files

| Item | Path |
|------|------|
| EN lessons | `website/docs/en/` |
| VI lessons | `website/docs/vi/` |
| Project override | `docs/course/en/` or `docs/course/vi/` |
