# AI Spector Upgrade Workflow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship `npx ai-spector upgrade` (scan → apply → validate → status) plus `ai-spector-upgrade` agent skill so users can safely bump package version, sync scaffold, backfill config, and complete a version-ranged checklist.

**Architecture:** New `src/core/upgrade/` module mirrors `src/core/adopt/` (paths, setup state, scan, apply, validate). Package ships `upgrade-checklist.json`. `scaffoldVersion` in `docflow.config.json` tracks last synced package version. CLI registered via `registerUpgradeCommand`; MCP mirrors adopt tool names.

**Tech Stack:** TypeScript, Commander CLI, Vitest, `semver` (new dependency), existing `sync-cursor`/`sync-claude`/`hooks install`/`runSetupCheck`.

**Spec:** [`docs/superpowers/specs/2026-06-18-ai-spector-upgrade-design.md`](../specs/2026-06-18-ai-spector-upgrade-design.md)

---

## File map

| File | Responsibility |
|------|----------------|
| `src/core/upgrade/types.ts` | `UpgradeScanResult`, `UpgradeSetupState`, checklist types |
| `src/core/upgrade/paths.ts` | `.ai-spector/.docflow/upgrade/*` helpers |
| `src/core/upgrade/package-version.ts` | Read installed `ai-spector` version from package.json |
| `src/core/upgrade/checklist.json` | Canonical upgrade checklist (copied to dist) |
| `src/core/upgrade/checklist.ts` | Load + validate checklist; filter by semver/editors |
| `src/core/upgrade/detectors.ts` | Built-in scanners (config schema, hook, mcp, scaffold presence) |
| `src/core/upgrade/detect.ts` | Evaluate checklist `detect` rules per item |
| `src/core/upgrade/scan.ts` | `runUpgradeScan()` |
| `src/core/upgrade/apply.ts` | `runUpgradeApply()` — auto + config patches |
| `src/core/upgrade/validate.ts` | `validateUpgrade()` — gate + stamp `scaffoldVersion` |
| `src/core/upgrade/setup.ts` | `loadUpgradeSetup`, `markUpgradeSetupItem` |
| `src/core/upgrade/stamp.ts` | `readScaffoldVersion`, `stampScaffoldVersion` |
| `src/core/operations/upgrade.ts` | Commander subcommands |
| `src/interfaces/cli/format/upgrade.ts` | Human-readable formatters |
| `src/interfaces/mcp/tools/upgrade.ts` | MCP handlers |
| `src/core/config/types.ts` | Add `scaffoldVersion?: string` |
| `src/core/config/load.ts` | Pass through `scaffoldVersion` |
| `src/core/operations/init.ts` | Stamp on init |
| `src/core/operations/sync-cursor.ts` | Stamp after sync |
| `src/core/operations/sync-claude.ts` | Stamp after sync |
| `src/core/operations/setup.ts` | `scaffold-version` audit step |
| `scaffold/cursor/skills/ai-spector-upgrade/` | Skill + runbook |
| `tests/upgrade/*.test.ts` | Unit + integration |
| `tests/fixtures/upgrade-stale-scaffold/` | Fixture project |

---

### Task 1: Semver dependency + upgrade types and paths

**Files:**
- Modify: `package.json` (add `semver` dependency)
- Create: `src/core/upgrade/types.ts`
- Create: `src/core/upgrade/paths.ts`
- Create: `src/core/upgrade/package-version.ts`
- Test: `tests/upgrade/paths.test.ts`

- [ ] **Step 1: Add semver**

```bash
npm install semver
npm install -D @types/semver
```

- [ ] **Step 2: Write the failing paths test**

```typescript
// tests/upgrade/paths.test.ts
import { describe, expect, it } from "vitest";
import { upgradeArtifactPaths } from "@/core/upgrade/paths.js";

describe("upgradeArtifactPaths", () => {
  it("returns paths under .ai-spector/.docflow/upgrade/", () => {
    const p = upgradeArtifactPaths("/proj");
    expect(p.dir).toBe("/proj/.ai-spector/.docflow/upgrade");
    expect(p.scanResult).toBe("/proj/.ai-spector/.docflow/upgrade/scan-result.json");
    expect(p.setup).toBe("/proj/.ai-spector/.docflow/upgrade/upgrade-setup.json");
  });
});
```

- [ ] **Step 3: Run test — expect FAIL**

Run: `npm test -- tests/upgrade/paths.test.ts`

- [ ] **Step 4: Implement paths + types + package version**

```typescript
// src/core/upgrade/paths.ts
import { join } from "node:path";

export function upgradeDir(root: string): string {
  return join(root, ".ai-spector", ".docflow", "upgrade");
}

export function upgradeArtifactPaths(root: string) {
  const dir = upgradeDir(root);
  return {
    dir,
    scanResult: join(dir, "scan-result.json"),
    setup: join(dir, "upgrade-setup.json"),
  };
}
```

```typescript
// src/core/upgrade/package-version.ts
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);

export function installedPackageVersion(): string {
  const pkg = require("../../../package.json") as { version: string };
  return pkg.version;
}
```

```typescript
// src/core/upgrade/types.ts
export type UpgradeItemKind = "auto" | "config" | "agent" | "manual";
export type UpgradeSeverity = "required" | "recommended";
export type UpgradeEditor = "cursor" | "claude";

export interface UpgradeDetectRule {
  type: string;
  target?: string;
  minJump?: "patch" | "minor" | "major";
  path?: string;
  key?: string;
  default?: unknown;
  from?: string;
  to?: string;
}

export interface UpgradeApplyRule {
  command?: "sync-cursor" | "sync-claude" | "hooks install";
  type?: "config-set" | "config-rename";
  key?: string;
  value?: unknown;
  from?: string;
  to?: string;
}

export interface UpgradeChecklistItem {
  id: string;
  since: string;
  until?: string | null;
  kind: UpgradeItemKind;
  severity: UpgradeSeverity;
  title: string;
  detect: UpgradeDetectRule;
  apply?: UpgradeApplyRule;
  agentGuide?: string;
  userGuide?: string;
  changelogRef?: string;
  editors?: UpgradeEditor[];
}

export interface UpgradeChecklist {
  version: 1;
  packageMinVersion: string;
  items: UpgradeChecklistItem[];
}

export interface UpgradeFinding {
  id: string;
  status: "ok" | "missing" | "stale" | "warning";
  severity: UpgradeSeverity;
  message: string;
  fix?: "auto" | "agent" | "manual";
  detail?: string;
}

export interface UpgradeScanResult {
  scannedAt: string;
  fromVersion: string;
  toVersion: string;
  editors: UpgradeEditor[];
  applicableItems: string[];
  autoFixable: string[];
  findings: UpgradeFinding[];
  ready: boolean;
}

export interface UpgradeSetupItem {
  done: boolean;
  at: string | null;
  note?: string;
}

export interface UpgradeSetupState {
  version: 1;
  fromVersion: string | null;
  toVersion: string | null;
  startedAt: string | null;
  completedAt: string | null;
  items: Record<string, UpgradeSetupItem>;
}

export const UPGRADE_GATE_ITEMS = [
  "upgrade.confirmed",
  "upgrade.npm-installed",
  "upgrade.auto-applied",
  "upgrade.complete",
] as const;
```

- [ ] **Step 5: Run test — expect PASS**

Run: `npm test -- tests/upgrade/paths.test.ts`

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json src/core/upgrade/ tests/upgrade/paths.test.ts
git commit -m "feat(upgrade): add types, paths, and semver dependency"
```

---

### Task 2: scaffoldVersion in config + stamp helper

**Files:**
- Modify: `src/core/config/types.ts`
- Modify: `src/core/config/load.ts`
- Create: `src/core/upgrade/stamp.ts`
- Test: `tests/upgrade/stamp.test.ts`

- [ ] **Step 1: Write failing stamp test**

```typescript
// tests/upgrade/stamp.test.ts
import { describe, expect, it } from "vitest";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { readScaffoldVersion, stampScaffoldVersion } from "@/core/upgrade/stamp.js";
import { withTempDir } from "../helpers/temp-project.js";

describe("scaffoldVersion stamp", () => {
  it("returns 0.0.0 when field missing", async () => {
    await withTempDir(async (root) => {
      await mkdir(join(root, ".ai-spector"), { recursive: true });
      await writeFile(
        join(root, ".ai-spector/docflow.config.json"),
        JSON.stringify({ version: 1, languages: [{ code: "en", label: "English" }] }),
        "utf8",
      );
      expect(await readScaffoldVersion(root)).toBe("0.0.0");
    });
  });

  it("writes scaffoldVersion on stamp", async () => {
    await withTempDir(async (root) => {
      await mkdir(join(root, ".ai-spector"), { recursive: true });
      await writeFile(
        join(root, ".ai-spector/docflow.config.json"),
        JSON.stringify({ version: 1, languages: [{ code: "en", label: "English" }] }),
        "utf8",
      );
      await stampScaffoldVersion(root, "0.8.85");
      expect(await readScaffoldVersion(root)).toBe("0.8.85");
    });
  });
});
```

- [ ] **Step 2: Run test — expect FAIL**

- [ ] **Step 3: Add type + load + stamp implementation**

In `DocflowConfig` add:

```typescript
/** Last ai-spector package version that synced project scaffold */
scaffoldVersion?: string;
```

In `loadDocflowConfig`, spread `...(raw.scaffoldVersion ? { scaffoldVersion: raw.scaffoldVersion } : {})`.

```typescript
// src/core/upgrade/stamp.ts
import { join } from "node:path";
import { loadDocflowConfig } from "../config/load.js";
import { pathExists, readJson, writeJson } from "../util/fs.js";

export async function readScaffoldVersion(root: string): Promise<string> {
  const configPath = join(root, ".ai-spector", "docflow.config.json");
  if (!(await pathExists(configPath))) {
    return "0.0.0";
  }
  const raw = await readJson<{ scaffoldVersion?: string }>(configPath);
  return raw.scaffoldVersion ?? "0.0.0";
}

export async function stampScaffoldVersion(root: string, version: string): Promise<void> {
  const configPath = join(root, ".ai-spector", "docflow.config.json");
  const raw = await readJson<Record<string, unknown>>(configPath);
  await writeJson(configPath, { ...raw, scaffoldVersion: version });
}
```

- [ ] **Step 4: Run test — expect PASS**

- [ ] **Step 5: Commit**

```bash
git add src/core/config/types.ts src/core/config/load.ts src/core/upgrade/stamp.ts tests/upgrade/stamp.test.ts
git commit -m "feat(upgrade): add scaffoldVersion to docflow config"
```

---

### Task 3: Upgrade checklist JSON + loader

**Files:**
- Create: `src/core/upgrade/checklist.json`
- Create: `src/core/upgrade/checklist.ts`
- Test: `tests/upgrade/checklist.test.ts`
- Modify: `package.json` `files` array — ensure `dist` includes JSON (copy via build or import assert)

- [ ] **Step 1: Write failing checklist test**

```typescript
// tests/upgrade/checklist.test.ts
import { describe, expect, it } from "vitest";
import { loadUpgradeChecklist, filterApplicableItems } from "@/core/upgrade/checklist.js";

describe("upgrade checklist", () => {
  it("loads items with unique ids", async () => {
    const checklist = await loadUpgradeChecklist();
    const ids = checklist.items.map((i) => i.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("filters by semver since", async () => {
    const checklist = await loadUpgradeChecklist();
    const applicable = filterApplicableItems(checklist.items, {
      fromVersion: "0.5.0",
      toVersion: "0.8.85",
      editors: ["cursor"],
    });
    expect(applicable.some((i) => i.id === "UPG-001")).toBe(true);
    expect(applicable.every((i) => i.id !== "UPG-999-fake")).toBe(true);
  });
});
```

- [ ] **Step 2: Run test — expect FAIL**

- [ ] **Step 3: Create checklist.json** (seed from spec §5)

Include at minimum: `UPG-001` sync-cursor, `UPG-002` sync-claude, `UPG-010` packs.basicDesign, `UPG-011` packs.active rename, `UPG-020`/`UPG-021` agent index/validate, `UPG-030`/`UPG-031` manual MCP/skills, `UPG-040` hooks install.

- [ ] **Step 4: Implement checklist.ts**

```typescript
// src/core/upgrade/checklist.ts
import { createRequire } from "node:module";
import semver from "semver";
import type { UpgradeChecklist, UpgradeChecklistItem, UpgradeEditor } from "./types.js";

const require = createRequire(import.meta.url);

export async function loadUpgradeChecklist(): Promise<UpgradeChecklist> {
  const data = require("./checklist.json") as UpgradeChecklist;
  if (data.version !== 1) {
    throw new Error(`Unsupported upgrade checklist version: ${data.version}`);
  }
  return data;
}

export function filterApplicableItems(
  items: UpgradeChecklistItem[],
  opts: { fromVersion: string; toVersion: string; editors: UpgradeEditor[] },
): UpgradeChecklistItem[] {
  const from = semver.coerce(opts.fromVersion)?.version ?? "0.0.0";
  const to = semver.coerce(opts.toVersion)?.version ?? opts.toVersion;

  if (semver.lte(to, from)) {
    return [];
  }

  return items.filter((item) => {
    const since = semver.coerce(item.since)?.version ?? item.since;
    if (semver.gte(from, since)) return false;
    if (item.until) {
      const until = semver.coerce(item.until)?.version ?? item.until;
      if (semver.gte(from, until)) return false;
    }
    if (item.editors && item.editors.length > 0) {
      return item.editors.some((e) => opts.editors.includes(e));
    }
    return true;
  });
}
```

Ensure `tsconfig` resolves JSON imports (project already uses `with { type: "json" }` elsewhere — match that pattern if require fails in ESM).

- [ ] **Step 5: Run test — expect PASS**

- [ ] **Step 6: Commit**

```bash
git add src/core/upgrade/checklist.json src/core/upgrade/checklist.ts tests/upgrade/checklist.test.ts
git commit -m "feat(upgrade): add package upgrade checklist"
```

---

### Task 4: Built-in detectors + editor detection

**Files:**
- Create: `src/core/upgrade/editors.ts`
- Create: `src/core/upgrade/detectors.ts`
- Test: `tests/upgrade/detectors.test.ts`

- [ ] **Step 1: Write failing detector tests**

Test cases:
- `detectEditors` finds `cursor` when `.cursor/skills/ai-spector/SKILL.md` exists
- `scanConfigSchema` flags missing `packs.basicDesign` on legacy config
- `scanConfigDrift` flags `packs.active` present

- [ ] **Step 2: Run — expect FAIL**

- [ ] **Step 3: Implement editors.ts**

```typescript
// src/core/upgrade/editors.ts
import { join } from "node:path";
import { pathExists } from "../util/fs.js";
import type { UpgradeEditor } from "./types.js";

export async function detectEditors(root: string): Promise<UpgradeEditor[]> {
  const editors: UpgradeEditor[] = [];
  if (await pathExists(join(root, ".cursor/skills/ai-spector/SKILL.md"))) {
    editors.push("cursor");
  }
  if (
    (await pathExists(join(root, ".claude/skills/ai-spector/skill.md"))) ||
    (await pathExists(join(root, "CLAUDE.md")))
  ) {
    editors.push("claude");
  }
  return editors;
}
```

- [ ] **Step 4: Implement detectors.ts**

Export functions returning `UpgradeFinding[]`:
- `scanScaffoldVersion(from, to)` — stale when `semver.lt(from, to)`
- `scanConfigSchema(root)` — read raw config; check `packs.srs`, `packs.basicDesign`, `paths.templates`
- `scanConfigDrift(root)` — warn on `packs.active`
- `scanScaffoldPresence(root, editors)` — core skill dir exists
- `scanHook(root)` — reuse `HOOK_MARKER` pattern from `setup.ts`
- `scanMcpConfig(root, editors)` — `.cursor/mcp.json` / `.mcp.json` contains ai-spector

- [ ] **Step 5: Run tests — expect PASS**

- [ ] **Step 6: Commit**

```bash
git add src/core/upgrade/editors.ts src/core/upgrade/detectors.ts tests/upgrade/detectors.test.ts
git commit -m "feat(upgrade): add built-in config and scaffold detectors"
```

---

### Task 5: Checklist detect evaluation + scan

**Files:**
- Create: `src/core/upgrade/detect.ts`
- Create: `src/core/upgrade/scan.ts`
- Test: `tests/upgrade/scan.test.ts`
- Create: `tests/fixtures/upgrade-stale-scaffold/` (minimal init + `scaffoldVersion: "0.4.0"`, old packs shape)

- [ ] **Step 1: Fixture project**

```
tests/fixtures/upgrade-stale-scaffold/
  .ai-spector/docflow.config.json   # scaffoldVersion 0.4.0, packs: { srs: "builtin" } only
  .cursor/skills/ai-spector/SKILL.md  # minimal stub file
  package.json                        # ai-spector devDep optional
```

- [ ] **Step 2: Write failing scan integration test**

```typescript
// tests/upgrade/scan.test.ts
import { describe, expect, it } from "vitest";
import { join } from "node:path";
import { runUpgradeScan } from "@/core/upgrade/scan.js";

const FIXTURE = join(import.meta.dirname, "../fixtures/upgrade-stale-scaffold");

describe("runUpgradeScan", () => {
  it("detects applicable items for stale scaffold", async () => {
    const result = await runUpgradeScan({
      root: FIXTURE,
      toVersion: "0.8.85",
    });
    expect(result.fromVersion).toBe("0.4.0");
    expect(result.applicableItems).toContain("UPG-010");
    expect(result.ready).toBe(false);
  });

  it("rejects downgrade", async () => {
    await expect(
      runUpgradeScan({ root: FIXTURE, toVersion: "0.1.0" }),
    ).rejects.toThrow(/downgrade/i);
  });
});
```

- [ ] **Step 3: Implement detect.ts** — `evaluateItemDetect(root, item, ctx)` switch on `detect.type`

- [ ] **Step 4: Implement scan.ts**

```typescript
// src/core/upgrade/scan.ts
export async function runUpgradeScan(opts: {
  root: string;
  toVersion?: string;
}): Promise<UpgradeScanResult> {
  const root = resolve(opts.root);
  const marker = join(root, ".ai-spector/docflow.config.json");
  if (!(await pathExists(marker))) {
    throw new Error(`Project not initialized. Run: npx ai-spector init`);
  }
  const fromVersion = await readScaffoldVersion(root);
  const toVersion = opts.toVersion ?? installedPackageVersion();
  if (semver.lte(toVersion, fromVersion)) {
    throw new Error(`Downgrade unsupported (${fromVersion} → ${toVersion})`);
  }
  const editors = await detectEditors(root);
  const checklist = await loadUpgradeChecklist();
  const applicable = filterApplicableItems(checklist.items, { fromVersion, toVersion, editors });
  // merge built-in detector findings + per-item detect
  // write scan-result.json
  // ready = no required findings with status missing/stale
}
```

- [ ] **Step 5: Run tests — expect PASS**

- [ ] **Step 6: Commit**

```bash
git add src/core/upgrade/detect.ts src/core/upgrade/scan.ts tests/upgrade/scan.test.ts tests/fixtures/upgrade-stale-scaffold/
git commit -m "feat(upgrade): implement upgrade scan"
```

---

### Task 6: Setup state + apply

**Files:**
- Create: `src/core/upgrade/setup.ts`
- Create: `src/core/upgrade/apply.ts`
- Test: `tests/upgrade/apply.test.ts`

- [ ] **Step 1: Write failing apply test**

Test `runUpgradeApply({ root, auto: true })` on fixture:
- Patches `packs.basicDesign` into config
- Mocks or spies `runSyncCursor` — use vi.spyOn on `@/core/operations/sync-cursor.js`

- [ ] **Step 2: Implement setup.ts** — mirror `src/core/adopt/setup.ts`:
- `emptyUpgradeSetup()`, `loadUpgradeSetup()`, `markUpgradeSetupItem()`
- Initialize gate items from `UPGRADE_GATE_ITEMS`

- [ ] **Step 3: Implement apply.ts**

```typescript
export async function runUpgradeApply(opts: {
  root: string;
  auto?: boolean;
  items?: string[];
}): Promise<{ applied: string[]; failed: Array<{ id: string; error: string }> }> {
  const scan = await runUpgradeScan({ root: opts.root });
  const setup = await loadUpgradeSetup(opts.root);
  const targetIds = opts.items ?? (opts.auto !== false ? scan.autoFixable : []);
  const checklist = await loadUpgradeChecklist();
  const byId = new Map(checklist.items.map((i) => [i.id, i]));
  const applied: string[] = [];
  const failed: Array<{ id: string; error: string }> = [];

  for (const id of targetIds) {
    const item = byId.get(id);
    if (!item || (item.kind !== "auto" && item.kind !== "config")) continue;
    if (setup.items[id]?.done) continue;
    try {
      await applyUpgradeItem(opts.root, item);
      await markUpgradeSetupItem(opts.root, id);
      applied.push(id);
    } catch (err) {
      failed.push({ id, error: err instanceof Error ? err.message : String(err) });
    }
  }
  if (applied.length > 0 && failed.length === 0) {
    await markUpgradeSetupItem(opts.root, "upgrade.auto-applied");
  }
  return { applied, failed };
}
```

`applyUpgradeItem` dispatches:
- `apply.command` → `runSyncCursor` / `runSyncClaude` / `installGitHooks`
- `apply.type config-set` → deep set in docflow.config.json
- `apply.type config-rename` → rename key

- [ ] **Step 4: Run tests — expect PASS**

- [ ] **Step 5: Commit**

```bash
git add src/core/upgrade/setup.ts src/core/upgrade/apply.ts tests/upgrade/apply.test.ts
git commit -m "feat(upgrade): add setup state and auto apply"
```

---

### Task 7: Validate + stamp on success

**Files:**
- Create: `src/core/upgrade/validate.ts`
- Test: `tests/upgrade/validate.test.ts`

- [ ] **Step 1: Write failing validate test**

After marking all required items done in fixture, `validateUpgrade` returns `ready: true` and stamps `scaffoldVersion`.

- [ ] **Step 2: Implement validate.ts**

```typescript
export async function validateUpgrade(opts: { root: string }): Promise<{
  ready: boolean;
  scan: UpgradeScanResult;
  setup: UpgradeSetupState;
  setupCheck?: SetupAudit;
}> {
  const scan = await runUpgradeScan({ root: opts.root });
  const setup = await loadUpgradeSetup(opts.root);
  const checklist = await loadUpgradeChecklist();
  const applicable = filterApplicableItems(checklist.items, {
    fromVersion: scan.fromVersion,
    toVersion: scan.toVersion,
    editors: scan.editors,
  });
  const requiredOpen = applicable.filter(
    (i) => i.severity === "required" && !setup.items[i.id]?.done,
  );
  const gatesOpen = UPGRADE_GATE_ITEMS.filter(
    (g) => g !== "upgrade.complete" && !setup.items[g]?.done,
  );
  const ready = requiredOpen.length === 0 && gatesOpen.length === 0 && scan.ready;

  if (ready) {
    await stampScaffoldVersion(opts.root, scan.toVersion);
    await markUpgradeSetupItem(opts.root, "upgrade.complete");
  }
  const setupCheck = await runSetupCheck({ root: opts.root });
  return { ready, scan, setup: await loadUpgradeSetup(opts.root), setupCheck };
}
```

- [ ] **Step 3: Gate `markUpgradeSetupItem("upgrade.complete")`** in setup.ts — call `validateUpgrade` first; throw if not ready (mirror adopt `migration.complete`).

- [ ] **Step 4: Run tests — expect PASS**

- [ ] **Step 5: Commit**

```bash
git add src/core/upgrade/validate.ts src/core/upgrade/setup.ts tests/upgrade/validate.test.ts
git commit -m "feat(upgrade): add validate gate and scaffoldVersion stamp"
```

---

### Task 8: CLI commands + formatters

**Files:**
- Create: `src/core/operations/upgrade.ts`
- Create: `src/interfaces/cli/format/upgrade.ts`
- Modify: `src/cli.ts` — `registerUpgradeCommand(program)`

- [ ] **Step 1: Write CLI smoke test** (optional) or manual verify step in plan

```typescript
// tests/upgrade/cli.test.ts — spawn npx ai-spector upgrade scan --json on fixture
```

- [ ] **Step 2: Implement registerUpgradeCommand**

Subcommands: `scan`, `apply`, `validate`, `status`

Mirror `src/core/operations/adopt.ts` structure:
- `--json` on all
- `scan --target <ver> --strict` exits 1 when not ready
- `apply --auto` (default), `--items id1,id2`
- `status` reads setup without full scan

- [ ] **Step 3: Formatters** — table of findings + version jump header

- [ ] **Step 4: Register in cli.ts**

```typescript
import { registerUpgradeCommand } from "./core/operations/upgrade.js";
// ...
registerUpgradeCommand(program);
```

- [ ] **Step 5: Manual verify**

```bash
npm run build
npx ai-spector upgrade scan -C tests/fixtures/upgrade-stale-scaffold --json
```

- [ ] **Step 6: Commit**

```bash
git add src/core/operations/upgrade.ts src/interfaces/cli/format/upgrade.ts src/cli.ts tests/upgrade/cli.test.ts
git commit -m "feat(upgrade): add upgrade CLI commands"
```

---

### Task 9: MCP tools

**Files:**
- Create: `src/interfaces/mcp/tools/upgrade.ts`
- Modify: `src/interfaces/mcp/schemas.ts`
- Modify: `src/interfaces/mcp/tool-descriptions.ts`
- Modify: `src/interfaces/mcp/server.ts`

- [ ] **Step 1: Add Zod schemas**

```typescript
export const UpgradeScanSchema = z.object({
  root: z.string().optional(),
  target: z.string().optional(),
});

export const UpgradeApplySchema = z.object({
  root: z.string().optional(),
  auto: z.boolean().optional(),
  items: z.array(z.string()).optional(),
});

export const UpgradeValidateSchema = z.object({
  root: z.string().optional(),
});

export const UpgradeSetupMarkSchema = z.object({
  root: z.string().optional(),
  itemId: z.string(),
});
```

- [ ] **Step 2: Implement tool handlers** — mirror `src/interfaces/mcp/tools/adopt.ts`

- [ ] **Step 3: Register in server.ts** — `upgrade_scan`, `upgrade_apply`, `upgrade_validate`, `upgrade_setup_mark`

- [ ] **Step 4: Add tool descriptions** with WHEN hints for skill phases

- [ ] **Step 5: Commit**

```bash
git add src/interfaces/mcp/tools/upgrade.ts src/interfaces/mcp/schemas.ts src/interfaces/mcp/tool-descriptions.ts src/interfaces/mcp/server.ts
git commit -m "feat(upgrade): add MCP upgrade tools"
```

---

### Task 10: Stamp on init/sync + setup --check extension

**Files:**
- Modify: `src/core/operations/init.ts`
- Modify: `src/core/operations/sync-cursor.ts`
- Modify: `src/core/operations/sync-claude.ts`
- Modify: `src/core/operations/setup.ts`
- Test: `tests/upgrade/setup-check.test.ts`

- [ ] **Step 1: init.ts** — after writing config, call `stampScaffoldVersion(root, installedPackageVersion())`

- [ ] **Step 2: sync-cursor.ts / sync-claude.ts** — after copy, stamp version

- [ ] **Step 3: setup.ts auditSetup** — add step after `cursor-skills`:

```typescript
const scaffoldVer = await readScaffoldVersion(root);
const pkgVer = installedPackageVersion();
const stale = semver.lt(scaffoldVer, pkgVer);
steps.push({
  id: "scaffold-version",
  label: "Scaffold matches installed ai-spector",
  status: stale ? "warning" : "ok",
  detail: stale ? `scaffold ${scaffoldVer}, package ${pkgVer}` : `v${scaffoldVer}`,
  fix: stale ? 'npx ai-spector upgrade scan (or chat: "upgrade ai-spector")' : undefined,
});
```

- [ ] **Step 4: Test** — fixture with stale version shows warning step

- [ ] **Step 5: Commit**

```bash
git add src/core/operations/init.ts src/core/operations/sync-cursor.ts src/core/operations/sync-claude.ts src/core/operations/setup.ts tests/upgrade/setup-check.test.ts
git commit -m "feat(upgrade): stamp scaffoldVersion on init/sync and extend setup check"
```

---

### Task 11: Agent skill + router

**Files:**
- Create: `scaffold/cursor/skills/ai-spector-upgrade/SKILL.md`
- Create: `scaffold/cursor/skills/ai-spector-upgrade/references/runbook.md`
- Modify: `scaffold/cursor/skills/_skill-router.md`
- Modify: `scaffold/cursor/rules/ai-spector-routing.mdc` (if exists in scaffold)
- Modify: `.cursor/skills/_skill-router.md` (dogfood copy if needed)
- Run: `npm run build:claude-scaffold`

- [ ] **Step 1: SKILL.md** — use frontmatter from spec §10

- [ ] **Step 2: runbook.md** — phases 0–8 from spec; MCP tool names; hard stops

- [ ] **Step 3: Router** — priority 1.5 row:

```markdown
1.5. **Upgrade ai-spector** — upgrade, update ai-spector, sync after update, stale scaffold, continue upgrade → **`ai-spector-upgrade`**
```

- [ ] **Step 4: routing.mdc** — add gate row under adopt

- [ ] **Step 5: build claude scaffold**

```bash
npm run build:claude-scaffold
```

- [ ] **Step 6: Commit**

```bash
git add scaffold/cursor/skills/ai-spector-upgrade/ scaffold/cursor/skills/_skill-router.md scaffold/cursor/rules/
git commit -m "feat(upgrade): add ai-spector-upgrade agent skill and routing"
```

---

### Task 12: Docs + CHANGELOG maintainer section

**Files:**
- Modify: `README.md`, `README.vi.md`
- Modify: `CHANGELOG.md` — add `### Upgrade` under Unreleased with UPG IDs
- Create: `scaffold/cursor/skills/ai-spector/references/upgrade.md` (short pointer)

- [ ] **Step 1: README** — replace terse upgrade section with:

```markdown
### Upgrade (guided workflow)

In chat: **"upgrade ai-spector"**

Or CLI:
\`\`\`bash
npm install ai-spector@latest
npx ai-spector upgrade scan
npx ai-spector upgrade apply --auto
# complete manual steps shown in scan
npx ai-spector upgrade validate
\`\`\`
```

- [ ] **Step 2: CHANGELOG Unreleased** — link UPG-001, UPG-010, etc.

- [ ] **Step 3: Commit**

```bash
git add README.md README.vi.md CHANGELOG.md scaffold/cursor/skills/ai-spector/references/upgrade.md
git commit -m "docs: document upgrade workflow and checklist maintainer notes"
```

---

### Task 13: Full test suite + build verify

- [ ] **Step 1: Run full tests**

```bash
npm test
```

- [ ] **Step 2: Build**

```bash
npm run build
```

- [ ] **Step 3: End-to-end manual on fixture**

```bash
npx ai-spector upgrade scan -C tests/fixtures/upgrade-stale-scaffold
npx ai-spector upgrade apply --auto -C tests/fixtures/upgrade-stale-scaffold
```

- [ ] **Step 4: Fix any failures**

- [ ] **Step 5: Final commit if needed**

```bash
git commit -m "test(upgrade): complete integration coverage"
```

---

## Spec coverage checklist

| Spec section | Task |
|--------------|------|
| §4 Version stamping | Task 2, 7, 10 |
| §5 Checklist file | Task 3 |
| §6 Config scan | Task 4, 5 |
| §7 Project state | Task 6 |
| §8 CLI | Task 8 |
| §9 MCP | Task 9 |
| §10 Agent skill | Task 11 |
| §11 CHANGELOG workflow | Task 12 |
| §12 Error handling | Task 5 (downgrade), Task 7 (gates) |
| §13 Testing | Tasks 1–7, 13 |

## Out of scope (do not implement in this plan)

- Downgrade support
- Blocking generate/review when scaffold stale
- Auto `npm install` without user confirmation
