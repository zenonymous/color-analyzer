# Known issues and tech debt

Found while documenting the codebase in Sept 2026. Items marked **verified** were reproduced in headless Chromium. The others come from reading the code.

## Bugs

### 1. Flat-colour images hang the analysis (verified)
`kMeans` k-means++ seeding: once every distinct colour is already a centre, all distances are 0, so `total = 0`. The `while (r > 0)` loop never runs, `idx` stays 0, and `pixels[-1]` (`undefined`) is pushed as a centre. The next distance calculation throws `Cannot read properties of undefined (reading '0')` inside a `setTimeout`, and the spinner stays up forever.
**Trigger:** any image with fewer distinct colours than Color Depth (logos, flat vector art, pixel art, or a stencil design with the default k = 12).
**Fix:** stop seeding when `total === 0`, or cap `k` at the number of unique colours, and wrap the analysis in try/catch that hides the spinner and shows a toast.

### 2. Excluded colours still count in the wall calculator and layer order (verified)
`calcWallCans()` and `renderLayerOrder()` iterate the whole `analysisResult`, not `filter(r => !r.isExcluded)`. The README says exclusion removes a colour from both.

### 3. Empty paint codes break code-keyed features (verified for the lock picker)
169 catalogue entries have `code: ""`, including all of MTN Water Based and MTN Vice (see `PALETTES.md`).
- **Lock picker** de-duplicates by `code`, so every empty-code colour after the first is dropped. It shows 1,130 of 1,336 colours, and Water Based and Vice are almost unreachable.
- **Diff panel** joins by `code`, so different empty-code paints collide into one row.
- **Stencil filenames** become `stencil_01_.svg`.
- Duplicate *real* codes also exist (e.g. one in Montana BLACK).

### 4. Session restore can't bring back the render, contrary to the README
After Load Session, the upload zone is hidden and the header has no upload button. The only way back is NEW IMAGE, which calls `reset()` and wipes the session. Uploading an image also calls `runFullAnalysis()`, which clears locks and excludes and re-clusters with new random seeds, so the indices wouldn't line up anyway. The README says "re-upload the original image and click ANALYZE — all your locks and exclusions will still be in place". That does not work.

### 5. Session file doesn't contain everything the README claims
Wall calculator width/height/coverage and render mode are not saved or restored.

### 6. Mobile drawer has no "Load Session"
The README lists it; the drawer only has Save for Compare, Save Session, Export CSV, and New Image.

### 7. Locked colours report the wrong source line
`rematch()` uses `locked._lineName || getActiveLineName()`, but `_lineName` is never set. A colour locked to a Molotow paint while the primary line is Montana BLACK shows "Montana BLACK" in the CSV "Source Line" column.

### 8. Duplicate paints are listed and costed twice
Two clusters often map to the same can. Cards, CSV, the PDF, the wall calculator, and the can totals list that paint separately each time and round each one up. The render and stencils already merge by hex. A shopping list should aggregate by paint.

### 9. Three different can estimates
- Cards / CSV / PDF: `max(1, ceil(pct/10))`, a fixed heuristic unrelated to wall size.
- Summary pill: `ceil(pct/10)` without the `max(1, …)`, so it can disagree with the sum of the cards.
- Wall calculator: area-based.

### 10. CSV isn't escaped
Rows are `join(',')` without quoting. No current names contain commas, so this is safe today, but a new palette or a hand-edited session could break it. There's also no UTF-8 BOM, so Excel may garble the `ΔE` header.

### 11. HTML injection from session files
Names, codes, and labels from a loaded session or compare file are interpolated into `innerHTML` (cards, layer order, diff table, PDF). The README encourages sharing session files with collaborators, so a crafted file could run script in the page. Low impact because there is no backend or credentials, but it's cheap to escape.

### 12. Minor
- `URL.createObjectURL` is never revoked for downloads or uploaded images, so memory leaks over a long session.
- `applyCompare()` is dead code (superseded by `updateCompare()`).
- `renderLockPickerGrid` highlights the current colour by exact hex string match; mixed-case hex between lines can miss it.
- Spray render uses `Math.random`, so each re-render (slider move, exclusion) looks different. The code comment mentions seeding but none is implemented.
- Every `renderMontanaImage()` calls `fitZoom()`, so tweaking block size or excluding a colour throws away the user's zoom level.
- Clipboard copy has no fallback for non-secure contexts (`file://` works in most browsers, but some block `navigator.clipboard`).

## Performance

- All work runs on the main thread. `colorDistance` converts **both** colours to Lab on every call, so the palette is re-converted for every cluster (fine) and for every render block × palette colour (not fine).
- `renderMontanaImage` processes the image at **full resolution**. A 24 MP phone photo at block size 4 is about 1.5 M blocks × up to 128 palette colours × 2 Lab conversions, which takes many seconds and freezes the tab. The vector mode then creates the same number of DOM `<rect>`s, and each stencil SVG gets one `<rect>` per block.
- k-means uses `pixels.map` with arrays of arrays and runs 20 fixed iterations with no convergence check.

## Tech debt / structure

- One 5.5k-line file. ~1,400 lines are palette data, ~2,200 are CSS.
- Global mutable state everywhere; derived UI is rebuilt wholesale via `innerHTML`.
- The "Montana" naming is a leftover from the single-brand origin (see `AGENTS.md`).
- Many inline `style=""` attributes in the markup and in generated HTML.
- No tests and no CI.
- Accessibility: the colour cards and lock picker swatches are clickable `div`s without roles or keyboard support, the sliders have no associated `<label for>`, and small text (6.5–9 px) has low contrast.
