# Design Reference

This folder contains the **browser-side React prototype** used during design exploration.

> ⚠️ These files are **not production code**. They run via in-browser Babel transpilation with mock data. Do not ship them directly.

## What's here

| File | Purpose |
|---|---|
| `index.html` | Entry point — loads all JSX files via Babel |
| `app.jsx` | Root component, state management, screen routing |
| `flow-screens.jsx` | Upload, extraction, and AI prompt (`aiExtractTasks`) |
| `calendar-screen.jsx` | Day / Week / Month calendar views |
| `design-canvas.jsx` | Theme explorer / design sandbox |
| `tweaks-panel.jsx` | Live design tweaks panel |
| `themes.js` | All design tokens (Obsidian, Terminal, Bone) |
| `data.js` | Mock data and helper functions |
| `recurrence.js` | Recurrence rule expansion (`expandRecurringTasks`) |
| `Landing Page.html` | Standalone marketing page (production-ready, deploy as-is) |

## How to preview

Serve this folder locally — the JSX files must be served (not opened as `file://`):

```bash
npx serve docs/design-reference
```

Then open `http://localhost:3000/index.html`.

## Using this as a reference

When implementing production screens:

1. **AI extraction prompt** — copy verbatim from `flow-screens.jsx → aiExtractTasks()`
2. **Recurrence expansion** — port `recurrence.js → expandRecurringTasks()` to TypeScript
3. **Design tokens** — Obsidian dark palette from `themes.js` is already in `src/app/globals.css`
4. **Layout & interactions** — follow the prototype pixel-for-pixel (Obsidian direction only)
