# Architecture

Everything ships in `color-analyzer.html`. This document maps that file and explains how data flows through it. Line numbers are approximate; search for the `─── Section ───` banners.

## File map

| Region | ~Lines | Contents |
|---|---|---|
| `<style>` | 7–2218 | All CSS. Design tokens in `:root`. Responsive rules from `/* ─── Responsive ─── */` onward (breakpoints 900 / 700 / 540 / 480 px, `pointer: coarse`). Several `@media (max-width: 700px)` blocks exist; the last one wins. |
| `<body>` markup | 2220–2568 | Header + mobile drawer, upload zone, controls, fallback bar, preview (source + render panels incl. attach-image prompt), loading spinner, results (wall calc, cards, layer order, diff panel, export bar), session modal, lock picker. Hidden `<canvas id="analysis-canvas">` holds the downscaled source image. |
| `<script id="core-lib">` | ~2570–2848 | `const CA`: pure library (see below). |
| `<script id="palette-data">` | ~2850–4250 | Nine catalogue arrays, `PALETTES`, `LINE_NAMES`. |
| `<script>` app | ~4252–end | Everything with DOM access. |

### `CA` (core-lib) API

| Function | Notes |
|---|---|
| `hexToRgb`, `rgbToHex`, `isHex` | 6-digit hex only. `rgbToHex` returns uppercase. |
| `rgbToLab(r,g,b)` | sRGB D65 → CIE Lab (LUT for integer channels). |
| `deltaE2000(lab1, lab2)`, `deltaE76` | CIEDE2000 verified against Sharma et al. reference data in tests. |
| `deltaToMatchPct`, `matchPctToDelta`, `deltaRating`, `DE_CLOSE`, `DE_FAIR` | Match % = 100 − 4·ΔE; ratings good < 5 ≤ ok < 10 ≤ poor. |
| `mulberry32(seed)` | Seeded PRNG used by sampling, k-means and the spray renderer. |
| `samplePixels(rgba, max, seed)` | ≤ `max` opaque samples with jittered stride → `{rgbs, labs, n, hasAlpha}`. |
| `kMeans(labs, rgbs, n, k, {iterations, seed})` | k-means++ in Lab with incremental min-distance and early stop on convergence. Stops seeding when all points coincide with centres, so flat images produce fewer clusters instead of crashing. Cluster `rgb` = mean RGB of members, `lab` = centroid. |
| `clusterSamples({labs, rgbs, n, k, minPct, seed})` | k-means + min-coverage filter + renormalise. This is what the worker runs. |
| `nearest(lab, colors)` | Nearest by CIEDE2000; `colors[i].lab` required. |
| `mergeBlocks(blocks)` | Row-major `{bx,by,bw,bh,key}` → merged `{x,y,w,h,key}` rectangles (horizontal runs, then vertical stacking). |
| `estimateCans(area, pct, coverage)` | `max(1, ceil(area·pct/100/coverage))`; 0 if no area. |
| `aggregateByPaint(results, idOf)` | One entry per paint: summed pct, best ΔE, image hexes, cluster indices, fallback/locked flags. Sorted by pct. |
| `escapeHtml`, `toCSV` | `toCSV` quotes fields per RFC 4180 and prepends a UTF-8 BOM. |

## App block

### Startup
`// ─── Palette normalisation ───` walks every catalogue entry: uppercases `hex`, sets `line` (palette key), and defines non-enumerable `id` and `lab`. It fills `PAINT_BY_ID`. `resolvePaint()` maps a paint object from a session file back to a catalogue entry (by id, else by hex + name), or builds a sanitised stand-alone copy.

### Global state

```js
imageLoaded, imageInfo      // { origW, origH, hasAlpha }; the analysis canvas holds the (downscaled) pixels
previewUrl                  // object URL of #preview-img, revoked on replace
rawClusters                 // Cluster[] | null
analysisResult              // Result[] | null (index i ↔ rawClusters[i])
renderMode, compareMode     // 'pixel' | 'vector' | 'spray'; compare forces pixel
excludedIndices             // Set<clusterIdx>
lockedOverrides             // Map<clusterIdx, Paint>
lastBlocks, lastPaints, lastSrcW, lastSrcH   // last render, reused by stencil export
compareSnapshot             // diff target or null
activeFallbackKeys          // Set<paletteKey>
needsFit                    // fit zoom on next render (new image only)
analysisToken               // discards stale async analysis results
currentZoom, renderNativeW/H
```

Inputs are read from the DOM when needed: `#paint-line`, `#color-count`, `#min-pct`, `#match-quality`, `#block-size`, `#wall-w/h/cov`.

### Pipeline

1. **Load**: `handleFile(file)` → `resetWorkspace()` → `loadImageSource(src)` draws the image onto `#analysis-canvas` scaled to ≤ `MAX_ANALYSIS_DIM` (1600) and detects transparency → `showWorkspace()` → `runFullAnalysis()`.
2. **Cluster**: `runFullAnalysis()` clears locks and excludes, samples on the main thread, then `clusterAsync()` posts the samples to the worker. The worker is created lazily from `#core-lib`'s text as a blob URL. If workers fail, it falls back to the main thread. Errors go to `analysisFailed()`, which always hides the spinner.
3. **Match**: `rematch()` builds `analysisResult`. A locked cluster takes its paint and ΔE to it. Otherwise `findClosestMontana(lab)` searches the primary line, then the active fallbacks if ΔE > `CA.matchPctToDelta(matchQuality)`. It then renders cards, layer order, wall calc, diff, and either `renderMontanaImage()` or, when there is no image, `showAttachPrompt()`.
4. **Render**: `renderMontanaImage()` → `buildRenderBlocks()` averages each block's opaque pixels and snaps the average to the nearest active paint (CIEDE2000, cached per integer RGB) → mode dispatch:
   - pixel: `fillRect` per merged rectangle
   - vector: `<g fill><rect/>…</g>` per paint from merged rectangles
   - spray: `renderMontanaSpray()`: seeded, dark → light, 4 radial blobs per block
   - Zoom is kept unless `needsFit`.
5. **Compare mode**: `enterCompareMode()` copies `#analysis-canvas` into `#compare-orig-canvas` and clips both around the slider position (`updateCompare()` on slider, scroll and zoom).

### Derived outputs (all from `activePaints()`)

| Output | Function |
|---|---|
| Summary pills | `renderSummaryPills()` |
| Card wall estimates | `cardCansText()` / `updateCardCans()` (per cluster area; cans for the whole paint; "same can as #n") |
| Wall calculator | `calcWallCans()` |
| Layer order | `layerOrder()` sorts by paint L\* (5-unit bands, then coverage); `renderLayerOrder()` |
| CSV | `exportCSV()`: rows in layer order + total |
| Palette PDF | `exportPalettePDF()`: new window, `document.write`, auto print |
| Stencils | `exportStencils()`: `CA.mergeBlocks(lastBlocks)` grouped by paint id, in layer order |
| Diff | `renderDiffPanel()`: join by paint id |

### Sessions
`doSaveSession()` writes v2 (see `DATA_MODEL.md`). `loadSessionFromJSON()` → `sanitizeSession()` validates everything, clamps numbers, resolves lock paints, and accepts only `data:image/(png|jpeg|webp)` images. It then restores the settings and calls `rematch()`, after loading the embedded image if there is one. Without an image, **ATTACH IMAGE** loads a picture without re-clustering, so locks stay valid. `loadCompareFromJSON()` reads only `analysisResult` from a file.

### Event wiring cheat-sheet

| Input | Effect |
|---|---|
| file input / drop image | `handleFile` |
| drop `.json` on upload zone | `loadSessionFromJSON` |
| ANALYZE | `runFullAnalysis` |
| `#paint-line`, `#match-quality`, fallback chip | `rematch` |
| `#color-count`, `#min-pct` | label only |
| `#block-size` | debounced `renderMontanaImage` |
| mode buttons | `setRenderMode` / `enterCompareMode` |
| card EXCLUDE / LOCK / UNLOCK | `toggleExclude` / `openLockPicker` / `unlockColor` → `rematch` |
| wall inputs | `calcWallCans`, pills, card estimates |
| Esc | close lock picker and session modal |

### Mobile
Pure CSS plus a hamburger drawer (`#mobile-drawer`). Its buttons call the same functions as the desktop buttons (`saveForCompare`, `openSaveSessionModal`, `sessionLoadInput.click()`, `exportCSV`, `reset`).
