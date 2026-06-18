# Upgrade runbook

Three-factor collaboration: **Human + AI + CLI**.

Follow phases **0 → 8** in order. Human gates are hard stops.

**Artifact directory:** `.ai-spector/.docflow/upgrade/` (`scan-result.json`, `upgrade-setup.json`)

---

## Phase 0 — Preflight

```bash
npx ai-spector setup --check --json
# MCP: workspace_check({})
```

Confirm:

- `.ai-spector/docflow.config.json` exists (initialized project)
- User intent is **package upgrade**, not adopt or greenfield setup

If not initialized → route to **`ai-spector-setup`**.

---

## Phase 1 — Scan

```bash
npx ai-spector upgrade scan --json
# MCP: upgrade_scan({})
```

Summarize for the user:

- `fromVersion` → `toVersion`
- Applicable checklist items (`UPG-*`)
- Findings table (auto / agent / manual)

If downgrade requested → **stop** (unsupported).

---

## Phase 2 — Confirm

Ask **one** question:

> Upgrade to **{toVersion}** for **{editors}**? (yes / no)

On yes:

```bash
npx ai-spector upgrade setup-mark upgrade.confirmed
# MCP: upgrade_setup_mark({ itemId: "upgrade.confirmed" })
```

---

## Phase 3 — Install package

User or agent runs:

```bash
npm install ai-spector@<target>
# internal registry: add --registry http://10.101.0.239:4873
```

Then mark:

```bash
npx ai-spector upgrade setup-mark upgrade.npm-installed
```

**Stop if npm install fails.**

---

## Phase 4 — Apply auto items

```bash
npx ai-spector upgrade apply --auto --json
# MCP: upgrade_apply({ auto: true })
```

Report applied items. Warn that `sync-cursor` / `sync-claude` overwrite package-managed scaffold paths.

---

## Phase 5 — Agent items

For each applicable `kind: agent` item not yet done:

1. Show `agentGuide` from scan
2. Run the CLI command
3. Show output; ask user to confirm
4. `upgrade_setup_mark({ itemId: "UPG-0xx" })`

---

## Phase 6 — Manual items

One at a time for `kind: manual` items (e.g. `UPG-030` MCP reload, `UPG-031` enable skills):

1. Show `userGuide`
2. Wait for user confirmation
3. `upgrade_setup_mark({ itemId: "UPG-0xx" })`

---

## Phase 7 — Validate

```bash
npx ai-spector upgrade validate --json
npx ai-spector setup --check
# MCP: upgrade_validate({})
```

`ready: true` stamps `scaffoldVersion` and marks `upgrade.complete`.

---

## Phase 8 — Done

Tell the user:

- New `scaffoldVersion` in `docflow.config.json`
- Reload MCP if not already done
- For major jumps, point to CHANGELOG `### Upgrade` section

---

## Hard stops

- Do not skip Phase 2 confirmation
- Do not mark `upgrade.complete` without `upgrade_validate` → `ready: true`
- Do not use `init --force` as an upgrade shortcut
- Do not route to adopt unless user switches topic
