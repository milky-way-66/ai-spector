# Basic auth picker — username, password, htpasswd

Before **any** prototype HTML is generated, the project must have HTTP basic auth configured. Run this flow when `prototype.config.json` has no `basicAuth` (or username/password is empty).

Skip when:

- `basicAuth.username` and `basicAuth.password` are already set in `.ai-spector/.docflow/config/prototype.config.json` — run `npx ai-spector prototype auth --from-config` only if `prototype/.htpasswd` is missing
- User is only previewing themes (no generation)

## Step 1 — Check stored credentials

Read `.ai-spector/.docflow/config/prototype.config.json`. If `basicAuth.username` and `basicAuth.password` are non-empty, skip asking. Ensure `prototype/.htpasswd` exists; if not:

```bash
npx ai-spector prototype auth --from-config
```

## Step 2 — Ask the user

Post exactly this message and **stop**. Do not run `prototype setup` or write HTML until the user replies.

```
Prototype hosting uses HTTP basic auth. Choose credentials for reviewers:

  • **Username** (e.g. reviewer, demo, staging)
  • **Password** (share securely with your team)

Reply with both values (e.g. "username: demo / password: …").

Credentials are saved in `.ai-spector/.docflow/config/prototype.config.json` and hashed into `prototype/.htpasswd` for nginx/Apache.
```

If the user gives only one field, ask for the missing one and wait.

## Step 3 — Persist and create htpasswd

When both values are known, run (replace placeholders; never log the password in chat after this step):

```bash
npx ai-spector prototype auth --username <username> --password '<password>'
```

This writes:

| Artifact | Purpose |
|----------|---------|
| `prototype.config.json` → `basicAuth` | Plain username/password for regeneration and team reference |
| `prototype/.htpasswd` | Apache apr1 hash for web server `auth_basic` |

Then continue with theme resolution and [runbook.md](runbook.md) §1 (setup).

## Changing credentials later

If the user asks to rotate credentials:

1. Collect new username/password (or reuse username with new password).
2. Run `npx ai-spector prototype auth --username … --password …` again (overwrites config and htpasswd).

## Security note

`prototype.config.json` contains the password in plain text. Treat the file like a secret in production; restrict repo access or use environment-specific config outside git if needed.
