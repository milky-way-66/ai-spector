# Testing

This package uses [Vitest](https://vitest.dev/) for unit tests. Tests live outside `src/` so they never ship in `dist/`.

## Layout

Mirror `src/` under `tests/`:

```text
src/graph/InMemoryGraph.ts   →   tests/graph/InMemoryGraph.test.ts
src/foo/bar.ts               →   tests/foo/bar.test.ts
```

- **Do not** colocate `*.test.ts` next to source files in `src/`.
- **Do not** use `__tests__` folders; keep one root `tests/` tree.

## Naming and imports

- File suffix: `*.test.ts`
- Import production code with ESM paths and `.js` extensions, e.g. `../../src/graph/InMemoryGraph.js`
- Import types from `../../src/types.js` (or the module that defines them)

## Commands

| Command | Purpose |
|---------|---------|
| `npm test` | Run all tests once |
| `npm run test:watch` | Watch mode during development |
| `npm run build` | Compile `src/` only (`tsc`; tests are excluded) |

## What to test

| Layer | Location | Notes |
|-------|----------|--------|
| **Unit** | `tests/**` | Pure logic: graph, validation, parsers, utilities. Prefer these. |
| **Integration** | `tests/integration/**` (when needed) | CLI subprocesses, filesystem fixtures, multi-module flows. Keep few and focused. |

Avoid testing Commander wiring or one-line CLI passthrough unless behavior is non-trivial.

## Mocking

- Prefer real objects and small in-memory fixtures over mocks.
- Mock only external I/O: `fs`, `child_process`, network, or third-party SDKs.
- Do not mock modules under test; test the public API of `src/` exports.

## TypeScript

- **Build:** `tsconfig.json` — `include` is `src/**/*` only; `tests` is excluded.
- **IDE / typecheck tests:** `tsconfig.test.json` includes `src` and `tests` with `noEmit: true`.

## Agents and contributors

Cursor rule: [`.cursor/rules/testing.mdc`](../.cursor/rules/testing.mdc) — apply when adding or editing tests.
