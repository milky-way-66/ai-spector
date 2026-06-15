# AI Spector docs site (Docusaurus)

## Single source of truth

| Language | Edit here |
|----------|-----------|
| English | `website/docs/` |
| Tiếng Việt | `website/docs/vi/` |

```text
website/docs/              ← canonical (EN + vi/)
docs/course                → symlink → website/docs/   (npm + course serve)
website/i18n/.../current/  → rsync mirror of docs/vi/ (generated, gitignored)
```

**Do not edit** `website/i18n/vi/.../current/` — it is rebuilt on every `npm start` / `npm run build`.

## Commands

```bash
cd website && npm install
npm run preview          # build + serve — English & Tiếng Việt (recommended)
npm start                # dev server, English only (fast HMR)
npm run start:vi         # dev server, Tiếng Việt only
npm run build
```

From repo root:

```bash
npm run docs:dev         # preview — both locales work
npm run docs:dev:en      # fast English-only dev
npm run docs:dev:vi      # Vietnamese-only dev
```

**Note:** `npm start` loads one locale at a time. Use `npm run preview` or `npm run start:vi` to browse `/vi/docs/` without 404.

## Languages

- **English:** `/docs/`
- **Tiếng Việt:** `/vi/docs/` (locale dropdown)

## vs `course serve`

Same files via `docs/course` symlink:

```bash
npx ai-spector course serve --open
npx ai-spector course serve --open --lang vi
```
