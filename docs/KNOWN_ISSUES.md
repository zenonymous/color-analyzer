# Known issues and tech debt

## Open

### Behaviour
- **Block size depends on the analysed resolution.** Images are downscaled to ≤ 1600 px, so "12 px blocks" are relative to that size, not the original photo. Stencil SVGs use the analysed size too. They're vector, so they scale cleanly, but the pixel dimensions differ from the original.
- **ANALYZE clears locks and exclusions.** Intentional (they're keyed by cluster index), but it could surprise users. A future improvement could re-map locks to the nearest new cluster.
- **Layer-order roles are heuristic** (L\* thresholds 70/40, "detail" < 3 % coverage). They don't take into account where colours sit in the image.
- **Can estimates** assume one even coat over the colour's share of the wall. There's no allowance for overspray, outlines or multiple coats; users adjust the coverage-per-can field.
- The Palette PDF uses `window.open` + `document.write` and needs pop-ups allowed.
- Clipboard copy falls back to `execCommand('copy')` when the async clipboard API is unavailable; very old browsers may still refuse.

### Performance
Measured in headless Chromium (software rendering) on a 12 MP photo, analysed at 1600×1200: full analysis ≈ 1.7 s at k = 12 and ≈ 2.6 s at k = 128. Render at block 12: pixel/vector ≈ 40 ms, spray ≈ 0.3 s. At block 4: pixel ≈ 0.1 s, vector ≈ 0.15 s, spray ≈ 1.8 s.
- Rendering (block averaging and nearest-paint lookup) still runs on the main thread.
- Spray mode at small block sizes is the slowest path (~480k sprite stamps at block 4).

### Tech debt
- One 5.8k-line file (by owner decision). ~1,400 lines are palette data, ~2,200 are CSS.
- Global mutable state in the app block; derived UI is rebuilt with `innerHTML`.
- "Montana" naming leftovers (see `AGENTS.md`); `_type: 'montana-session'` must stay.
- Many inline `style=""` attributes in the markup.
- **Accessibility** (deliberately out of scope for now): colour cards and lock swatches are clickable `div`s without roles or keyboard support, sliders lack `<label for>`, small text (6.5–9 px) has low contrast, and nothing is announced to screen readers.

## Fixed (Sept 2026 overhaul)

For context when reading older history or sessions:

| Was | Now |
|---|---|
| Images with fewer distinct colours than Color Depth hung the spinner forever (k-means++ picked `pixels[-1]`). | `kMeans` stops seeding when all points are covered; failures always hide the spinner and show a toast. |
| Excluded colours still counted in wall calc and layer order. | All outputs use `activePaints()`. |
| 169 paints have empty codes; the lock picker de-duplicated by code (showed 1,130 of 1,336), the diff collided rows, stencils were named `stencil_01_.svg`. | Paints keyed by `id` (`line|code||name`); the picker shows all 1,335 and searches by line and hex. |
| Montana BLACK listed "Outline Silver" twice. | Duplicate removed (187 colours). |
| Locked colours reported the primary line as their source. | Paints carry `line`; the lock tag shows the real line. |
| The same paint was listed and costed once per cluster; three different can formulas disagreed. | Shopping-list outputs aggregate per paint; one wall-based formula everywhere. |
| CSV unquoted, no BOM, included excluded colours. | RFC 4180 quoting, BOM, one row per paint in spray order, total row. |
| Session file values injected into `innerHTML` (script injection via shared sessions). | `sanitizeSession()` validates; all data-derived text is escaped. |
| Session restore couldn't bring the render back; wall and render mode weren't saved; the mobile menu had no Load Session. | v2 sessions embed the image and all settings; ATTACH IMAGE for image-less sessions; drawer has Load Session; `.json` can be dropped on the upload zone. |
| CIE76 matching, RGB k-means, non-deterministic results. | CIEDE2000 matching, Lab k-means, seeded RNG (same image + settings → same result). |
| Full-resolution processing on the main thread froze the tab on big photos; one `<rect>` per block in vector mode and stencils. | ≤ 1600 px analysis, ≤ 60k samples, clustering in a Web Worker, cached nearest-paint lookups, merged rectangles. |
| Every re-render reset zoom; spray looked different on every re-render; object URLs leaked; Esc didn't close the save dialog; mobile save dialog's Cancel button touched the screen edge. | All fixed. |
