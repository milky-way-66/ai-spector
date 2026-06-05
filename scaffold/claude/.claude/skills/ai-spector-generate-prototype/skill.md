---
name: ai-spector-generate-prototype
description: "Generates HTML prototype screens. Use when the user asks for HTML mockups, prototypes, or UI previews. Handles theme selection, auth picker, and screen generation."
---

# AI Spector — Generate Prototype

## When to use

- "HTML mockup", "prototype", "generate UI screens"
- "help me pick a theme", "what themes are available"

## Workflow

### 1. Setup (first time)

```bash
npx ai-spector prototype setup --theme <theme>
```

If no theme specified, ask the user to choose from available themes or describe their app — then recommend 3 options. Preview with:

```bash
npx ai-spector prototype preview --theme <theme>
```

### 2. Auth (if needed)

Check `.ai-spector/docflow.config.json` for auth requirements. If auth screens are needed, handle auth picker before generating screens.

### 3. Generate screens

```bash
npx ai-spector prototype generate --screen <screen-name>
```

Or generate all:

```bash
npx ai-spector prototype generate
```

### 4. Validate

```bash
npx ai-spector prototype validate
```

## Checklist

```
- [ ] Theme selected (asked user if not specified)
- [ ] prototype setup run
- [ ] Auth handled if required
- [ ] Screens generated
- [ ] Prototype validate passed
```

## Rules

- Ask for theme before defaulting — user preference matters
- Do not generate screens before setup completes
