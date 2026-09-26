# AGENTS.md — Color Analyzer

Orientation for AI coding agents (and humans) picking up this repo. Read this first, then the file in `docs/` that matches your task.

## What this is

A **single-file, zero-build, client-side web app** (`color-analyzer.html`) for graffiti / mural artists. The user drops in an image; the app:

1. Samples pixels and clusters them with **k-means** (RGB space) into N colours.
2. Matches each cluster to the nearest **real spray-paint can** in a chosen catalogue (Montana, MTN, Molotow, Loop — 9 lines, 1,336 colours) using **CIE76 ΔE** in Lab space, with optional fallback lines.
3. Shows a re-rendered preview (pixel / vector / spray-simulation / before-after compare), a card per colour, a can-count estimate, a wall-size calculator, a light-to-dark spray order, and exports (CSV shopping list, printable palette "PDF", per-colour SVG stencils, JSON session files).

No server, no framework, no dependencies, no build step, no tests. Only external request: Google Fonts (Bebas Neue, Space Mono).

`README.md` is the **end-user** manual. `docs/` is for developers/agents.

## Repo layout

```
color-analyzer.html   ~5.5k lines: CSS (1–2201), HTML markup (2203–2544), JS (2545–5514)
README.md             End-user feature guide
AGENTS.md             This file
CLAUDE.md             Imports this file (for Claude Code)
docs/
  ARCHITECTURE.md     Code map, pipeline, state, render modes, event wiring
  DATA_MODEL.md       Cluster/result objects, session JSON schema, compare snapshot
  PALETTES.md         Catalogue format, how to add/edit a paint line, data-quality notes
  DEVELOPMENT.md      Running, manual QA checklist, headless smoke test recipe
  KNOWN_ISSUES.md     Verified bugs, README/code mismatches, tech debt
```

Line numbers above are approximate and drift. Navigate by the section banners instead — every section starts with a comment like `// ─── Core Logic ───` (JS) or `/* ─── Color cards ─── */` (CSS). `grep -n '─── ' color-analyzer.html` gives you the table of contents.

## Running it

Open `color-analyzer.html` in a browser. That's it. For local serving: `python3 -m http.server` and browse to `/color-analyzer.html`. See `docs/DEVELOPMENT.md` for a headless Playwright smoke test.

## Conventions to follow when editing

- **Keep it a single self-contained HTML file** unless the owner explicitly agrees to change that (it's a stated feature: "open the file and go", shareable as an email attachment).
- Plain ES2020+ JS in one global `<script>`; no modules, no frameworks. Functions and state are globals.
- DOM refs are cached as `const` near the top of the script (`// ─── DOM refs ───`). Add new ones there.
- UI is built with template-literal `innerHTML` for cards/tables and `createElement` for smaller bits. Match whichever the surrounding code uses.
- Styling: CSS custom properties in `:root` (`--accent` red `#ff2d00`, `--accent2` yellow `#ffcc00`, `--good/--ok/--poor`). Headline font Bebas Neue, body Space Mono. Uppercase, letter-spaced, square corners (`--radius: 2px`). Mobile overrides live in the `@media` blocks under `/* ─── Responsive ─── */` and at the very end of the `<style>`.
- Section banner comments (`// ─── Name ───…`) for new sections.
- **Naming legacy:** the app started as Montana-BLACK-only, so many identifiers say "montana" even though they mean "the matched paint colour from any brand": `result.montana`, `findClosestMontana`, `renderMontanaImage`, `#montana-render-canvas`, session `_type: 'montana-session'`, file names `montana_session_*.json`, `montana-*-shopping-list.csv`. **Do not rename `_type` or session field names** without a migration — existing user session files depend on them.

## Key mental model (read before changing logic)

```
image ─► samplePixels (every 6th px, alpha≥128)
      ─► kMeans(k = Color Depth)             ─┐ runFullAnalysis()  (clears locks + excludes)
      ─► drop clusters < Min Coverage, renormalise to 100%
      ─► rawClusters                          ─┘
rawClusters ─► per cluster: lock override OR findClosestMontana (primary line, then fallbacks if ΔE > threshold)
            ─► analysisResult[]               ── rematch()  (keeps locks + excludes)
analysisResult ─► renderResults / renderLayerOrder / calcWallCans / renderMontanaImage / renderDiffPanel
```

- **Locks and exclusions are keyed by cluster index** (`lockedOverrides: Map<idx, paintColor>`, `excludedIndices: Set<idx>`). They are only valid for the current `rawClusters`; `runFullAnalysis()` clears them.
- What triggers what: Paint Line / Match Quality / fallback chips / lock / exclude → `rematch()`. Color Depth / Min Coverage → need **ANALYZE** (`runFullAnalysis()`). Block size / render mode → `renderMontanaImage()` only.
- The rendered preview does **not** reuse the k-means assignment: it averages each `blockSize × blockSize` block and snaps it to the nearest *matched paint* colour.
- Percentages (`pct`) are stored as **strings** (from `toFixed(1)`) and `parseFloat`-ed everywhere. Keep that in mind; session files contain strings.

## Before you change things

- Check `docs/KNOWN_ISSUES.md` — several real bugs are already diagnosed there (e.g. flat-colour images hang the analysis; excluded colours still counted in wall calc; empty paint codes break the lock picker and diff).
- There are no automated tests. After any change, run through the manual checklist in `docs/DEVELOPMENT.md` (or the Playwright smoke script there).
- Keep `README.md` in sync when you change user-visible behaviour.
