# Theme picker — recommend, preview, confirm

> **Hard rule: never auto-select a theme.** Inferring from project context is allowed only to produce 3 *recommendations*. The user must explicitly choose (by number, name, or "use that one") before `prototype setup` runs. Auto-picking and explaining the choice afterward is not acceptable.

When **no theme is stored** and the user did **not** name one in this request, run this flow **before** `prototype setup`. Do not generate HTML until the user confirms a theme.

Skip this flow when:

- User named a theme (`--theme stripe`, “use notion theme”)
- `prototype/theme.json`, manifest, or config already has a theme (use it — do not re-ask)
- User is only asking to preview or list themes (no generation yet)

## Step 1 — Gather project context

Read enough to infer product type, audience, and visual tone. Prefer, in order:

| Source | What to extract |
|--------|-----------------|
| `docs/basic-design/list-screens.md` §1 Design System | Stated palette, typography, density, light/dark |
| `docs/srs/` (overview, use cases) | Domain (fintech, devtools, commerce, …), B2B vs consumer |
| `.ai-spector/.docflow/analysis/knowledge.json` | Product name, features, actors |
| `docs/data-source/` | Brand references, competitor mentions, industry |
| User message | Explicit vibe (“dark dashboard”, “like Stripe”, “travel app”) |

If context is thin, infer from screen names (e.g. checkout → commerce; admin dashboard → B2B SaaS).

## Step 2 — Load theme catalog

```bash
npx ai-spector prototype themes --json
```

Each entry has `name`, `summary` (first line of SUMMARY.md), and `preview` (visual sample available).

Optionally read `assets/themes/<name>/SUMMARY.md` for top candidates only — do not read all 65.

## Step 3 — Pick 3 best-fit themes

Choose **exactly 3** themes. Rank #1 = strongest match. Use signals below; tie-break with preview availability (`preview: true` preferred).

### Domain → theme families

| Project signal | Prefer (examples) |
|----------------|-------------------|
| Payments, banking, fintech, wallet | `stripe`, `wise`, `revolut`, `coinbase`, `kraken` |
| Developer tools, infra, CI, APIs | `vercel`, `supabase`, `raycast`, `sentry`, `posthog`, `hashicorp` |
| Issue tracking, eng productivity, dark UI | `linear.app`, `cursor`, `warp` |
| Docs, wiki, workspace, notes | `notion`, `mintlify`, `miro` |
| Spreadsheets, ops, internal tools | `airtable`, `clickhouse` |
| E-commerce, merchant, checkout | `shopify`, `stripe` |
| Marketplace, travel, consumer listings | `airbnb`, `uber` |
| AI / ML product, chat, agents | `claude`, `mistral.ai`, `cohere`, `elevenlabs`, `x.ai`, `opencode.ai` |
| Marketing site, landing, portfolio | `framer`, `webflow`, `lovable`, `resend` |
| Scheduling, calendar | `cal` |
| Support, messaging, CRM | `intercom`, `superhuman` |
| Analytics, product data | `posthog`, `mixpanel-style` → `posthog`, `clickhouse` |
| Automotive / luxury brand | `bmw`, `tesla`, `porsche-style` → `ferrari`, `lamborghini`, `bugatti` |
| Media, social, content | `spotify`, `pinterest`, `wired`, `theverge` |
| Enterprise / big tech tone | `ibm`, `meta`, `nvidia` |
| Minimal / unknown | `vercel` (light dev), `notion` (friendly product), `linear.app` (dark pro) |

### Tone modifiers

| User / doc says | Lean toward |
|-----------------|-------------|
| Dark mode, dense dashboard | `linear.app`, `cursor`, `raycast`, `binance` |
| Light, airy, friendly | `notion`, `airbnb`, `cal`, `lovable` |
| Premium, polished, fintech | `stripe`, `wise`, `revolut` |
| Playful, consumer | `spotify`, `airbnb`, `lovable` |
| “Like X” | That theme if bundled; else closest row above |

Write one sentence **why** for each of the 3 picks tied to **this project** (not generic theme marketing copy).

## Step 4 — Show previews

Open all 3 recommended themes in the browser so the user can compare:

```bash
npx ai-spector prototype preview <pick-1> --open
npx ai-spector prototype preview <pick-2> --open
npx ai-spector prototype preview <pick-3> --open
```

If a pick has no preview (`preview: false`), say so and still include it if it is the best domain match.

## Step 5 — Present choices and wait

Post a short message like this (adapt to project):

```markdown
No prototype theme is saved yet. Based on **[project/domain]**, here are 3 fits:

| # | Theme | Why | Preview |
|---|-------|-----|---------|
| 1 | **stripe** | Fintech checkout + admin — matches your payment flows | opened in browser |
| 2 | **wise** | Cross-border money — similar trust/minimal fintech tone | opened in browser |
| 3 | **shopify** | Merchant commerce — if storefront is primary | opened in browser |

Three preview tabs should be open. Reply with **1**, **2**, **3**, or another theme name (`npx ai-spector prototype themes` lists all).

I will run setup after you choose.
```

**Stop here.** Do not run `prototype setup` or generate HTML until the user replies.

## Step 6 — Persist choice

When the user picks (number or name):

```bash
npx ai-spector prototype setup --theme <chosen-name>
```

Then continue the generate-prototype runbook (manifest → HTML → validate).

If the user asks to see more options, run `prototype themes` and offer to preview additional names they shortlist.

## User already named a theme

If the user says “use stripe” or `--theme stripe`, skip the picker — run setup directly. Optionally offer a quick preview first only if they seem unsure (“want to preview before committing?”).
