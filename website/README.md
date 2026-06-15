# AI Spector docs site (Docusaurus)

## Single source of truth

| Language | Edit here |
|----------|-----------|
| English | `website/docs/` |

```text
website/docs/              ← canonical course content
docs/course                → symlink → website/docs/   (npm + course serve)
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

## vs `course serve`

Same files via `docs/course` symlink:

```bash
npx ai-spector course serve --open
```
