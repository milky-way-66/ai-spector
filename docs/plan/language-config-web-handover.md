# Language Config — Web Handover

> **Audience:** Web team building the documentation browser / review UI (release branch).
> **Your job:** Read language settings, resolve the correct markdown file per audience (team vs client), and expose language in the UI.
> **Not your job:** Add languages, run translation, or edit `docflow.config.json` on release branch.

> **Do not use `language.json`.** Language settings live only in `.ai-spector/docflow.config.json`. The file `.ai-spector/.docflow/config/workspace/language.json` is **deprecated** — it is not read by ai-spector core or the web app. Ignore it even if it exists in the repo scaffold.

**Related handovers:** [`review-system-handover.md`](./review-system-handover.md) (vote flow, registry) · [`detail-design-web-handover.md`](./detail-design-web-handover.md) (path resolution pattern for detail design)

---

## 1. The three language roles

Multi-language projects distinguish **generation**, **internal review**, and **client review**. **Do not conflate them.**

| Role | Config source | Who cares | Typical use |
|------|---------------|-----------|-------------|
| **Primary** | `languages[0]` — first entry in `languages[]` | Authors, agents | Document **generation** language (source of truth for AI writes) |
| **Internal** | `internalLanguage` (optional) | Internal team reviewers | Internal review track; team reads this language in the review UI |
| **Client** | `clientLanguage` (optional) | External client reviewers | Client review track; delivery language the client reads |

```text
Agents generate in primary (e.g. en)  →  translations (e.g. vi)  →  internal reviews internalLanguage (e.g. vi)  →  client reviews clientLanguage (e.g. jp)
```

**Rules:**

- `languages[0]` is always primary (generation). There is no separate `primaryLanguage` field.
- `internalLanguage` must be one of `languages[].code`. When omitted, internal review **defaults to primary**.
- `clientLanguage` must be one of `languages[].code`. When omitted, client review **defaults to primary**.
- Supported codes today: `en`, `jp`, `vi` (BCP-47-style short codes).

**Example** — generate in English, team reviews Vietnamese, client reviews Japanese:

```json
{
  "languages": [
    { "code": "en", "label": "English" },
    { "code": "vi", "label": "Vietnamese" },
    { "code": "jp", "label": "Japanese" }
  ],
  "internalLanguage": "vi",
  "clientLanguage": "jp"
}
```

| Audience | Preferred code | Resolves to |
|----------|----------------|-------------|
| Generation / agents | `en` (primary) | `docs/srs/en/01-overview.md` |
| Internal review | `vi` (internalLanguage) | `docs/srs/vi/01-overview.md` |
| Client review | `jp` (clientLanguage) | `docs/srs/jp/01-overview.md` |

**Example** — generate in English, both tracks use Vietnamese (no overrides):

```json
{
  "languages": [
    { "code": "en", "label": "English" },
    { "code": "vi", "label": "Vietnamese" }
  ],
  "clientLanguage": "vi"
}
```

| Audience | Preferred code | Notes |
|----------|----------------|-------|
| Generation | `en` (primary) | Agents write English |
| Internal review | `en` (primary — no `internalLanguage`) | Falls back to primary |
| Client review | `vi` (clientLanguage) | Client reads Vietnamese |

---

## 2. Config file

**Path (repo root):** `.ai-spector/docflow.config.json`

**Fields the web app needs:**

```json
{
  "version": 1,
  "languages": [
    { "code": "en", "label": "English" },
    { "code": "jp", "label": "Japanese" },
    { "code": "vi", "label": "Vietnamese" }
  ],
  "internalLanguage": "vi",
  "clientLanguage": "jp",
  "paths": { "...": "..." },
  "packs": { "...": "..." }
}
```

| Field | Type | Web usage |
|-------|------|-----------|
| `languages` | `{ code, label }[]` | Language switcher labels; folder names; **index 0 = primary (generation)** |
| `internalLanguage` | `en` \| `jp` \| `vi` (optional) | Internal review default; falls back to primary when absent |
| `clientLanguage` | `en` \| `jp` \| `vi` (optional) | Client review / client-facing default; falls back to primary when absent |

**TypeScript helpers** (ai-spector source — mirror this logic in the web app):

```typescript
interface LanguageConfig {
  code: "en" | "jp" | "vi";
  label: string;
}

interface DocflowConfig {
  languages: LanguageConfig[];
  internalLanguage?: "en" | "jp" | "vi";
  clientLanguage?: "en" | "jp" | "vi";
}

function primaryLanguage(config: DocflowConfig): LanguageConfig {
  return config.languages[0] ?? { code: "en", label: "English" };
}

function internalLanguage(config: DocflowConfig): LanguageConfig {
  if (config.internalLanguage) {
    const match = config.languages.find((l) => l.code === config.internalLanguage);
    if (match) return match;
  }
  return primaryLanguage(config);
}

function clientLanguage(config: DocflowConfig): LanguageConfig {
  if (config.clientLanguage) {
    const match = config.languages.find((l) => l.code === config.clientLanguage);
    if (match) return match;
  }
  return primaryLanguage(config);
}

type ReviewTrack = "internal" | "client";

function preferredLanguageCode(
  config: DocflowConfig,
  track: ReviewTrack = "internal",
): string {
  return track === "client"
    ? clientLanguage(config).code
    : internalLanguage(config).code;
}
```

Reference implementation: `src/core/config/load.ts` (`primaryLanguage`, `internalLanguage`, `clientLanguage`, `preferredLanguageCode`).

### Deprecated: `language.json` (do not use)

| | |
|--|--|
| **Path** | `.ai-spector/.docflow/config/workspace/language.json` |
| **Status** | **Deprecated** — legacy agent picker only; not part of the current language model |
| **Web action** | **Ignore completely** — do not read, display, or write this file |

That file stored a single `documentLanguage` string (e.g. `"English"`) from an old one-language-at-a-time flow. It has **no** `internalLanguage`, **no** `clientLanguage`, and **no** relation to review tracks.

**Single source of truth for web:**

```text
.ai-spector/docflow.config.json   ← languages[], internalLanguage, clientLanguage
```

If both files exist, use **only** `docflow.config.json`. Never merge or fall back to `language.json`.

---

## 3. On-disk layout

Documents live under language subfolders when the project is multi-language:

```text
docs/
  srs/
    en/
      01-overview.md
    vi/
      01-overview.md
  basic-design/
    en/
      screen-list.md
    vi/
      screen-list.md
  detail-design/
    en/
      feature-list.md
      features/f-01-checkout.md
    vi/
      ...
```

| Doc layer | Pattern |
|-----------|---------|
| SRS | `docs/srs/{code}/…` |
| Basic design | `docs/basic-design/{code}/…` |
| Detail design | `docs/detail-design/{code}/…` |

**Logical paths never include language.** URLs and registry keys use `srs/01-overview`, not `srs/en/01-overview`.

**Single-language projects** may use a flat layout (`docs/srs/01-overview.md` with no `{code}/` segment). The resolver tries flat paths first.

---

## 4. Resolving logical path → file

Use the same algorithm as ai-spector `resolveReviewDocPath` (`src/core/reviews/doc-resolve.ts`).

**Input:** `logicalPath` (e.g. `srs/01-overview`), `track` (`internal` \| `client`), `config`.

**Steps:**

1. Build flat path: `docs/srs/01-overview.md` (map `bd/` → `basic-design/`, `dd/` → `detail-design/`).
2. If flat file exists → use it (single-language layout).
3. Else try **preferred language for track**:
   - `internal` → `internalLanguage` or primary
   - `client` → `clientLanguage` or primary
4. Else try **primary** (generation language — when preferred differs from primary).
5. Else try **any other** configured language (first match on disk).

```typescript
async function resolveDocPath(
  projectRoot: string,
  logicalPath: string,
  config: DocflowConfig,
  track: ReviewTrack = "internal",
): Promise<string> {
  const flat = logicalPathToFlatDocPath(logicalPath); // e.g. docs/srs/01-overview.md
  if (await exists(join(projectRoot, flat))) return flat;

  const preferred = preferredLanguageCode(config, track);
  const primary = primaryLanguage(config).code;
  const prefix = flat.match(/^(docs\/[^/]+\/)/)?.[0];
  if (!prefix) throw new Error("Cannot resolve");

  const tryLang = (code: string) =>
    flat.replace(prefix, `${prefix}${code}/`);

  for (const code of [preferred, ...(preferred !== primary ? [primary] : []),
    ...config.languages.map((l) => l.code).filter((c) => c !== preferred && c !== primary)]) {
    const candidate = tryLang(code);
    if (await exists(join(projectRoot, candidate))) return candidate;
  }

  throw new Error(`Document not found: ${logicalPath}`);
}
```

### Which track when?

| UI context | `track` | Language used |
|------------|---------|---------------|
| Internal review queue | `internal` | `internalLanguage` or primary |
| Client review queue, client portal | `client` | `clientLanguage` or primary |
| Language switcher (user override) | — | User-selected `code` from `languages[]` |

When the user picks a language in a switcher, skip track logic and resolve directly to `docs/{type}/{selectedCode}/…`.

---

## 5. Review UI integration

### Registry `docPath` is one path only

`registry.json` stores a single `docPath` per logical document (discovered at index time). It may point at primary, client, or whichever file was indexed last — **do not assume it matches the current viewer's track.**

| Field | Web writes? | Web reads for markdown? |
|-------|-------------|-------------------------|
| `logicalPath` | No | Sidebar key, URLs |
| `docPath` | **No** (ops/pipeline) | Fallback only; prefer re-resolve per track |
| `contentHash` | No | Staleness check for **that** `docPath` file |

**Recommended:** On document open, call your resolver with the active track (or selected language) instead of blindly reading `docPath`. Use `docPath` only when you have no config or as a fast path when it already matches the preferred language.

### Pending queue jobs

Job ids: `"{logicalPath}:internal"` and `"{logicalPath}:client"`. The track suffix tells you which language to show when opening from the queue:

- `:internal` → `preferredLanguageCode(config, "internal")`
- `:client` → `preferredLanguageCode(config, "client")`

### Review flow (reminder)

```
Internal review (internalLanguage)  →  Client review (clientLanguage)  →  approved
```

See [`review-system-handover.md`](./review-system-handover.md) for votes and quorum.

---

## 6. Suggested UI

### Language metadata bar

Show on document pages when `languages.length > 1`:

```text
Generation: English (en)     Internal review: Vietnamese (vi)     Client review: Vietnamese (vi)
Team language: English (en)    Internal: Vietnamese (vi)            Client: Vietnamese (vi)
```

Or badges: **Generate: EN** · **Internal: VI** · **Client: VI**

### Language switcher

- List all `languages[]` with `label` + `code`.
- Mark primary: `(generation)` on `languages[0]`.
- Mark internal default: `(internal)` on the entry matching `internalLanguage` (or primary when unset).
- Mark client default: `(client)` on the entry matching `clientLanguage` (or primary when unset).
- Switching language re-resolves the same `logicalPath` to `docs/.../{code}/...`.

### Browse vs review defaults

| Mode | Default language |
|------|------------------|
| Team / internal app | `internalLanguage` or primary |
| Client portal | `clientLanguage` or primary |
| Explicit switcher | User choice |

### Missing translation

If preferred file does not exist but another language does (resolver step 5), either:

- Show the fallback file with a banner: *"Vietnamese version not available — showing English."*, or
- Show empty state: *"Not translated yet."*

Pick one product behavior and stay consistent. ai-spector resolver **falls back** to another language; the UI should surface that fallback explicitly.

---

## 7. Stripping language from paths (listing)

When walking disk or building a doc list, normalize repo paths to logical paths:

```text
docs/srs/vi/01-overview.md  →  srs/01-overview
docs/detail-design/en/features/f-01.md  →  detail-design/features/f-01
```

Algorithm (`docRelPathToLogicalPath` in `src/core/reviews/discover.ts`):

1. Strip `docs/` prefix and `.md` suffix.
2. If segment after doc-type matches a configured `languages[].code`, remove it.
3. Prefix `srs/`, `basic-design/`, or `detail-design/` (normalize `bd/` / `dd/` aliases).

**Deduplicate by logical path** — one sidebar row per `logicalPath`, not per language file.

---

## 8. Translation queue (context only)

When primary docs change, ai-spector enqueues translation sync jobs for other languages. Web does **not** run translations, but may show staleness:

| Source | Purpose |
|--------|---------|
| `.ai-spector/.docflow/translation-queue/pending.json` | Docs with outdated secondary languages |
| `lang_queue` MCP / `npx ai-spector lang queue pending --json` | Same data (ops tooling) |

Optional UI: badge *"Translation pending"* when a pending job exists for the logical path and the viewer's language is an outdated target. Not required for v1 browse/review.

---

## 9. Edge cases

| Case | Handling |
|------|----------|
| Single language (`languages.length === 1`) | Hide switcher; flat or `{lang}/` both work |
| `internalLanguage` unset | Internal track uses primary |
| `clientLanguage` unset | Client track uses primary |
| `clientLanguage` not in `languages[]` | Treated as unset (invalid values stripped at load) |
| Flat layout (no `{lang}/`) | Resolver step 1 succeeds |
| Both `en` and `vi` exist | Resolver picks by track, not "newest" |
| `logicalPath` in URL has no language segment | Correct — language comes from config + track |
| `language.json` present in repo | **Ignore** — deprecated; not used by web or ai-spector core |

---

## 10. Examples

### A. EN generation, VI internal, VI client (common)

```json
{
  "languages": [
    { "code": "en", "label": "English" },
    { "code": "vi", "label": "Vietnamese" }
  ],
  "internalLanguage": "vi",
  "clientLanguage": "vi"
}
```

| Action | File opened |
|--------|-------------|
| Agent generates `srs/01-overview` | `docs/srs/en/01-overview.md` |
| Team opens from internal queue | `docs/srs/vi/01-overview.md` |
| Client opens from client queue | `docs/srs/vi/01-overview.md` |

### B. EN generation, VI internal, JP client

```json
{
  "languages": [
    { "code": "en", "label": "English" },
    { "code": "vi", "label": "Vietnamese" },
    { "code": "jp", "label": "Japanese" }
  ],
  "internalLanguage": "vi",
  "clientLanguage": "jp"
}
```

| Action | File opened |
|--------|-------------|
| Generation | `docs/srs/en/…` |
| Internal review | `docs/srs/vi/…` |
| Client review | `docs/srs/jp/…` |

### C. Japanese primary, no overrides

```json
{
  "languages": [
    { "code": "jp", "label": "Japanese" },
    { "code": "en", "label": "English" }
  ]
}
```

Both internal and client tracks prefer `jp` (primary). Other langs available via switcher only.

### D. English only

```json
{
  "languages": [{ "code": "en", "label": "English" }]
}
```

No `clientLanguage`. All tracks use `docs/srs/en/…` or flat `docs/srs/…`.

---

## 11. Smoke test (release bundle)

1. Read `.ai-spector/docflow.config.json` — confirm `languages[]`, `internalLanguage`, and optional `clientLanguage`.
2. Note `languages[0].code` for generation; `internalLanguage ?? primary` for internal; `clientLanguage ?? primary` for client.
3. Open same `logicalPath` from internal queue → internal language file content.
4. Open from client queue → client language file content (when translation exists).
5. Toggle language switcher → paths change under `docs/{type}/{code}/`.
6. Confirm sidebar lists one row per `logicalPath`, not per language folder.

**CLI (ops, not web):**

```bash
# Show configured languages (inspect config file directly)
cat .ai-spector/docflow.config.json

# Set internal language (authoring branch only)
npx ai-spector lang set-internal vi

# Set client language (authoring branch only)
npx ai-spector lang set-client jp

# Add a language (authoring branch only)
npx ai-spector lang add jp
```

---

## 12. Quick reference

| Question | Answer |
|----------|--------|
| Where is config? | `.ai-spector/docflow.config.json` only |
| Use `language.json`? | **No** — deprecated; ignore if present |
| Generation language? | `languages[0]` |
| Internal review language? | `internalLanguage` or `languages[0]` |
| Client review language? | `clientLanguage` or `languages[0]` |
| URL language segment? | No — use logical paths |
| Internal review file? | `preferredLanguageCode(config, "internal")` |
| Client review file? | `preferredLanguageCode(config, "client")` |
| Supported codes | `en`, `jp`, `vi` |
