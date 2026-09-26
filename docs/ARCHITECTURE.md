# Architecture

Everything lives in `color-analyzer.html`. This document maps that file and explains how data flows through it. Line numbers are approximate; search for the `─── Section ───` banners.

## File map

| Region | ~Lines | Contents |
|---|---|---|
| `<style>` | 7–2201 | All CSS. Design tokens in `:root`. Section banners per component. Responsive rules from `/* ─── Responsive ─── */` (~1805) onward, including breakpoints at 900 / 700 / 540 / 480 px and `(pointer: coarse)`. Several later `@media (max-width: 700px)` blocks were appended by the mobile commits and override earlier ones — check the *last* matching block before editing mobile styles. |
| `<body>` markup | 2203–2544 | Static DOM: header + mobile drawer, upload zone, controls bar, fallback bar, preview (source + render panels), loading spinner, results (wall calc, color grid, layer order, diff panel, export bar), session modal, lock picker. Hidden `<canvas id="analysis-canvas">` holds the full-res source image. |
| Palette data | 2546–3940 | Nine `const` arrays of `{code, name, hex}`. See `PALETTES.md`. |
| Palette registry | ~3941–3944 | `PALETTES`, `LINE_NAMES`, `getActivePalette()`, `getActiveLineName()`. |
| Fallback chips | ~3946–3982 | `activeFallbackKeys`, `buildFallbackChips()`, `getActiveFallbackPalettes()`, `matchPctToDelta()`. |
| Colour math | ~3984–4042 | `hexToRgb`, `rgbToHex`, `rgbToLab` (sRGB → XYZ D65 → Lab), `colorDistance` (CIE76), `findClosestMontana`. |
| Clustering | ~4044–4110 | `samplePixels`, `kMeans` (k-means++ init, 20 iterations, RGB Euclidean). |
| State | ~4112–4119 | Global `let` state (see below). |
| DOM refs | ~4121–4203 | Cached `document.getElementById` constants. |
| Features | ~4205–4990 | Lock picker, exclude/unlock, stencil export, session save/load, compare snapshot + diff panel, palette PDF, collapsible panels, wall calculator, layer order, compare (before/after) mode, toast, zoom, mouse pan, touch pinch/pan. |
| Render mode buttons + event wiring | ~4991–5066 | |
| Core logic | ~5068–5435 | `handleFile`, `runFullAnalysis`, `rematch`, `renderMontanaImage`, `renderMontanaSpray`, `renderMontanaVector`, `renderResults`, `exportCSV`. |
| Reset + mobile drawer | ~5437–5513 | `reset()`, hamburger drawer open/close/sync. |

## Global state

```js
let currentFile        // File | null — the uploaded image
let rawClusters        // Cluster[] | null — k-means output after min-coverage filter (see DATA_MODEL.md)
let analysisResult     // Result[] | null — rawClusters + matched paint + flags
let renderMode         // 'pixel' | 'vector' | 'spray'
let compareMode        // boolean — before/after slider active (forces pixel render)
let excludedIndices    // Set<number> — cluster indices hidden from render/exports
let lockedOverrides    // Map<number, PaintColor> — cluster index → user-chosen paint
let lastBlocks, lastSrcW, lastSrcH   // cached render blocks for stencil export
let openLockPickerIdx  // cluster index the picker is editing, -1 if closed
let compareSnapshot    // snapshot for the diff panel, or null
let activeFallbackKeys // Set<paletteKey>
let currentZoom, renderNativeW, renderNativeH  // zoom state
```

UI inputs are also state and are read directly from the DOM when needed: `#paint-line` (select), `#color-count`, `#min-pct`, `#match-quality`, `#block-size`, `#wall-w/h/cov`.

## Pipeline

### 1. Load — `handleFile(file)`
Object URL → `#preview-img` → drawn at natural size onto the hidden `analysis-canvas`. Reveals the UI and calls `runFullAnalysis()`.

### 2. Cluster — `runFullAnalysis()`
- Clears `excludedIndices` and `lockedOverrides`.
- `samplePixels(canvas, ctx, 6)` — every 6th pixel with alpha ≥ 128, as `[r,g,b]`.
- `kMeans(pixels, k)` — k-means++ seeding, 20 fixed iterations, squared RGB distance. Returns clusters sorted by coverage.
- Drops clusters below Min Coverage and **renormalises** the remaining `pct` to sum to ~100.
- Stores `rawClusters`, then `rematch(true)`.
- Runs on the main thread inside `setTimeout(…, 50)` so the spinner can paint first. Big images block the UI.

### 3. Match — `rematch()`
For each cluster index `i`:
- If `lockedOverrides.has(i)` → use that paint, compute ΔE to it, `isLocked: true`.
- Else `findClosestMontana(r,g,b)`:
  - Linear scan of the primary palette for minimum CIE76 ΔE.
  - If best ΔE > `matchPctToDelta(matchQuality)` (i.e. `(100 − q) / 2`; 70 % → ΔE 15) and fallback lines are active, scan them too and take the overall minimum.
  - `matchPct = max(0, round(100 − 2·ΔE))`. `delta` is rounded to an integer.
- Sets `isExcluded` from `excludedIndices`.
Then re-renders everything: `renderResults`, `renderLayerOrder`, `calcWallCans`, `renderMontanaImage`, and `renderDiffPanel` if a snapshot exists.

### 4. Render preview — `renderMontanaImage()`
- Palette = unique hexes of **non-excluded** results.
- Tiles the source into `blockSize` squares; each block's average colour (opaque pixels only) is snapped to the nearest palette colour by ΔE. Result is `blocks[] = {bx, by, bw, bh, hex}`, cached in `lastBlocks` for stencils.
- Mode dispatch:
  - **pixel** → `fillRect` per block on `#montana-render-canvas` (CSS `image-rendering: pixelated`).
  - **vector** → `<rect>` per block inside `<g fill=hex>` groups in `#montana-render-svg`.
  - **spray** → `renderMontanaSpray`: blocks sorted dark→light by Lab L, 4 radial-gradient blobs per block with random jitter/radius/alpha/±4 RGB drift. Non-deterministic (`Math.random`).
- Calls `fitZoom()` afterwards, so any render resets zoom to fit.

### 5. Compare (before/after) mode
`enterCompareMode()` forces pixel mode, draws the original image into `#compare-orig-canvas` at render size, and clips the render and the original with `clip-path: inset(...)` around a split position from `#compare-slider`. Recomputed on slider input, scroll, and zoom (`updateCompare`). Note there is an unused older `applyCompare()` next to it.

### 6. Derived panels
- **Cards** — `renderResults()` rebuilds `#color-grid` via `innerHTML`, then wires copy / exclude / lock handlers via `querySelectorAll`. Summary pills above it.
- **Can estimate on cards/CSV/PDF** — `max(1, ceil(pct / 10))`. A fixed heuristic, *not* tied to the wall calculator.
- **Wall calculator** — `calcWallCans()`: `area × pct / coverage-per-can`, ceil per colour.
- **Layer order** — `renderLayerOrder()`: sort by Lab L of the *paint* colour descending; if two colours are within 5 L of each other, higher coverage first. Role label: step 0 = Background, L>70 Light, L>40 Mid, pct<3 Detail, else Dark.
- **Diff panel** — `renderDiffPanel()`: joins snapshot and current active results **by paint `code`**; statuses added / removed / changed (|Δpct| > 0.4) / same.

### 7. Exports
- **CSV** — `exportCSV()`, naive `join(',')` (no quoting). Includes excluded rows.
- **Palette PDF** — `exportPalettePDF()` builds a standalone HTML doc string, `window.open` + `document.write`, auto-calls `print()`. Needs pop-ups allowed.
- **SVG stencils** — `exportStencils()` groups `lastBlocks` by hex, one SVG per colour (white background + black `<rect>` per block), downloads staggered 300 ms apart.
- **Session JSON** — `doSaveSession()` / `loadSessionFromJSON()`. Schema in `DATA_MODEL.md`.

## Event wiring cheat-sheet

| Input | Handler | Effect |
|---|---|---|
| file input / drop | `handleFile` | full analysis |
| ANALYZE | `runFullAnalysis` | re-cluster, clears locks/excludes |
| `#paint-line` change | inline | update labels, `buildFallbackChips`, `rematch` |
| `#match-quality` input | inline | `rematch` |
| fallback chip click | in `buildFallbackChips` | `rematch` |
| `#color-count`, `#min-pct` input | inline | label only (needs ANALYZE) |
| `#block-size` input | inline | `renderMontanaImage` |
| mode buttons | inline | set `renderMode`, `renderMontanaImage` |
| card EXCLUDE / LOCK | in `renderResults` | `toggleExclude` / `openLockPicker` / `unlockColor` → `rematch` |
| wall inputs | `calcWallCans` | |
| Esc | global keydown | closes lock picker |
| ctrl/cmd + wheel, drag, pinch | zoom/pan handlers on `#render-viewport` | |

## Mobile

Mobile layout is pure CSS plus a hamburger drawer (`#mobile-drawer`) whose buttons proxy-click the desktop header buttons (`save-compare-btn`, `save-session-btn`, `export-btn`) or call `reset()`. `syncMobileDrawer(bool)` enables/disables them.
