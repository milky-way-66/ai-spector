# Publishing to npm

## Before first publish

1. Set **`repository`**, **`homepage`**, and **`bugs`** in `package.json` to your Git repo (replace `milky-way-66/ai-spector`).
2. Bump version: `npm version patch` (or `minor` / `major`).
3. Confirm the package name **`ai-spector`** is free: https://www.npmjs.com/package/ai-spector

## Build

The published tarball includes compiled **`dist/`** (not TypeScript source). Build runs automatically on pack/publish:

```bash
npm run build
```

Or rely on lifecycle hooks:

```bash
npm pack --dry-run    # runs prepack → build, lists files
```

## Dry run (recommended)

```bash
npm pack --dry-run
```

You should see `dist/`, `schemas/`, `templates/`, `scaffold/`, `documents.json`, `README.md`, `LICENSE` — not `example/`, `src/`, or `docs/`.

Inspect the tarball:

```bash
npm pack
tar -tzf ai-spector-*.tgz | head -40
rm ai-spector-*.tgz
```

## Publish

```bash
npm login
npm publish
```

For a **scoped** package (e.g. `@myorg/ai-spector`), set `"name": "@myorg/ai-spector"` and keep `"publishConfig": { "access": "public" }`.

## After publish

Users install with:

```bash
npm install ai-spector
npx ai-spector init
```

## Troubleshooting

| Issue | Fix |
|-------|-----|
| `dist/cli.js` missing | Run `npm run build` before publish; check `prepack` ran |
| 403 / name taken | Rename in `package.json` or use a scope |
| Wrong files in tarball | Check `package.json` → `"files"` and `.npmignore` |
