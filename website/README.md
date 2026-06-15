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
npm start              # http://localhost:3000/docs/
npm run build
```

From repo root: `npm run docs:dev`

## Languages

- **English:** `/docs/`
- **Tiếng Việt:** `/vi/docs/` (locale dropdown)

## vs `course serve`

Same files via `docs/course` symlink:

```bash
npx ai-spector course serve --open
npx ai-spector course serve --open --lang vi
```
