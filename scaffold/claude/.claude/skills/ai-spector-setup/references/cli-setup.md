# CLI setup reference (quick)

For agents who need to explain the manual path to users, or when Cursor chat
is not available.

## Minimum — new project

```bash
# 0. Install (internal registry — add --registry http://10.101.0.239:4873)
npm install ai-spector

# 1. Scaffold
npx ai-spector init

# 2. Audit
npx ai-spector setup --check

# Or non-interactive scaffold + dep in one go:
# npx ai-spector setup --yes --languages en --install-dep

# 3. Verify
npx ai-spector setup --check
# → node ✓  init ✓  cursor-skills ✓

# 4. Enable skills in Cursor → Settings → Rules → Agent Skills
# 5. Add material to docs/data-source/
# 6. "analyze my data source"
```

## Multi-language

```bash
npx ai-spector setup --yes --languages en,jp,vi --install-dep
```

## Re-scaffold existing project (after ai-spector update)

```bash
npx ai-spector sync-cursor          # re-copy skills only
# or
npx ai-spector setup --yes --force  # full re-scaffold
```

## Add a language later

```bash
npx ai-spector lang add jp
npx ai-spector index
```

## CocoIndex (optional, requires Python 3.11+)

```bash
npx ai-spector cocoindex setup
cd .ai-spector/.docflow/cocoindex
pip install -r requirements.txt
python pipeline.py cocoindex update
```

Keep fresh after doc edits:
```bash
npx ai-spector index --cocoindex-sync
```

## Common fixes

| Problem | Command |
|---------|---------|
| `✗ init` | `npx ai-spector setup --yes --languages en` |
| `✗ cursor-skills` | `npx ai-spector sync-cursor` |
| Pre-commit hook missing | `npx ai-spector hooks install` |
| Full audit | `npx ai-spector setup --check --json` |
