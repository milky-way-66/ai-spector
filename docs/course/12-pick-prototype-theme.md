# Work 12 — Pick a Prototype Theme

**Course:** [Index](README.md) · [Overview](00-overview.md) · [Previous](11-generate-basic-design.md)

**Goal:** Choose and save a visual theme for the prototype (static HTML or SPA) so every screen has a consistent look and you don't get asked every time.

**Before you start:** Work 04 (Enable Agent Skills), Work 11 (Generate Basic Design).

---

## What a Theme Is

A theme is a set of CSS styles and layout conventions. The agent uses the saved theme every time it generates prototype screens, so you only choose once.

Built-in themes:

| Theme | Style |
|-------|-------|
| `stripe` | Clean, white, professional — similar to Stripe's dashboard |
| `material` | Google Material Design — card-based, colorful |
| `tailwind` | Tailwind utility defaults — neutral, minimal padding |
| `minimal` | Plain HTML with minimal decoration |
| `dark` | Dark background, light text |

---

## Steps

### Option A — Browse and compare (recommended for new projects)

#### 1. Open chat

#### 2. Type this

```
help me pick a prototype theme
```

or

```
show me theme options
```

The agent will:
1. List the available themes
2. Open browser previews for 3–4 themes simultaneously
3. Ask you to choose

#### 3. Look at the previews

Each preview shows a sample screen rendered with that theme. Compare them.

#### 4. Tell the agent your choice

```
I pick stripe
```

The agent saves the choice to `prototype/manifest.json` and updates `prototype.config.json`.

---

### Option B — Choose directly (if you already know the theme)

```
set the prototype theme to dark
```

The agent saves immediately without showing previews.

---

## Check

Ask the agent:

```
what prototype theme is currently set?
```

It should report the theme name you chose.

Or check the manifest:

```bash
cat prototype/manifest.json | grep theme
```

---

## Changing the Theme Later

You can switch themes at any time:

```
change the prototype theme to material
```

Then regenerate the prototype:

```
generate prototype for all screens
```

The agent will apply the new theme to all screens.

---

## Next

Go to [Work 13 — Generate Prototype](13-generate-prototype.md), or [Work 14 — Impact Analysis](14-impact-analysis.md) if you are skipping the prototype.
