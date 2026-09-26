# AGENTS.md — Color Analyzer

Orientation for AI coding agents (and humans) picking up this repo. Read this first, then the file in `docs/` that matches your task.

## What this is

A **single-file, zero-build, client-side web app** (`color-analyzer.html`) for graffiti and mural artists, hosted on **GitHub Pages** and shared with other artists. The user drops in an image. The app:

1. Downscales it to ≤ 1600 px, samples ≤ 60k opaque pixels, and clusters them with **seeded k-means in CIE Lab** (in a Web Worker).
2. Matches each cluster to the nearest **real spray-paint can** in a chosen catalogue (Montana, MTN, Molotow, Loop: 9 lines, 1,335 colours) using **CIEDE2000**, with optional fallback lines.
3. Shows a re-rendered preview (pixel / vector / spray simulation / before-after compare), a card per colour, a wall-based can calculator, a light-to-dark spray order, and exports: a CSV shopping list (one row per paint), a printable palette "PDF", per-paint SVG stencils, and JSON session files (optionally with the image embedded).

The app has no server, no framework, no runtime dependencies and no build step. Its only external request is Google Fonts. `package.json` exists only for **dev tooling** (tests).

`README.md` is the **end-user** manual. `docs/` is for developers and agents.

## Owner decisions (don't relitigate)

- **Stays a single self-contained HTML file.** No bundler or build step. Multiple `<script>` blocks inside the file are fine.
- Catalogue data was **scraped and verified** by the owner. Don't "correct" hex values or invent product codes; lines without codes are identified by name.
- Hosting: GitHub Pages only.

## Repo layout

```
color-analyzer.html        The app. CSS → markup → 3 script blocks (see below)
README.md                  End-user feature guide
AGENTS.md / CLAUDE.md      This file (CLAUDE.md imports it)
docs/
  ARCHITECTURE.md          Code map, pipeline, state, render modes, event wiring
  DATA_MODEL.md            Paint/cluster/result objects, session JSON schema (v1 + v2)
  PALETTES.md              Catalogue format, how to add/edit a paint line, data notes
  DEVELOPMENT.md           Running, tests, CI, manual QA checklist
  KNOWN_ISSUES.md          Remaining issues and tech debt; changelog of fixed ones
tests/
  load-core.mjs            Extracts the pure script blocks from the HTML into a vm sandbox
  core.test.mjs            Unit tests (colour maths, CIEDE2000, k-means, palettes…)
  e2e.test.mjs             Playwright browser tests against the real page
package.json               Dev only: `npm test`
.github/workflows/ci.yml   Runs `npm test` on every push / PR
```

### The three script blocks in `color-analyzer.html`

| Block | Purpose | Rules |
|---|---|---|
| `<script id="core-lib">` | `const CA = {…}`: pure functions (colour conversion, CIEDE2000, seeded RNG, sampling, k-means, block merging, can estimates, aggregation, escaping, CSV). | **No DOM, no globals except `CA`.** It is copied into the analysis Web Worker at runtime and loaded by the unit tests. Anything testable goes here. |
| `<script id="palette-data">` | The nine catalogue arrays plus `PALETTES` and `LINE_NAMES`. | Pure data. Also loaded by the unit tests. |
| `<script>` (app) | Palette normalisation, state, DOM refs, UI and features. | Globals, DOM, event wiring. |

Line numbers drift. Navigate by the section banners (`// ─── Name ───`, `/* ─── Name ─── */`): `grep -n '─── ' color-analyzer.html` is the table of contents.

## Running and testing

- Run: open `color-analyzer.html` in a browser, or `python3 -m http.server` and browse to `/color-analyzer.html`.
- Test: `npm install && npm test` (Node 22+). The e2e tests need Chromium: `npx playwright install chromium`, or set `PW_CHROMIUM_PATH`. Details in `docs/DEVELOPMENT.md`.
- **Every change must keep `npm test` green.** Add unit tests for new pure logic (put it in `core-lib`) and e2e tests for new user flows.

## Conventions

- Plain ES2020+ JS, no modules or frameworks. State and functions in the app block are globals. Tests reach into them via `page.evaluate`, so renaming a global can break tests.
- DOM refs are cached as `const` in `// ─── DOM refs ───`. Add new ones there.
- **Escape everything that comes from data** when building HTML: `esc()` (= `CA.escapeHtml`) for text, and only validated `#RRGGBB` values in `style`. Session files are shared between artists and are untrusted input; `sanitizeSession()` validates them.
- Paints are identified by `paint.id` = `` `${line}|${code || name}` `` (non-enumerable, set at startup), **never by `code` alone**. Codes are empty for some lines.
- Can counts come only from `cansFor(pct)` / `totalCans()` (wall calculator inputs). Shopping-list style outputs use `activePaints()` (excluded colours removed, clusters aggregated per paint).
- Styling: CSS custom properties in `:root` (`--accent` red, `--accent2` yellow, `--good/--ok/--poor`). Bebas Neue headings, Space Mono body, uppercase with letter-spacing, square corners. Mobile overrides are in the `@media` blocks from `/* ─── Responsive ─── */` to the end of `<style>`. The **last** matching block wins.
- **Naming legacy:** "montana" in identifiers means "the matched paint, any brand" (`result.montana`, `findClosestMontana`, `renderMontanaImage`, `#montana-render-canvas`). **Do not rename `_type: 'montana-session'` or session field names.** Users have saved files. Bump `_version` and migrate in `sanitizeSession()` instead.
- Keep `README.md` in sync with user-visible behaviour, and `docs/` with structure and formats.

## Key mental model

```
image ─► loadImageSource: downscale ≤1600px onto hidden #analysis-canvas
      ─► CA.samplePixels (≤60k opaque px, seeded)            ─┐ runFullAnalysis()
      ─► Worker: CA.clusterSamples → kMeans in Lab (seeded)    │ (clears locks + excludes)
      ─► drop < Min Coverage, renormalise → rawClusters        ─┘
rawClusters ─► per cluster: lock override OR findClosestMontana (CIEDE2000; fallbacks if ΔE > threshold)
            ─► analysisResult[]                                ── rematch() (keeps locks + excludes)
analysisResult ─► activePaints() (drop excluded, merge same paint)
               ─► cards / pills / wall calc / layer order / CSV / PDF / stencils / diff
               ─► renderMontanaImage (blocks snapped to active paints, merged rects)
```

- Locks and exclusions are keyed by **cluster index** and are valid only for the current `rawClusters`.
- What triggers what: Paint Line / Match Quality / fallback chips / lock / exclude → `rematch()`. Color Depth / Min Coverage → **ANALYZE**. Block size / render mode → `renderMontanaImage()`. Wall inputs → wall calc, pills, card estimates.
- `pct` is stored as a **string** with one decimal (historical format, also in sessions); use `parseFloat`. Aggregated `activePaints()[].pct` is a number.
- `delta` is CIEDE2000 rounded to 0.1. Bands: < 5 close, < 10 fair. Match % = `100 − 4·ΔE`.
