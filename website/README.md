# AI Spector docs site (Docusaurus)

## Single source of truth

| Language | Edit here |
|----------|-----------|
| English | `website/docs/en/` |
| Vietnamese | `website/docs/vi/` |

```text
website/docs/en/           ← EN course (Docusaurus default locale + course serve)
website/docs/vi/           ← VI course (Docusaurus vi locale + course serve)
website/i18n/vi/.../current → symlink → docs/vi/
docs/course                → symlink → website/docs/   (override: docs/course/en/, docs/course/vi/)
```

## Commands

```bash
cd website && npm install
npm run preview          # build + serve (recommended)
npm start                # dev server with HMR
npm run build
```

From repo root:

```bash
npm run docs:dev         # preview
npm run docs:dev:en      # fast dev server
```

- **EN:** `http://localhost:3000/docs/`
- **VI:** `http://localhost:3000/vi/docs/`

## vs `course serve`

Same markdown files; interactive course UI with exercises:

```bash
npx ai-spector course serve --open
```

- **EN:** `http://127.0.0.1:4177/course/en/index`
- **VI:** `http://127.0.0.1:4177/course/vi/index`
